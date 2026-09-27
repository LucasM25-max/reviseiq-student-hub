/**
 * Time on task.
 *
 * Today packs a revision plan out of estimated minutes, and those estimates are only
 * worth anything if they are checked against what lessons actually take. So each advance
 * through a lesson contributes the time the student spent on the step they just left.
 *
 * Measuring it needs a start point. Reading it from `LessonProgress.lastActivityAt` would
 * miss the first step entirely — there is no row until the student interacts — so the
 * step's render time travels in a hidden form field instead. That is client-supplied, and
 * therefore not trusted: the value is parsed strictly, rejected if it is in the future,
 * and clamped to a per-step ceiling. The worst a forged field can do is add fifteen
 * minutes to the student's own record of their own study time, which is not an incentive
 * anyone has, because ReviseIQ has no XP, no levels and no leaderboard (D35).
 */

/**
 * A step that has been open for longer than this was almost certainly abandoned — a tab
 * left behind, a laptop shut. Counting it would poison the estimates Today depends on.
 */
export const MAX_STEP_SECONDS = 15 * 60;

/** Anything under this is a double-submit or a misclick, not study. */
export const MIN_STEP_SECONDS = 1;

/**
 * Seconds between a step opening and the student leaving it, clamped to something
 * believable. Returns 0 rather than throwing for anything it cannot make sense of.
 */
export function elapsedSecondsSince(
  startedAt: Date | string | null | undefined,
  now: Date = new Date(),
  cap: number = MAX_STEP_SECONDS,
): number {
  if (startedAt == null) return 0;

  const start = startedAt instanceof Date ? startedAt : new Date(startedAt);
  if (Number.isNaN(start.getTime())) return 0;

  const deltaMs = now.getTime() - start.getTime();

  // Negative means the clocks disagree or the field was forged forwards. Either way
  // there is nothing to count.
  if (deltaMs < 0) return 0;

  const seconds = Math.floor(deltaMs / 1000);
  if (seconds < MIN_STEP_SECONDS) return 0;
  return Math.min(seconds, cap);
}

/** Adds a step's time to a running total, keeping the total a non-negative integer. */
export function accumulateSeconds(totalSeconds: number, stepSeconds: number): number {
  const total = Number.isFinite(totalSeconds) ? Math.max(Math.trunc(totalSeconds), 0) : 0;
  const step = Number.isFinite(stepSeconds) ? Math.max(Math.trunc(stepSeconds), 0) : 0;
  return total + step;
}

/**
 * "12 minutes", "1 minute", "under a minute". Used in the lesson header and on the Learn
 * index, where a bare second count reads like instrument output rather than information.
 */
export function formatDuration(totalSeconds: number): string {
  const seconds = Number.isFinite(totalSeconds) ? Math.max(Math.trunc(totalSeconds), 0) : 0;
  if (seconds < 60) return "under a minute";

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const hourPart = `${hours} hour${hours === 1 ? "" : "s"}`;
  return rest === 0 ? hourPart : `${hourPart} ${rest} min`;
}
