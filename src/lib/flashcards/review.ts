import "server-only";

/**
 * The review lifecycle: grade, undo, suspend, leech (doc 07 §3–4).
 *
 * Every write records the card's prior state in full, which is what makes undo exact.
 * Re-deriving the previous FSRS state from the rating is not reliable — floating point
 * stability and difficulty do not round-trip — so the row stores it verbatim.
 */

import { buildQueue, DAILY_REVIEW_CAP, type QueueCard } from "@/lib/flashcards/queue";
import { preview, review as schedule, type RatingName, type SchedulerState } from "@/lib/fsrs";
import { prisma } from "@/lib/db/prisma";
import type { CardRating, CardState } from "@/generated/prisma/enums";

/** Eight failures means the idea was never understood (doc 07 §4). */
export const LEECH_THRESHOLD = 8;

type CardRow = {
  id: string;
  due: Date;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  learningSteps: number;
  state: CardState;
  lastReview: Date | null;
};

const toState = (card: CardRow): SchedulerState => ({
  due: card.due,
  stability: card.stability,
  difficulty: card.difficulty,
  elapsedDays: card.elapsedDays,
  scheduledDays: card.scheduledDays,
  reps: card.reps,
  lapses: card.lapses,
  learningSteps: card.learningSteps,
  state: card.state,
  lastReview: card.lastReview,
});

export type ReviewCard = {
  id: string;
  front: string;
  back: string;
  hint: string | null;
  cardType: string;
  state: CardState;
  lapses: number;
  /** "From a question you got wrong on 14 Oct" (doc 07 §2). */
  createdAt: Date;
  sourceAttemptId: string | null;
  /** What each button would do, so intervals can be shown on them. */
  intervals: Record<RatingName, Date>;
};

/** The cards to review now, in session order. */
export async function dueQueueFor(
  userId: string,
  now: Date = new Date(),
  cap: number = DAILY_REVIEW_CAP,
): Promise<ReviewCard[]> {
  const cards = await prisma.flashcard.findMany({
    where: {
      userId,
      retiredAt: null,
      suspendedAt: null,
      due: { lte: now },
    },
    select: {
      id: true,
      due: true,
      stability: true,
      difficulty: true,
      elapsedDays: true,
      scheduledDays: true,
      reps: true,
      lapses: true,
      learningSteps: true,
      state: true,
      lastReview: true,
      createdAt: true,
      sourceAttemptId: true,
      specPointId: true,
      template: { select: { front: true, back: true, hint: true, cardType: true } },
    },
    // A generous ceiling before ordering; the queue does the real selection.
    take: 400,
  });

  const subjectFor = await subjectBySpecPoint(cards.map((card) => card.specPointId));

  const queueInput: QueueCard[] = cards.map((card) => ({
    id: card.id,
    state: card.state,
    due: card.due,
    subjectId: subjectFor.get(card.specPointId) ?? "unknown",
  }));

  const ordered = buildQueue(queueInput, now, cap);
  const byId = new Map(cards.map((card) => [card.id, card]));

  return ordered.map((queued) => {
    const card = byId.get(queued.id)!;
    const options = preview(toState(card), now);

    return {
      id: card.id,
      front: card.template.front,
      back: card.template.back,
      hint: card.template.hint,
      cardType: card.template.cardType,
      state: card.state,
      lapses: card.lapses,
      createdAt: card.createdAt,
      sourceAttemptId: card.sourceAttemptId,
      intervals: {
        AGAIN: options.AGAIN.due,
        HARD: options.HARD.due,
        GOOD: options.GOOD.due,
        EASY: options.EASY.due,
      },
    };
  });
}

/** Spec point → subject, for the light cross-subject interleaving. */
async function subjectBySpecPoint(specPointIds: string[]): Promise<Map<string, string>> {
  if (specPointIds.length === 0) return new Map();

  const points = await prisma.specPoint.findMany({
    where: { id: { in: specPointIds } },
    select: { id: true, subTopic: { select: { topic: { select: { subjectId: true } } } } },
  });

  return new Map(points.map((point) => [point.id, point.subTopic.topic.subjectId]));
}

export type GradeOutcome =
  { ok: true; leech: boolean; nextDue: Date } | { ok: false; error: string };

