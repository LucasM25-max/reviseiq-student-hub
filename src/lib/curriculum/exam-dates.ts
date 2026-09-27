import type { SubjectCodeValue } from "@/lib/curriculum/taxonomy";

/**
 * Estimated exam dates.
 *
 * Asking a fifteen-year-old to type six exact dates during sign-up is a good way to lose
 * them, and most won't have the timetable yet. Instead they pick an exam series and we
 * store plausible estimates flagged `confirmed: false`; Settings lets them enter the
 * real dates later, and Today nudges them to once the series gets close.
 *
 * The estimates follow AQA's usual shape: science Paper 1s across the second half of
 * May, Paper 2s across the first half of June, subjects staggered so two papers never
 * land on the same day.
 */

/**
 * Day offsets from the Monday that opens each exam window, staggering the three
 * sciences across Monday, Wednesday and Friday. Kept below 5 so an estimate can never
 * land on a weekend, which no exam board would ever do.
 */
const OFFSETS: Record<SubjectCodeValue, { paper1: number; paper2: number }> = {
  BIOLOGY: { paper1: 0, paper2: 0 },
  CHEMISTRY: { paper1: 2, paper2: 2 },
  PHYSICS: { paper1: 4, paper2: 4 },
};

/** Monday of the third full week of May — where AQA's science papers usually begin. */
function paperOneAnchor(year: number): Date {
  return nthWeekday(year, 4, 1, 3);
}

/** Monday of the first full week of June. */
function paperTwoAnchor(year: number): Date {
  return nthWeekday(year, 5, 1, 1);
}

/** The nth occurrence of `weekday` (0 = Sunday) in the given month, as a UTC date. */
function nthWeekday(year: number, monthIndex: number, weekday: number, nth: number): Date {
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const shift = (weekday - first.getUTCDay() + 7) % 7;
  return new Date(Date.UTC(year, monthIndex, 1 + shift + (nth - 1) * 7));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

export type EstimatedExamDate = { paper: number; date: Date };

export function estimatedExamDates(
  subject: SubjectCodeValue,
  year: number,
): EstimatedExamDate[] {
  const offset = OFFSETS[subject];
  return [
    { paper: 1, date: addDays(paperOneAnchor(year), offset.paper1) },
    { paper: 2, date: addDays(paperTwoAnchor(year), offset.paper2) },
  ];
}

/**
 * The exam series a student can pick from, given today's date.
 *
 * GCSE results are published in August, so from September onwards the next sensible
 * series is the following summer.
 */
export function examSeriesOptions(now: Date = new Date()): number[] {
  const year = now.getUTCFullYear();
  // After the end of June, this summer's exams are done with.
  const nextSeries = now.getUTCMonth() > 5 ? year + 1 : year;
  return [nextSeries, nextSeries + 1];
}

/** Whole days from `from` until the first paper — negative once it has passed. */
export function daysUntil(date: Date, from: Date = new Date()): number {
  const startOfDay = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  return Math.round((date.getTime() - startOfDay) / 86_400_000);
}
