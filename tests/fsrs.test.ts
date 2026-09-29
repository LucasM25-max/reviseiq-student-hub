import { describe, expect, it } from "vitest";

import {
  formatInterval,
  FSRS_PARAMETERS,
  minutesUntil,
  newCard,
  preview,
  RATINGS,
  review,
  type RatingName,
  type SchedulerState,
} from "@/lib/fsrs";

const T0 = new Date("2026-01-01T09:00:00Z");
const plusDays = (from: Date, days: number) =>
  new Date(from.getTime() + days * 24 * 60 * 60 * 1000);

describe("parameters", () => {
  it("targets 90% retention and caps intervals at a year", () => {
    // Beyond a year is wasted scheduling for an exam with a fixed date (doc 07 §1).
    expect(FSRS_PARAMETERS.request_retention).toBe(0.9);
    expect(FSRS_PARAMETERS.maximum_interval).toBe(365);
    expect(FSRS_PARAMETERS.enable_fuzz).toBe(true);
  });
});

describe("newCard", () => {
  it("is due immediately, unseen and unstable", () => {
    const card = newCard(T0);
    expect(card.state).toBe("NEW");
    expect(card.due.getTime()).toBe(T0.getTime());
    expect(card.reps).toBe(0);
    expect(card.lapses).toBe(0);
    expect(card.lastReview).toBeNull();
  });
});

describe("review", () => {
  it("moves a new card out of NEW on any rating", () => {
    for (const rating of RATINGS) {
      const next = review(newCard(T0), rating, T0);
      expect(next.state, rating).not.toBe("NEW");
      expect(next.reps, rating).toBe(1);
      expect(next.lastReview?.getTime(), rating).toBe(T0.getTime());
    }
  });

  it("always schedules into the future, never the past", () => {
    // The single property that stops a card looping forever inside one session.
    let state = newCard(T0);
    let now = T0;

    for (let step = 0; step < 40; step += 1) {
      const rating = RATINGS[step % RATINGS.length]!;
      state = review(state, rating, now);
      expect(state.due.getTime(), `step ${step} (${rating})`).toBeGreaterThan(now.getTime());
      now = state.due;
    }
  });

  it("never lets stability or difficulty go negative", () => {
    let state = newCard(T0);
    let now = T0;

    for (let step = 0; step < 60; step += 1) {
      // Worst case for stability: fail everything, forever.
      state = review(state, step % 3 === 0 ? "AGAIN" : "HARD", now);
      expect(state.stability, `step ${step}`).toBeGreaterThanOrEqual(0);
      expect(state.difficulty, `step ${step}`).toBeGreaterThanOrEqual(0);
      now = plusDays(now, 1);
    }
  });

  it("orders the four ratings: Again ≤ Hard ≤ Good ≤ Easy", () => {
    // Establish a mature review card first — the ordering is clearest there.
    let state = newCard(T0);
    let now = T0;
    for (let i = 0; i < 4; i += 1) {
      state = review(state, "GOOD", now);
      now = state.due;
    }
    expect(state.state).toBe("REVIEW");

    const options = preview(state, now);
    const due = (rating: RatingName) => options[rating].due.getTime();

    expect(due("AGAIN")).toBeLessThanOrEqual(due("HARD"));
    expect(due("HARD")).toBeLessThanOrEqual(due("GOOD"));
    expect(due("GOOD")).toBeLessThanOrEqual(due("EASY"));
  });

  it("counts a lapse on Again from a review card, and relearns it", () => {
    let state = newCard(T0);
    let now = T0;
    for (let i = 0; i < 4; i += 1) {
      state = review(state, "GOOD", now);
      now = state.due;
    }

    const lapsesBefore = state.lapses;
    const lapsed = review(state, "AGAIN", now);

    expect(lapsed.lapses).toBe(lapsesBefore + 1);
    expect(lapsed.state).toBe("RELEARNING");
  });

  it("does not count a lapse for Good", () => {
    let state = newCard(T0);
    let now = T0;
    for (let i = 0; i < 4; i += 1) {
      state = review(state, "GOOD", now);
      now = state.due;
    }
    expect(review(state, "GOOD", now).lapses).toBe(state.lapses);
  });

  it("respects the one-year ceiling however well the card is known", () => {
    let state = newCard(T0);
    let now = T0;

    // Twenty consecutive Easy ratings would run away without maximum_interval.
    for (let i = 0; i < 20; i += 1) {
      state = review(state, "EASY", now);
      now = state.due;
      expect(state.scheduledDays).toBeLessThanOrEqual(FSRS_PARAMETERS.maximum_interval);
    }
  });

  it("is deterministic for the same inputs", () => {
    const state = newCard(T0);
    // Fuzz is seeded from the card, not from a clock or a random source.
    expect(review(state, "GOOD", T0)).toEqual(review(state, "GOOD", T0));
  });

  it("recovers a lapsed card when it is answered well again", () => {
    let state = newCard(T0);
    let now = T0;
    for (let i = 0; i < 4; i += 1) {
      state = review(state, "GOOD", now);
      now = state.due;
    }
    const mature = state.stability;

    state = review(state, "AGAIN", now);
    now = state.due;
    expect(state.stability).toBeLessThan(mature);

    for (let i = 0; i < 4; i += 1) {
      state = review(state, "GOOD", now);
      now = state.due;
    }
    expect(state.state).toBe("REVIEW");
    expect(state.stability).toBeGreaterThan(0);
  });
});

