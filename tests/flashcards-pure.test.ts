import { describe, expect, it } from "vitest";

import {
  attemptCanCreateCards,
  CAPS,
  createsCards,
  selectUnderCaps,
  sessionCapFor,
  type CardCandidate,
} from "@/lib/flashcards/caps";
import { buildQueue, DAILY_REVIEW_CAP, type QueueCard } from "@/lib/flashcards/queue";

const T0 = new Date("2026-03-01T09:00:00Z");
const minus = (mins: number) => new Date(T0.getTime() - mins * 60_000);
const plus = (mins: number) => new Date(T0.getTime() + mins * 60_000);

const candidate = (id: string, marks = 1, specPointId = "sp1"): CardCandidate => ({
  markPointId: id,
  specPointId,
  marks,
});

const budget = (over: Partial<Parameters<typeof selectUnderCaps>[1]> = {}) => ({
  existingForQuestion: 0,
  existingInSession: 0,
  existingToday: 0,
  context: "PRACTICE" as const,
  ...over,
});

describe("which attempts create cards", () => {
  it("excludes lesson checks — they teach, they do not punish", () => {
    expect(createsCards("LESSON_CHECK")).toBe(false);
    for (const context of ["PRACTICE", "MINI_MOCK", "FULL_MOCK", "MASTERY_CHECK"]) {
      expect(createsCards(context), context).toBe(true);
    }
  });

  it("needs a real mistake", () => {
    const base = {
      context: "PRACTICE",
      awardedMarks: 1,
      maxMarks: 3,
      missedMarkPointIds: ["mp2"],
    };
    expect(attemptCanCreateCards(base)).toBe(true);

    // Full marks: the deck is a record of mistakes (D11).
    expect(attemptCanCreateCards({ ...base, awardedMarks: 3 })).toBe(false);
    // Nothing missed, so nothing to make a card from.
    expect(attemptCanCreateCards({ ...base, missedMarkPointIds: [] })).toBe(false);
    // A lesson check never does.
    expect(attemptCanCreateCards({ ...base, context: "LESSON_CHECK" })).toBe(false);
    // A question worth nothing cannot be got wrong.
    expect(attemptCanCreateCards({ ...base, maxMarks: 0 })).toBe(false);
  });
});

describe("the anti-flood caps", () => {
  it("never makes more than three cards from one question", () => {
    const many = [1, 2, 3, 4, 5, 6].map((n) => candidate(`mp${n}`));
    expect(selectUnderCaps(many, budget())).toHaveLength(CAPS.perQuestion);
  });

  it("respects cards already made for the same question", () => {
    const many = [1, 2, 3, 4].map((n) => candidate(`mp${n}`));
    expect(selectUnderCaps(many, budget({ existingForQuestion: 2 }))).toHaveLength(1);
    expect(selectUnderCaps(many, budget({ existingForQuestion: 3 }))).toHaveLength(0);
  });

  it("uses a bigger session cap for a mock than for practice", () => {
    expect(sessionCapFor("PRACTICE")).toBe(CAPS.perPracticeSession);
    expect(sessionCapFor("MASTERY_CHECK")).toBe(CAPS.perPracticeSession);
    expect(sessionCapFor("FULL_MOCK")).toBe(CAPS.perMock);
    expect(sessionCapFor("MINI_MOCK")).toBe(CAPS.perMock);
  });

  it("stops at the session cap", () => {
    const many = [1, 2, 3].map((n) => candidate(`mp${n}`));
    expect(
      selectUnderCaps(many, budget({ existingInSession: CAPS.perPracticeSession - 1 })),
    ).toHaveLength(1);
    expect(
      selectUnderCaps(many, budget({ existingInSession: CAPS.perPracticeSession })),
    ).toHaveLength(0);
  });

  it("stops at the daily cap however good the session was going", () => {
    const many = [1, 2, 3].map((n) => candidate(`mp${n}`));
    expect(selectUnderCaps(many, budget({ existingToday: CAPS.perDay - 2 }))).toHaveLength(2);
    expect(selectUnderCaps(many, budget({ existingToday: CAPS.perDay }))).toHaveLength(0);
  });

  it("keeps the most valuable points when it has to choose", () => {
    const chosen = selectUnderCaps(
      [candidate("mp1", 1), candidate("mp2", 3), candidate("mp3", 2), candidate("mp4", 1)],
      budget(),
    );
    expect(chosen.map((c) => c.markPointId)).toEqual(["mp2", "mp3", "mp1"]);
  });

  it("is deterministic when values tie", () => {
    const tied = [candidate("mpC"), candidate("mpA"), candidate("mpB"), candidate("mpD")];
    expect(selectUnderCaps(tied, budget()).map((c) => c.markPointId)).toEqual([
      "mpA",
      "mpB",
      "mpC",
    ]);
  });

  it("never makes two cards for the same mark point", () => {
    const duplicated = [candidate("mp1"), candidate("mp1"), candidate("mp2")];
    expect(selectUnderCaps(duplicated, budget()).map((c) => c.markPointId)).toEqual([
      "mp1",
      "mp2",
    ]);
  });

  /** The scenario the caps exist for (doc 07 §2). */
  it("survives a catastrophic mock with every question wrong", () => {
    let today = 0;
    let session = 0;
    let created = 0;

    // Twenty questions, three missed points each.
    for (let q = 0; q < 20; q += 1) {
      const missed = [1, 2, 3].map((n) => candidate(`q${q}-mp${n}`));
      const chosen = selectUnderCaps(missed, {
        existingForQuestion: 0,
        existingInSession: session,
        existingToday: today,
        context: "FULL_MOCK",
      });
      created += chosen.length;
      session += chosen.length;
      today += chosen.length;
    }

    expect(created).toBe(CAPS.perMock);
    expect(created).toBeLessThanOrEqual(CAPS.perDay);
  });
});

