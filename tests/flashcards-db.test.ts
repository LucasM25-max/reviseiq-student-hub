import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import {
  createCardsForAttempt,
  retireProvenCards,
  RETIREMENT_THRESHOLD,
} from "@/lib/flashcards/create";
import { CAPS } from "@/lib/flashcards/caps";
import {
  deckSummaryFor,
  dueQueueFor,
  gradeCard,
  LEECH_THRESHOLD,
  setSuspended,
  undoLastReview,
} from "@/lib/flashcards/review";
import type { MarkResult } from "@/lib/ai/types";

/**
 * The flashcard lifecycle against a real database.
 *
 * The pure layers — FSRS, the caps, the queue order — are tested elsewhere. What is
 * left is everything that only breaks once rows exist: creation from a marked
 * attempt, the unique constraint that stops a duplicate card, undo restoring state
 * verbatim, and retirement. These are the bugs that would quietly corrupt a student's
 * deck, so they are worth real rows.
 *
 * Writes for real and cleans up by deleting the user, which cascades.
 */

const USER_ID = "test-flashcards-user";
const QUESTION_ID = "bio-4112-q11";

function markResult(awarded: number, missed: string[], max = 3): MarkResult {
  return {
    awardedMarks: awarded,
    maxMarks: max,
    pointsAwarded: ["mp1", "mp2", "mp3"].map((id) => ({
      markPointId: id,
      awarded: !missed.includes(id),
      evidence: null,
      reason: "",
    })),
    missing: missed.map((id) => ({ markPointId: id, whatWasNeeded: "" })),
    misconceptions: [],
    feedback: { whatWentWell: "", evenBetterIf: "" },
    confidence: 1,
    provisional: false,
    notes: [],
    source: "AI",
    degraded: null,
    promptVersion: "test",
    model: null,
  };
}

const create = (missed: string[], awarded = 0, over: Record<string, unknown> = {}) =>
  createCardsForAttempt({
    userId: USER_ID,
    questionId: QUESTION_ID,
    attemptId: "attempt-1",
    setId: null,
    context: "PRACTICE",
    result: markResult(awarded, missed),
    ...over,
  });

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { id: USER_ID } });
  await prisma.user.create({
    data: { id: USER_ID, email: `${USER_ID}@example.test`, name: "Flashcards" },
  });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: USER_ID } });
});

describe("creating cards from a wrong answer", () => {
  it("makes one card per missed mark point, and none for what was right", async () => {
    const created = await create(["mp2", "mp3"], 1);
    expect(created).toBe(2);

    const cards = await prisma.flashcard.findMany({
      where: { userId: USER_ID },
      select: { template: { select: { markPointId: true, front: true, back: true } } },
    });

    expect(cards.map((card) => card.template.markPointId).sort()).toEqual(["mp2", "mp3"]);
    // The card must stand alone: text comes from the mark scheme, not the question.
    for (const card of cards) {
      expect(card.template.front.length).toBeGreaterThan(8);
      expect(card.template.back.length).toBeGreaterThan(2);
    }
  });

  it("does not duplicate a card for a point already covered", async () => {
    const before = await prisma.flashcard.count({ where: { userId: USER_ID } });
    expect(await create(["mp2", "mp3"], 1)).toBe(0);
    expect(await prisma.flashcard.count({ where: { userId: USER_ID } })).toBe(before);
  });

  it("makes nothing from full marks", async () => {
    expect(await create([], 3)).toBe(0);
  });

  it("makes nothing from a lesson check", async () => {
    expect(await create(["mp1"], 0, { context: "LESSON_CHECK" })).toBe(0);
  });

  it("shares one global template between students", async () => {
    const other = "test-flashcards-user-2";
    await prisma.user.deleteMany({ where: { id: other } });
    await prisma.user.create({
      data: { id: other, email: `${other}@example.test`, name: "Second" },
    });

    try {
      const templatesBefore = await prisma.cardTemplate.count();
      await createCardsForAttempt({
        userId: other,
        questionId: QUESTION_ID,
        attemptId: "attempt-2",
        setId: null,
        context: "PRACTICE",
        result: markResult(1, ["mp2", "mp3"]),
      });

      // Two students, two cards — but the text was written once.
      expect(await prisma.cardTemplate.count()).toBe(templatesBefore);
      expect(await prisma.flashcard.count({ where: { userId: other } })).toBe(2);
    } finally {
      await prisma.user.deleteMany({ where: { id: other } });
    }
  });

  it("never exceeds the per-question cap", async () => {
    await prisma.flashcard.deleteMany({ where: { userId: USER_ID } });
    await create(["mp1", "mp2", "mp3"], 0);
    expect(await prisma.flashcard.count({ where: { userId: USER_ID } })).toBeLessThanOrEqual(
      CAPS.perQuestion,
    );
  });

  it("files a card under the spec point its mark point is about", async () => {
    const cards = await prisma.flashcard.findMany({
      where: { userId: USER_ID },
      select: { specPointId: true, template: { select: { markPointId: true } } },
    });

    const linked = await prisma.questionSpecPoint.findMany({
      where: { questionId: QUESTION_ID },
      select: { specPointId: true },
    });
    const valid = new Set(linked.map((link) => link.specPointId));

    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      expect(valid.has(card.specPointId), card.template.markPointId).toBe(true);
    }
  });
});

