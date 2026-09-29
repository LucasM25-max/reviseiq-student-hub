import "server-only";

/**
 * Marking one answer, from question id to stored attempt.
 *
 * The single path used by both the API route and the practice server action, so the
 * two can never diverge on what gets marked, what gets stored, or what a student is
 * allowed to mark.
 *
 * Ownership is enforced here rather than only in the caller: a second caller one
 * `await` away from being wrong would otherwise be a cross-user write.
 */

import { markOpenResponse } from "@/lib/ai/mark";
import { markedByFor, type MarkInput, type MarkResult } from "@/lib/ai/types";
import { createCardsForAttempt, retireProvenCards } from "@/lib/flashcards/create";
import { autoMark, isObjective } from "@/lib/marking/auto";
import { nextMastery, weightFor } from "@/lib/marking/mastery";
import { prisma } from "@/lib/db/prisma";
import type { AttemptContext } from "@/generated/prisma/enums";

export type MarkRequest = {
  userId: string;
  questionId: string;
  answerText?: string | null;
  answerKey?: string | null;
  context: AttemptContext;
  setId?: string | null;
  durationSec?: number;
};

export type MarkFailure = { ok: false; error: string };
export type MarkSuccess = { ok: true; result: MarkResult; attemptId: string };

type MarkSchemePoint = {
  id: string;
  text: string;
  marks: number;
  alternatives?: string[];
  reject?: string[];
};

/** Loads everything the marker is allowed to see. Never selects `modelAnswer`. */
async function loadQuestion(questionId: string) {
  return prisma.question.findUnique({
    where: { id: questionId },
    select: {
      id: true,
      type: true,
      marks: true,
      tier: true,
      stem: true,
      commandWord: true,
      correctKey: true,
      retired: true,
      markScheme: {
        select: { points: true, guidance: true, ecfRules: true, numericAnswer: true },
      },
      specPoints: { select: { specPoint: { select: { statement: true } } } },
    },
  });
}

export async function markAnswer(request: MarkRequest): Promise<MarkSuccess | MarkFailure> {
  const question = await loadQuestion(request.questionId);
  if (!question) return { ok: false, error: "That question doesn't exist." };
  if (!question.markScheme) return { ok: false, error: "That question has no mark scheme." };

  // A set-scoped attempt must belong to the student claiming it.
  if (request.setId) {
    const set = await prisma.questionSet.findFirst({
      where: { id: request.setId, userId: request.userId },
      select: { id: true },
    });
    if (!set) return { ok: false, error: "That practice set isn't yours." };
  }

  const points: MarkSchemePoint[] = Array.isArray(question.markScheme.points)
    ? (question.markScheme.points as unknown as MarkSchemePoint[])
    : [];

  let result: MarkResult;

  // Objective and numeric questions are never sent to a model (doc 06 §6).
  if (
    isObjective({
      id: question.id,
      type: question.type,
      marks: question.marks,
      correctKey: question.correctKey,
    })
  ) {
    const outcome = autoMark(
      {
        id: question.id,
        type: question.type,
        marks: question.marks,
        correctKey: question.correctKey,
      },
      { answerKey: request.answerKey, answerText: request.answerText },
    );

    result = {
      awardedMarks: outcome.awardedMarks,
      maxMarks: question.marks,
      pointsAwarded: [],
      missing: [],
      misconceptions: [],
      feedback: {
        whatWentWell: outcome.awardedMarks > 0 ? "Correct." : "",
        evenBetterIf: outcome.awardedMarks > 0 ? "" : "Check the mark scheme for why.",
      },
      confidence: 1,
      provisional: false,
      notes: [],
      source: "AUTO",
      degraded: null,
      promptVersion: "auto",
      model: null,
    };
  } else {
    const input: MarkInput = {
      question: {
        id: question.id,
        stem: question.stem,
        commandWord: question.commandWord,
        marks: question.marks,
        tier: String(question.tier),
        specPointStatements: question.specPoints.map((link) => link.specPoint.statement),
      },
      markScheme: {
        points: points.map((point) => ({
          id: point.id,
          text: point.text,
          marks: point.marks,
          alternatives: point.alternatives ?? [],
          reject: point.reject ?? [],
        })),
        guidance: question.markScheme.guidance,
        ecfRules: question.markScheme.ecfRules,
      },
      answer: request.answerText ?? "",
    };

    result = await markOpenResponse(input, { userId: request.userId });
  }

  const attempt = await prisma.questionAttempt.upsert({
    where: request.setId
      ? { setId_questionId: { setId: request.setId, questionId: question.id } }
      : // No set: a standalone attempt, which has no natural key, so force a create.
        { id: "" },
    create: {
      userId: request.userId,
      questionId: question.id,
      context: request.context,
      setId: request.setId ?? null,
      answerText: request.answerText ?? null,
      answerKey: request.answerKey ?? null,
      awardedMarks: result.awardedMarks,
      maxMarks: result.maxMarks,
      markedBy: markedByFor(result.source),
      markDetail: result as unknown as object,
      aiConfidence: result.confidence,
      promptVersion: result.promptVersion,
      durationSec: Math.max(0, Math.trunc(request.durationSec ?? 0)),
    },
    update: {
      answerText: request.answerText ?? null,
      answerKey: request.answerKey ?? null,
      awardedMarks: result.awardedMarks,
      maxMarks: result.maxMarks,
      markedBy: markedByFor(result.source),
      markDetail: result as unknown as object,
      aiConfidence: result.confidence,
      promptVersion: result.promptVersion,
      // A re-mark is a fresh judgement; an old dispute no longer applies to it.
      disputed: false,
      disputeReason: null,
      disputedAt: null,
    },
    select: { id: true },
  });

  await updateMastery({
    userId: request.userId,
    questionId: question.id,
    awardedMarks: result.awardedMarks,
    maxMarks: result.maxMarks,
    markedBy: markedByFor(result.source),
    provisional: result.provisional,
  });

  /*
   * The deck builds itself from mistakes (D11). Both calls are best-effort and
   * swallow their own failures: a student's mark must never be lost because a card
   * could not be written.
   */
  const specPointIds = await prisma.questionSpecPoint
    .findMany({ where: { questionId: question.id }, select: { specPointId: true } })
    .then((links) => links.map((link) => link.specPointId))
    .catch(() => [] as string[]);

  if (result.awardedMarks >= result.maxMarks && result.maxMarks > 0) {
    // Exam performance is the evidence that matters, so proving it retires the cards.
    await retireProvenCards(request.userId, specPointIds);
  } else {
    await createCardsForAttempt({
      userId: request.userId,
      questionId: question.id,
      attemptId: attempt.id,
      setId: request.setId ?? null,
      context: request.context,
      result,
    });
  }

  return { ok: true, result, attemptId: attempt.id };
}