/**
 * The invariant that matters most, given cards are created automatically: a deck has
 * to reach a steady state rather than growing without bound (doc 07 §8).
 */
describe("a synthetic student over 180 days", () => {
  it("settles into a manageable daily load rather than growing forever", () => {
    const DAYS = 180;
    const DECK = 120;

    // A student who knows most things and struggles with a fifth of them.
    const cards: SchedulerState[] = Array.from({ length: DECK }, () => newCard(T0));
    const hard = new Set(Array.from({ length: DECK }, (_, i) => i).filter((i) => i % 5 === 0));

    const dailyLoad: number[] = [];

    for (let day = 0; day < DAYS; day += 1) {
      const now = plusDays(T0, day);
      let reviewed = 0;

      for (let i = 0; i < cards.length; i += 1) {
        const card = cards[i]!;
        if (card.due.getTime() > now.getTime()) continue;

        // The daily cap (doc 07 §3): the rest wait rather than forming a wall.
        if (reviewed >= 40) break;

        const rating: RatingName = hard.has(i) ? (day % 3 === 0 ? "AGAIN" : "HARD") : "GOOD";
        cards[i] = review(card, rating, now);
        reviewed += 1;
      }

      dailyLoad.push(reviewed);
    }

    const firstMonth = dailyLoad.slice(0, 30).reduce((a, b) => a + b, 0) / 30;
    const lastMonth = dailyLoad.slice(-30).reduce((a, b) => a + b, 0) / 30;

    // The load must fall as the deck matures, not climb.
    expect(lastMonth).toBeLessThan(firstMonth);
    // And it must not be pinned at the cap, which would mean an unclearable backlog.
    expect(lastMonth).toBeLessThan(40);

    const overdue = cards.filter((card) => card.due.getTime() < plusDays(T0, DAYS).getTime());
    expect(overdue.length).toBeLessThan(DECK);

    // Every card has genuinely been scheduled, not abandoned.
    expect(cards.every((card) => card.reps > 0)).toBe(true);
  });
});

describe("interval formatting", () => {
  it("reads the way a student thinks about time", () => {
    expect(formatInterval(T0, T0)).toBe("now");
    expect(formatInterval(new Date(T0.getTime() + 10 * 60_000), T0)).toBe("10 min");
    expect(formatInterval(new Date(T0.getTime() + 3 * 3_600_000), T0)).toBe("3 hr");
    expect(formatInterval(plusDays(T0, 1), T0)).toBe("1 day");
    expect(formatInterval(plusDays(T0, 9), T0)).toBe("9 days");
    expect(formatInterval(plusDays(T0, 60), T0)).toBe("2 mo");
    expect(formatInterval(plusDays(T0, 400), T0)).toBe("1 yr");
  });

  it("never shows a negative interval for an overdue card", () => {
    expect(minutesUntil(plusDays(T0, -5), T0)).toBe(0);
    expect(formatInterval(plusDays(T0, -5), T0)).toBe("now");
  });
});
