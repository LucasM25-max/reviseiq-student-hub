/**
 * Choosing the shape of the day (doc 05 §2).
 *
 * Mode comes from year group and the nearest relevant exam, then the calendar period
 * overrides it. It changes the whole character of the plan, so it is decided once, up
 * front, rather than implied by scoring.
 */

import type {
  CalendarPeriod,
  Enrolment,
  PlanMode,
  PlannerProfile,
  RagEntry,
} from "@/lib/today/types";

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days from `now` to `date`, floored at zero for anything already past. */
export function daysUntil(date: Date, now: Date): number {
  return Math.max(0, Math.ceil((date.getTime() - now.getTime()) / DAY_MS));
}

/** The soonest exam the student has, across every subject. Null when none are set. */
export function nextExamDate(enrolments: Enrolment[], now: Date): Date | null {
  const upcoming = enrolments
    .flatMap((enrolment) => enrolment.examDates.map((exam) => exam.date))
    .filter((date) => date.getTime() >= now.getTime())
    .sort((a, b) => a.getTime() - b.getTime());

  return upcoming[0] ?? null;
}

export function notLearntShare(rag: RagEntry[]): number {
  if (rag.length === 0) return 0;
  return rag.filter((entry) => entry.value === "NOT_LEARNT").length / rag.length;
}

/**
 * The plan mode for today.
 *
 * Year 10 is a genuinely different product (D26): they are not revising, they are
 * keeping up, and applying the Year 11 model to them produces an app that nags about
 * exams twenty months away. So year group wins over the countdown — except once they
 * are actually inside an exam window, where the calendar takes over for everyone.
 */
export function selectMode(input: {
  now: Date;
  profile: PlannerProfile;
  calendarPeriod: CalendarPeriod;
  enrolments: Enrolment[];
  rag: RagEntry[];
}): PlanMode {
  // The calendar is the strongest signal there is: it describes what today *is*.
  if (input.calendarPeriod.kind === "STUDY_LEAVE") return "STUDY_LEAVE";

  const exam = nextExamDate(input.enrolments, input.now);

  if (input.profile.yearGroup === "YEAR_10") {
    // Their own end-of-year exams still matter when they are genuinely close.
    if (exam && daysUntil(exam, input.now) <= 14) return "FINAL_SPRINT";
    if (exam && daysUntil(exam, input.now) <= 28) return "EXAM_FOCUS";
    return "KEEPING_PACE";
  }

  // No dates set: a sensible default plus a standing nudge to add them.
  if (!exam) return "BALANCED";

  const days = daysUntil(exam, input.now);

  if (days < 14) return "FINAL_SPRINT";
  if (days <= 28) return "EXAM_FOCUS";
  if (days <= 56) return "BALANCED";

  // More than eight weeks out, or a mountain of unlearnt content.
  return notLearntShare(input.rag) >= 0.4 ? "LEARNING_HEAVY" : "LEARNING_HEAVY";
}

/**
 * How long today's session should be.
 *
 * A holiday is not a school day: the holiday figure applies, and the long contiguous
 * blocks are what make full papers possible at all.
 */
export function targetMinutesFor(input: {
  profile: PlannerProfile;
  calendarPeriod: CalendarPeriod;
  /** An explicit "I've only got N minutes" overrides everything (D10). */
  override?: number | null;
}): number {
  if (input.override != null && input.override > 0) return Math.min(input.override, 600);

  if (input.calendarPeriod.minutesPerDay != null && input.calendarPeriod.minutesPerDay > 0) {
    return input.calendarPeriod.minutesPerDay;
  }

  const onHoliday =
    input.calendarPeriod.kind === "HOLIDAY" || input.calendarPeriod.kind === "HALF_TERM";

  const minutes = onHoliday
    ? input.profile.holidayGoalMinutes || input.profile.dailyGoalMinutes
    : input.profile.dailyGoalMinutes;

  return Math.max(5, minutes);
}

/**
 * Whether the plan should be suppressed today.
 *
 * Revising hard the evening before the next paper is fine. Being handed a ninety
 * minute plan on the morning of one is not.
 */
export function suppressionFor(input: {
  profile: PlannerProfile;
  calendarPeriod: CalendarPeriod;
}): { reason: "EXAM_TODAY" | "SCHEDULING_OFF"; message: string } | null {
  if (!input.profile.schedulingEnabled) {
    return {
      reason: "SCHEDULING_OFF",
      message: "That's your exams done. Everything here stays available if you want it.",
    };
  }

  if (input.calendarPeriod.examToday) {
    return {
      reason: "EXAM_TODAY",
      message: "Good luck today. Nothing scheduled — go and sit it.",
    };
  }

  return null;
}
