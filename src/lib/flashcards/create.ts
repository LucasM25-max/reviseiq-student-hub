import "server-only";

/**
 * Turning a wrong answer into cards (doc 07 §2, D11).
 *
 * Called from the marking service after an attempt is stored. Deliberately
 * best-effort: a student's mark must never fail because card creation did.
 */

import { coverage } from "@/lib/ai/normalise";
import { newCard } from "@/lib/fsrs";
import {
  attemptCanCreateCards,
  CAPS,
  createsCards,
  selectUnderCaps,
  type CardCandidate,
  type CardContext,
} from "@/lib/flashcards/caps";
import {
  deterministicCardText,
  DETERMINISTIC_GENERATOR,
  type CardTextInput,
} from "@/lib/flashcards/text";
import { prisma } from "@/lib/db/prisma";
import type { MarkResult } from "@/lib/ai/types";

export type CreateCardsInput = {
  userId: string;
  questionId: string;
  attemptId: string;
  setId: string | null;
  context: string;
  result: Pick<MarkResult, "awardedMarks" | "maxMarks" | "pointsAwarded">;
};

const startOfUtcDay = (now: Date) =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

/**
 * Creates cards for the mark points this attempt missed.
 *
 * Returns how many were created, which the UI uses for the "your first card" moment.
 */
export async function createCardsForAttempt(
  input: CreateCardsInput,
  now: Date = new Date(),
): Promise<number> {
  try {
    if (!createsCards(input.context)) return 0;

    const missed = input.result.pointsAwarded
      .filter((point) => !point.awarded)
      .map((point) => point.markPointId);

    if (
      !attemptCanCreateCards({
        context: input.context,
        awardedMarks: input.result.awardedMarks,
        maxMarks: input.result.maxMarks,
        missedMarkPointIds: missed,
      })
    ) {
      return 0;
    }

    const question = await prisma.question.findUnique({
      where: { id: input.questionId },
      select: {
        id: true,
        commandWord: true,
        markScheme: { select: { points: true } },
        specPoints: {
          select: { specPointId: true, specPoint: { select: { id: true, statement: true } } },
        },
      },
    });

    if (!question?.markScheme || question.specPoints.length === 0) return 0;

    const schemePoints = (
      Array.isArray(question.markScheme.points) ? question.markScheme.points : []
    ) as Array<{ id: string; text: string; marks: number }>;

    /*
     * A question can assess several spec points, and which one a card belongs to
     * matters: retirement looks for full marks on *that* spec point, so filing every
     * card under whichever point happened to be listed first makes retirement a coin
     * flip. Each card goes to the spec point its mark point is actually about,
     * decided by wording overlap and tie-broken on the listed order so it stays
     * deterministic.
     */
    const specPoints = question.specPoints.map((link) => link.specPoint);

    const specPointFor = (markPointText: string): { id: string; statement: string } => {
      let best = specPoints[0]!;
      let bestScore = -1;

      for (const candidate of specPoints) {
        const score = coverage(markPointText, candidate.statement);
        if (score > bestScore) {
          bestScore = score;
          best = candidate;
        }
      }

      return best;
    };

    const candidates: CardCandidate[] = missed
      .map((markPointId) => {
        const point = schemePoints.find((candidate) => candidate.id === markPointId);
        if (!point) return null;
        return {
          markPointId,
          specPointId: specPointFor(point.text).id,
          marks: point.marks,
        };
      })
      .filter((candidate): candidate is CardCandidate => candidate !== null);

    if (candidates.length === 0) return 0;

    const dayStart = startOfUtcDay(now);

    const [existingForQuestion, existingInSession, existingToday, live] = await Promise.all([
      prisma.flashcard.count({
        where: { userId: input.userId, template: { questionId: question.id } },
      }),
      input.setId
        ? prisma.flashcard.count({
            where: {
              userId: input.userId,
              createdAt: { gte: dayStart },
              template: { questionId: { in: await questionIdsInSet(input.setId) } },
            },
          })
        : Promise.resolve(0),
      prisma.flashcard.count({ where: { userId: input.userId, createdAt: { gte: dayStart } } }),
      // A live card already covering this idea means there is nothing to add.
      prisma.flashcard.findMany({
        where: {
          userId: input.userId,
          retiredAt: null,
          specPointId: { in: candidates.map((c) => c.specPointId) },
          template: { markPointId: { in: candidates.map((c) => c.markPointId) } },
        },
        select: { template: { select: { markPointId: true } } },
      }),
    ]);

    const alreadyCovered = new Set(live.map((card) => card.template.markPointId));
    const fresh = candidates.filter((candidate) => !alreadyCovered.has(candidate.markPointId));
    if (fresh.length === 0) return 0;

    const chosen = selectUnderCaps(fresh, {
      existingForQuestion,
      existingInSession,
      existingToday,
      context: input.context as CardContext,
    });

    let created = 0;

    for (const candidate of chosen) {
      const point = schemePoints.find((p) => p.id === candidate.markPointId);
      if (!point) continue;

      const templateId = `${question.id}:${candidate.markPointId}`;

      const textInput: CardTextInput = {
        markPointText: point.text,
        specPointStatement: specPointFor(point.text).statement,
        commandWord: question.commandWord,
      };
      const text = deterministicCardText(textInput);

      // Global: the first student to miss this point pays for the template, and
      // every student afterwards gets it for nothing.
      await prisma.cardTemplate.upsert({
        where: { id: templateId },
        create: {
          id: templateId,
          questionId: question.id,
          markPointId: candidate.markPointId,
          specPointId: candidate.specPointId,
          cardType: text.cardType,
          front: text.front,
          back: text.back,
          hint: text.hint,
          generatedBy: DETERMINISTIC_GENERATOR,
        },
        update: {},
      });

      const state = newCard(now);

      await prisma.flashcard.upsert({
        where: { userId_templateId: { userId: input.userId, templateId } },
        create: {
          userId: input.userId,
          templateId,
          specPointId: candidate.specPointId,
          due: state.due,
          stability: state.stability,
          difficulty: state.difficulty,
          elapsedDays: state.elapsedDays,
          scheduledDays: state.scheduledDays,
          reps: state.reps,
          lapses: state.lapses,
          learningSteps: state.learningSteps,
          state: "NEW",
          sourceAttemptId: input.attemptId,
        },
        // A retired card that is missed again comes back rather than duplicating.
        update: { retiredAt: null, suspendedAt: null },
      });

      created += 1;
    }

    return created;
  } catch (error) {
    console.error("[flashcards] could not create cards for an attempt", error);
    return 0;
  }
}

