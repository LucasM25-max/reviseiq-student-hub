/**
 * The school year (D24).
 *
 * Term dates vary by a fortnight between counties, so these are a starting point a
 * student edits rather than a truth the app asserts. A wrong holiday is worse than
 * no holiday: it silently changes how much work someone is handed on a school night.
 *
 * Pure, so the period resolution and the seeding arithmetic are both testable.
 */

import type { CalendarKind } from "@/lib/today/types";

export type PeriodRow = {
  kind: CalendarKind;
  startDate: Date;
  endDate: Date;
  minutesPerDay?: number | null;
  label?: string | null;
};

const utc = (year: number, month: number, day: number): Date =>
  new Date(Date.UTC(year, month - 1, day));

/**
 * England's usual shape for an academic year starting in September.
 *
 * Deliberately approximate — the last week of each month rather than a real
 * calendar — because it exists to be corrected. Anything more precise would imply a
 * confidence the app has not earned.
 */
export function defaultEnglandYear(academicStartYear: number): PeriodRow[] {
  const y = academicStartYear;
  const next = y + 1;

  return [
    { kind: "TERM", startDate: utc(y, 9, 1), endDate: utc(y, 10, 24), label: "Autumn 1" },
    {
      kind: "HALF_TERM",
      startDate: utc(y, 10, 25),
      endDate: utc(y, 11, 2),
      label: "October half term",
    },
    { kind: "TERM", startDate: utc(y, 11, 3), endDate: utc(y, 12, 19), label: "Autumn 2" },
    {
      kind: "HOLIDAY",
      startDate: utc(y, 12, 20),
      endDate: utc(next, 1, 4),
      label: "Christmas",
    },
    { kind: "TERM", startDate: utc(next, 1, 5), endDate: utc(next, 2, 13), label: "Spring 1" },
    {
      kind: "HALF_TERM",
      startDate: utc(next, 2, 14),
      endDate: utc(next, 2, 22),
      label: "February half term",
    },
    { kind: "TERM", startDate: utc(next, 2, 23), endDate: utc(next, 3, 27), label: "Spring 2" },
    {
      kind: "HOLIDAY",
      startDate: utc(next, 3, 28),
      endDate: utc(next, 4, 12),
      label: "Easter",
    },
    { kind: "TERM", startDate: utc(next, 4, 13), endDate: utc(next, 5, 22), label: "Summer 1" },
    {
      kind: "HALF_TERM",
      startDate: utc(next, 5, 23),
      endDate: utc(next, 5, 31),
      label: "May half term",
    },
    { kind: "TERM", startDate: utc(next, 6, 1), endDate: utc(next, 7, 22), label: "Summer 2" },
    {
      kind: "HOLIDAY",
      startDate: utc(next, 7, 23),
      endDate: utc(next, 8, 31),
      label: "Summer holiday",
    },
  ];
}

/** The academic year a date falls in: September to August. */
export function academicYearOf(date: Date): number {
  const year = date.getUTCFullYear();
  return date.getUTCMonth() >= 8 ? year : year - 1;
}

/**
 * Which period a date falls in.
 *
 * Study leave and exam season win over the term they overlap, because they describe
 * what the student is actually doing. Among equals the latest start wins, so an
 * edit laid over a default takes effect without having to delete anything.
 */
export function periodFor(date: Date, periods: PeriodRow[]): PeriodRow | null {
  const day = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

  const covering = periods.filter(
    (period) => period.startDate.getTime() <= day && day <= period.endDate.getTime(),
  );

  if (covering.length === 0) return null;

  const rank: Record<CalendarKind, number> = {
    EXAM_SEASON: 4,
    STUDY_LEAVE: 3,
    HOLIDAY: 2,
    HALF_TERM: 2,
    TERM: 1,
  };

  return [...covering].sort(
    (a, b) => rank[b.kind] - rank[a.kind] || b.startDate.getTime() - a.startDate.getTime(),
  )[0]!;
}

/** True when a period boundary falls between two days, for the one-off prompt. */
export function crossedBoundary(previous: Date, now: Date, periods: PeriodRow[]): boolean {
  const before = periodFor(previous, periods);
  const after = periodFor(now, periods);
  if (!before || !after) return before !== after;
  return before.kind !== after.kind || before.startDate.getTime() !== after.startDate.getTime();
}
