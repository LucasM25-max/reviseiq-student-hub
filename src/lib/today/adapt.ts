/**
 * Adaptive re-ranking (doc 05 §8).
 *
 * A plan that reshuffles under the student's feet is unsettling, so the default is
 * to leave it alone. The list only changes when performance was genuinely
 * *surprising* — far below or far above what the plan assumed — because that is the
 * only case where the remaining tasks are aimed at the wrong thing.
 *
 * Pure, so the thresholds are testable without a database.
 */

export const SURPRISE = {
  /** Scored this badly: the rest of the plan is pitched too high. */
  low: 0.4,
  /** Scored this well: the rest of the plan is pitched too low. */
  high: 0.9,
} as const;

export type Surprise = "STRUGGLED" | "BREEZED" | null;

/**
 * Whether a just-marked attempt should disturb the rest of the day.
 *
 * Deliberately blind to single one-markers: getting one mark wrong is noise, and
 * rebuilding someone's afternoon over it would be the app twitching.
 */
export function surpriseFrom(awardedMarks: number, maxMarks: number): Surprise {
  if (!Number.isFinite(awardedMarks) || !Number.isFinite(maxMarks)) return null;
  if (maxMarks < 2) return null;

  const share = Math.min(Math.max(awardedMarks / maxMarks, 0), 1);

  if (share < SURPRISE.low) return "STRUGGLED";
  if (share > SURPRISE.high) return "BREEZED";
  return null;
}

export type Reaction = { drop: string[]; message: string };

/**
 * What a surprise means for the rest of the plan.
 *
 * Struggling drops the remaining questions on that sub-topic — more questions on
 * something you just scored 1/6 on is not the next right thing. Breezing drops the
 * revision, which has plainly already done its job.
 */
export function reactionTo(surprise: Surprise): Reaction | null {
  if (surprise === "STRUGGLED") {
    return {
      drop: ["QUESTIONS", "DIAGNOSTIC"],
      message:
        "That one was tough — left the notes on this topic and dropped the extra questions.",
    };
  }

  if (surprise === "BREEZED") {
    return {
      drop: ["NOTES", "BLURT"],
      message: "You clearly know this — dropped the revision and kept the questions.",
    };
  }

  return null;
}