async function questionIdsInSet(setId: string): Promise<string[]> {
  const set = await prisma.questionSet.findUnique({
    where: { id: setId },
    select: { questionIds: true },
  });
  return set?.questionIds ?? [];
}

/**
 * Retires cards once exam performance proves the point is known (doc 07 §4).
 *
 * Two full-mark answers on the spec point, because one could be luck. The evidence
 * that matters is exam performance, not card performance — which is what stops the
 * deck growing forever.
 */
export const RETIREMENT_THRESHOLD = 2;

export async function retireProvenCards(
  userId: string,
  specPointIds: string[],
  now: Date = new Date(),
): Promise<number> {
  if (specPointIds.length === 0) return 0;

  try {
    let retired = 0;

    for (const specPointId of specPointIds) {
      const recent = await prisma.questionAttempt.findMany({
        where: {
          userId,
          question: { specPoints: { some: { specPointId } } },
          context: { in: ["PRACTICE", "MINI_MOCK", "FULL_MOCK", "MASTERY_CHECK"] },
        },
        select: { awardedMarks: true, maxMarks: true },
        orderBy: { createdAt: "desc" },
        take: RETIREMENT_THRESHOLD,
      });

      const proven =
        recent.length >= RETIREMENT_THRESHOLD &&
        recent.every(
          (attempt) => attempt.maxMarks > 0 && attempt.awardedMarks >= attempt.maxMarks,
        );

      if (!proven) continue;

      const result = await prisma.flashcard.updateMany({
        where: { userId, specPointId, retiredAt: null },
        data: { retiredAt: now },
      });
      retired += result.count;
    }

    return retired;
  } catch (error) {
    console.error("[flashcards] could not retire proven cards", error);
    return 0;
  }
}

export { CAPS };