describe("reviewing", () => {
  it("advances FSRS state and logs the prior state for undo", async () => {
    const card = (await prisma.flashcard.findFirst({ where: { userId: USER_ID } }))!;

    const outcome = await gradeCard(USER_ID, card.id, "GOOD");
    expect(outcome.ok).toBe(true);

    const after = (await prisma.flashcard.findUnique({ where: { id: card.id } }))!;
    expect(after.reps).toBe(card.reps + 1);
    expect(after.due.getTime()).toBeGreaterThan(card.due.getTime());
    expect(after.state).not.toBe("NEW");

    const log = await prisma.cardReview.findFirst({
      where: { cardId: card.id },
      orderBy: { reviewedAt: "desc" },
    });
    expect(log?.priorReps).toBe(card.reps);
    expect(log?.priorState).toBe(card.state);
  });

  it("restores the exact prior state on undo", async () => {
    const card = (await prisma.flashcard.findFirst({ where: { userId: USER_ID } }))!;

    await gradeCard(USER_ID, card.id, "EASY");
    expect((await undoLastReview(USER_ID, card.id)).ok).toBe(true);

    const restored = (await prisma.flashcard.findUnique({ where: { id: card.id } }))!;
    expect(restored.reps).toBe(card.reps);
    expect(restored.stability).toBe(card.stability);
    expect(restored.difficulty).toBe(card.difficulty);
    expect(restored.due.getTime()).toBe(card.due.getTime());
    expect(restored.state).toBe(card.state);
  });

  it("consumes the log, so undo cannot walk a card back through history", async () => {
    const card = (await prisma.flashcard.findFirst({ where: { userId: USER_ID } }))!;
    await prisma.cardReview.deleteMany({ where: { cardId: card.id } });

    await gradeCard(USER_ID, card.id, "GOOD");
    expect((await undoLastReview(USER_ID, card.id)).ok).toBe(true);
    expect((await undoLastReview(USER_ID, card.id)).ok).toBe(false);
  });

  it("refuses to grade another student's card", async () => {
    const card = (await prisma.flashcard.findFirst({ where: { userId: USER_ID } }))!;
    expect((await gradeCard("someone-else", card.id, "GOOD")).ok).toBe(false);
  });

  it("marks a card a leech after enough lapses and takes it out of the queue", async () => {
    const card = (await prisma.flashcard.findFirst({ where: { userId: USER_ID } }))!;
    await prisma.flashcard.update({
      where: { id: card.id },
      data: { lapses: LEECH_THRESHOLD - 1, state: "REVIEW", stability: 10, difficulty: 5 },
    });

    const outcome = await gradeCard(USER_ID, card.id, "AGAIN");
    expect(outcome.ok && outcome.leech).toBe(true);

    const after = (await prisma.flashcard.findUnique({ where: { id: card.id } }))!;
    expect(after.leech).toBe(true);
    // Eight failures means more repetitions will not fix it (doc 07 §4).
    expect(after.suspendedAt).not.toBeNull();

    const queue = await dueQueueFor(USER_ID, new Date());
    expect(queue.map((entry) => entry.id)).not.toContain(card.id);
  });

  it("hides a suspended card and brings it back on request", async () => {
    const card = (await prisma.flashcard.findFirst({
      where: { userId: USER_ID, suspendedAt: null },
    }))!;

    await setSuspended(USER_ID, card.id, true);
    await prisma.flashcard.update({ where: { id: card.id }, data: { due: new Date(0) } });
    expect((await dueQueueFor(USER_ID, new Date())).map((c) => c.id)).not.toContain(card.id);

    await setSuspended(USER_ID, card.id, false);
    expect((await dueQueueFor(USER_ID, new Date())).map((c) => c.id)).toContain(card.id);
  });
});

describe("retirement", () => {
  it("needs sustained full marks, not one lucky answer", async () => {
    const card = (await prisma.flashcard.findFirst({
      where: { userId: USER_ID, retiredAt: null },
    }))!;
    const specPointId = card.specPointId;

    const link = (await prisma.questionSpecPoint.findFirst({
      where: { specPointId },
      select: { questionId: true, question: { select: { marks: true } } },
    }))!;

    const attempt = (awardedMarks: number) =>
      prisma.questionAttempt.create({
        data: {
          userId: USER_ID,
          questionId: link.questionId,
          context: "PRACTICE",
          awardedMarks,
          maxMarks: link.question.marks,
          markedBy: "AI",
        },
      });

    await prisma.questionAttempt.deleteMany({ where: { userId: USER_ID } });

    await attempt(link.question.marks);
    expect(await retireProvenCards(USER_ID, [specPointId])).toBe(0);

    // A wrong answer since then breaks the run.
    await attempt(0);
    await attempt(link.question.marks);
    expect(await retireProvenCards(USER_ID, [specPointId])).toBe(0);

    for (let i = 0; i < RETIREMENT_THRESHOLD; i += 1) await attempt(link.question.marks);
    expect(await retireProvenCards(USER_ID, [specPointId])).toBeGreaterThan(0);

    expect(
      await prisma.flashcard.count({
        where: { userId: USER_ID, specPointId, retiredAt: null },
      }),
    ).toBe(0);
  });

  it("counts a retired card in the summary, not in the deck", async () => {
    const summary = await deckSummaryFor(USER_ID);
    expect(summary.retired).toBeGreaterThan(0);
    expect(summary.due).toBeLessThanOrEqual(summary.total);
  });
});