/**
 * Folds one marked attempt into every spec point the question assesses.
 *
 * Best-effort: mastery is a scheduling signal, and failing to update it must never
 * cost a student the mark they just earned.
 */
export async function updateMastery(input: {
  userId: string;
  questionId: string;
  awardedMarks: number;
  maxMarks: number;
  markedBy: string;
  provisional: boolean;
}): Promise<void> {
  try {
    const links = await prisma.questionSpecPoint.findMany({
      where: { questionId: input.questionId },
      select: { specPointId: true },
    });
    if (links.length === 0) return;

    const weight = weightFor(input.markedBy, input.provisional);
    const ids = links.map((link) => link.specPointId);

    const existing = await prisma.specPointMastery.findMany({
      where: { userId: input.userId, specPointId: { in: ids } },
    });
    const byId = new Map(existing.map((row) => [row.specPointId, row]));

    await prisma.$transaction(
      ids.map((specPointId) => {
        const previous = byId.get(specPointId);
        const mastery = nextMastery(
          previous ? previous.mastery : null,
          input.awardedMarks,
          input.maxMarks,
          weight,
        );

        return prisma.specPointMastery.upsert({
          where: { userId_specPointId: { userId: input.userId, specPointId } },
          create: {
            userId: input.userId,
            specPointId,
            mastery,
            attempts: 1,
            marksEarned: input.awardedMarks,
            marksTotal: input.maxMarks,
            lastSeenAt: new Date(),
          },
          update: {
            mastery,
            attempts: { increment: 1 },
            marksEarned: { increment: input.awardedMarks },
            marksTotal: { increment: input.maxMarks },
            lastSeenAt: new Date(),
          },
        });
      }),
    );
  } catch (error) {
    console.error("[marking] could not update spec point mastery", error);
  }
}

/** The mark scheme and model answer, shown only after marking (doc 06 §1). */
export async function loadMarkSchemeForReview(questionId: string) {
  return prisma.markScheme.findUnique({
    where: { questionId },
    select: { points: true, guidance: true, modelAnswer: true },
  });
}
