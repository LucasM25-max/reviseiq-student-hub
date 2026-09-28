/**
 * Rolling spec point mastery.
 *
 * An exponential moving average of proportion-of-marks rather than a running total,
 * so recent work counts for more and a bad week in September does not follow a
 * student to May. Today reads this to decide what to schedule.
 *
 * Pure: the arithmetic is separated from the write so it can be tested exhaustively
 * without a database.
 */

/**
 * How much a single new attempt moves the average.
 *
 * 0.4 settles after about five attempts, which matches how a topic is actually
 * revisited — fast enough that improvement shows up in Today within a week, slow
 * enough that one careless answer does not wipe out a good record.
 */
export const MASTERY_ALPHA = 0.4;

/**
 * Attempts the marker is not confident about move mastery less.
 *
 * A self-marked or word-matched attempt is evidence, but weaker evidence than a real
 * mark, and treating them identically would let a student talk their own mastery up.
 */
export const WEIGHT_BY_SOURCE: Record<string, number> = {
  AUTO: 1,
  AI: 1,
  AI_FALLBACK: 0.5,
  SELF: 0.5,
};

export function weightFor(markedBy: string, provisional = false): number {
  const base = WEIGHT_BY_SOURCE[markedBy] ?? 0.5;
  return provisional ? base * 0.5 : base;
}

/**
 * The next mastery value.
 *
 * `previous` is null for a spec point never seen before, in which case the first
 * result stands on its own rather than being dragged up from zero — a student who
 * gets 3/3 first time is not 40% masterful.
 */
export function nextMastery(
  previous: number | null,
  awardedMarks: number,
  maxMarks: number,
  weight = 1,
): number {
  if (maxMarks <= 0) return clamp01(previous ?? 0);

  const score = clamp01(awardedMarks / maxMarks);

  if (previous === null) return round(score);

  const alpha = clamp01(MASTERY_ALPHA * clamp01(weight));
  return round(previous + alpha * (score - previous));
}

const clamp01 = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), 1);
};

const round = (value: number): number => Math.round(clamp01(value) * 10_000) / 10_000;

/** The RAG band a mastery value corresponds to, for display and for Today. */
export function masteryBand(mastery: number): "RED" | "AMBER" | "GREEN" {
  if (mastery >= 0.8) return "GREEN";
  if (mastery >= 0.5) return "AMBER";
  return "RED";
}