describe("the review queue", () => {
  const card = (
    id: string,
    state: QueueCard["state"],
    due: Date,
    subjectId = "bio",
  ): QueueCard => ({ id, state, due, subjectId });

  it("leaves out cards that are not due yet", () => {
    const queue = buildQueue(
      [card("a", "REVIEW", minus(10)), card("b", "REVIEW", plus(10))],
      T0,
    );
    expect(queue.map((c) => c.id)).toEqual(["a"]);
  });

  it("puts fragile relearning cards first", () => {
    const queue = buildQueue(
      [
        card("review", "REVIEW", minus(1000)),
        card("relearn", "RELEARNING", minus(5)),
        card("learn", "LEARNING", minus(1)),
      ],
      T0,
    );
    expect(queue[0]!.id).toBe("relearn");
    expect(queue.slice(0, 2).map((c) => c.id)).toContain("learn");
    expect(queue.at(-1)!.id).toBe("review");
  });

  it("puts the most overdue review card before a barely due one", () => {
    const queue = buildQueue(
      [card("fresh", "REVIEW", minus(1)), card("ancient", "REVIEW", minus(60 * 24 * 30))],
      T0,
    );
    expect(queue[0]!.id).toBe("ancient");
  });

  it("interleaves new cards at most one in four", () => {
    const established = Array.from({ length: 12 }, (_, i) =>
      card(`r${i}`, "REVIEW", minus(100 - i)),
    );
    const fresh = Array.from({ length: 12 }, (_, i) => card(`n${i}`, "NEW", minus(1)));

    const queue = buildQueue([...established, ...fresh], T0);
    const newPositions = queue
      .map((c, index) => (c.state === "NEW" ? index : -1))
      .filter((index) => index !== -1);

    // No two new cards adjacent, and never more than a quarter of the queue.
    for (let i = 1; i < newPositions.length; i += 1) {
      expect(newPositions[i]! - newPositions[i - 1]!).toBeGreaterThan(1);
    }
    expect(newPositions.length).toBeLessThanOrEqual(Math.ceil(queue.length / 4));
  });

  it("still serves a first session that is nothing but new cards", () => {
    const fresh = Array.from({ length: 5 }, (_, i) => card(`n${i}`, "NEW", minus(1)));
    expect(buildQueue(fresh, T0)).toHaveLength(5);
  });

  it("breaks up long runs of one subject", () => {
    const cards = [
      ...Array.from({ length: 6 }, (_, i) => card(`bio${i}`, "REVIEW", minus(100 - i), "bio")),
      ...Array.from({ length: 6 }, (_, i) => card(`chem${i}`, "REVIEW", minus(94 - i), "chem")),
    ];
    const queue = buildQueue(cards, T0);

    let longestRun = 1;
    let run = 1;
    for (let i = 1; i < queue.length; i += 1) {
      run = queue[i]!.subjectId === queue[i - 1]!.subjectId ? run + 1 : 1;
      longestRun = Math.max(longestRun, run);
    }
    // Twelve blocked cards would be a run of six; interleaving must beat that.
    expect(longestRun).toBeLessThan(6);
  });

  it("caps the session rather than presenting a wall", () => {
    const many = Array.from({ length: 200 }, (_, i) => card(`c${i}`, "REVIEW", minus(500 - i)));
    expect(buildQueue(many, T0)).toHaveLength(DAILY_REVIEW_CAP);
    expect(buildQueue(many, T0, 10)).toHaveLength(10);
  });

  it("returns nothing when nothing is due, rather than inventing work", () => {
    expect(buildQueue([card("a", "REVIEW", plus(60))], T0)).toEqual([]);
    expect(buildQueue([], T0)).toEqual([]);
  });

  it("is deterministic", () => {
    const cards = [
      card("b", "REVIEW", minus(10)),
      card("a", "REVIEW", minus(10)),
      card("c", "NEW", minus(1)),
    ];
    expect(buildQueue(cards, T0).map((c) => c.id)).toEqual(
      buildQueue([...cards].reverse(), T0).map((c) => c.id),
    );
  });
});
