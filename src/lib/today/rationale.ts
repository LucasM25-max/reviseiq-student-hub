/**
 * Why a task is on the list (doc 05 §9).
 *
 * Trust in the plan is entirely downstream of the student understanding why they were
 * given something, so every task carries one plain sentence. Templates, never
 * AI-generated: they must be instant, free and deterministic.
 *
 * Tone follows D33 — state a reason, never apply pressure.
 */

import { daysUntil } from "@/lib/today/mode";
import type { Candidate, SchoolTest } from "@/lib/today/types";

export type RationaleContext = {
  now: Date;
  dominant: string;
  dueCards: number;
  maxOverdueDays: number;
  /** The exam this task's paper belongs to, when there is one. */
  examDate: Date | null;
  schoolTest: SchoolTest | null;
  schoolTestSubject: string | null;
  daysSinceTouched: number | null;
  gateJustOpened: boolean;
  holidayBlock: boolean;
  studyLeaveNext: string | null;
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const weekday = (date: Date) =>
  date.toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });

export function rationaleFor(task: Candidate, context: RationaleContext): string {
  // Study leave and exam-day context outrank everything: it is what today is about.
  if (context.studyLeaveNext) {
    return `${context.studyLeaveNext} is next — this is the work that moves the needle.`;
  }

  if (task.type === "FLASHCARDS") {
    const count = context.dueCards;
    if (context.maxOverdueDays >= 3) {
      return `${plural(count, "card")} due, some for ${plural(context.maxOverdueDays, "day")} — the fastest win of the day.`;
    }
    return `${plural(count, "card")} due — the fastest win of the day.`;
  }

  /*
   * A test in the next few days is the most useful true thing we can say, whatever
   * the scoring thought was dominant. A Red topic that is also on Thursday's test
   * should say so: "you marked this Red" is true but it is not why it is today, and
   * D25 exists precisely because the near deadline is what gets acted on.
   */
  const testIsImminent =
    context.schoolTest !== null && daysUntil(context.schoolTest.date, context.now) <= 3;

  if ((context.dominant === "schoolTest" || testIsImminent) && context.schoolTest) {
    const days = daysUntil(context.schoolTest.date, context.now);
    const when =
      days === 0 ? "today" : days === 1 ? "tomorrow" : `on ${weekday(context.schoolTest.date)}`;
    const subject = context.schoolTestSubject ?? "your";
    return `This is on your ${subject} test ${when}.`;
  }

  if (context.gateJustOpened && task.type === "LESSON") {
    return "Everything else is Green — time for something new.";
  }

  if (context.dominant === "coverageDebt") {
    return "You've never answered a question on this — let's find out where you stand.";
  }

  if (context.dominant === "forgettingRisk" && context.daysSinceTouched != null) {
    return `You haven't touched this in ${plural(context.daysSinceTouched, "day")}.`;
  }

  if (context.dominant === "masteryGap") {
    return "Your last answers here were shaky — worth another pass.";
  }

  if (context.dominant === "urgency" && context.examDate) {
    const days = daysUntil(context.examDate, context.now);
    return `This is on a paper you sit in ${plural(days, "day")}.`;
  }

  if (context.dominant === "rag") {
    const ragTerm = task.terms.rag ?? 0;
    if (ragTerm >= 0.9) {
      return context.examDate
        ? `You marked this Red, and your exam is in ${plural(daysUntil(context.examDate, context.now), "day")}.`
        : "You marked this Red.";
    }
    if (ragTerm <= 0.25) return "Quick check that this is still solid.";
    return "You marked this Amber — closing the gaps.";
  }

  if (context.holidayBlock && task.estMinutes >= 45) {
    return "You've got a longer stretch today — good time for something substantial.";
  }

  // Deliberate last resort rather than an empty string: a task with no reason shown
  // is worse than a plain one.
  return "Next up on your plan.";
}