/** Grades a card, advances its FSRS state, and records the prior state for undo. */
export async function gradeCard(
  userId: string,
  cardId: string,
  rating: RatingName,
  durationMs = 0,
  now: Date = new Date(),
): Promise<GradeOutcome> {
  const card = await prisma.flashcard.findFirst({
    where: { id: cardId, userId },
    select: {
      id: true,
      due: true,
      stability: true,
      difficulty: true,
      elapsedDays: true,
      scheduledDays: true,
      reps: true,
      lapses: true,
      learningSteps: true,
      state: true,
      lastReview: true,
      specPointId: true,
    },
  });

  if (!card) return { ok: false, error: "That card isn't yours." };

  const next = schedule(toState(card), rating, now);
  const leech = next.lapses >= LEECH_THRESHOLD;

  await prisma.$transaction([
    prisma.cardReview.create({
      data: {
        cardId: card.id,
        userId,
        rating: rating as CardRating,
        reviewedAt: now,
        durationMs: Math.max(0, Math.min(Math.trunc(durationMs), 10 * 60_000)),
        priorDue: card.due,
        priorStability: card.stability,
        priorDifficulty: card.difficulty,
        priorElapsedDays: card.elapsedDays,
        priorScheduledDays: card.scheduledDays,
        priorReps: card.reps,
        priorLapses: card.lapses,
        priorLearningSteps: card.learningSteps,
        priorState: card.state,
        priorLastReview: card.lastReview,
      },
    }),
    prisma.flashcard.update({
      where: { id: card.id },
      data: {
        due: next.due,
        stability: next.stability,
        difficulty: next.difficulty,
        elapsedDays: next.elapsedDays,
        scheduledDays: next.scheduledDays,
        reps: next.reps,
        lapses: next.lapses,
        learningSteps: next.learningSteps,
        state: next.state as CardState,
        lastReview: now,
        leech,
        // A leech is auto-suspended: Today schedules notes on it instead.
        suspendedAt: leech ? now : undefined,
      },
    }),
  ]);

  return { ok: true, leech, nextDue: next.due };
}

/**
 * Undoes the most recent review of a card, restoring the state verbatim.
 *
 * Only the latest review can be undone, and only once — the log row is consumed, so
 * pressing undo twice cannot walk a card backwards through its whole history.
 */
export async function undoLastReview(
  userId: string,
  cardId: string,
): Promise<{ ok: boolean; error?: string }> {
  const last = await prisma.cardReview.findFirst({
    where: { cardId, userId },
    orderBy: { reviewedAt: "desc" },
  });

  if (!last) return { ok: false, error: "There's nothing to undo." };

  await prisma.$transaction([
    prisma.flashcard.update({
      where: { id: cardId },
      data: {
        due: last.priorDue,
        stability: last.priorStability,
        difficulty: last.priorDifficulty,
        elapsedDays: last.priorElapsedDays,
        scheduledDays: last.priorScheduledDays,
        reps: last.priorReps,
        lapses: last.priorLapses,
        learningSteps: last.priorLearningSteps,
        state: last.priorState,
        lastReview: last.priorLastReview,
        // Undoing the review that tripped the leech also undoes the suspension.
        leech: last.priorLapses >= LEECH_THRESHOLD,
        suspendedAt: last.priorLapses >= LEECH_THRESHOLD ? last.reviewedAt : null,
      },
    }),
    prisma.cardReview.delete({ where: { id: last.id } }),
  ]);

  return { ok: true };
}

export async function setSuspended(
  userId: string,
  cardId: string,
  suspended: boolean,
  now: Date = new Date(),
): Promise<{ ok: boolean; error?: string }> {
  const result = await prisma.flashcard.updateMany({
    where: { id: cardId, userId },
    data: { suspendedAt: suspended ? now : null },
  });

  return result.count > 0 ? { ok: true } : { ok: false, error: "That card isn't yours." };
}

export type DeckSummary = {
  due: number;
  total: number;
  suspended: number;
  leeches: number;
  retired: number;
};

export async function deckSummaryFor(
  userId: string,
  now: Date = new Date(),
): Promise<DeckSummary> {
  const [due, total, suspended, leeches, retired] = await Promise.all([
    prisma.flashcard.count({
      where: { userId, retiredAt: null, suspendedAt: null, due: { lte: now } },
    }),
    prisma.flashcard.count({ where: { userId, retiredAt: null } }),
    prisma.flashcard.count({ where: { userId, retiredAt: null, suspendedAt: { not: null } } }),
    prisma.flashcard.count({ where: { userId, retiredAt: null, leech: true } }),
    prisma.flashcard.count({ where: { userId, retiredAt: { not: null } } }),
  ]);

  return { due, total, suspended, leeches, retired };
}
