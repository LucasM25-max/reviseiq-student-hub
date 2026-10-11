/**
 * The planner (doc 05).
 *
 * One pure function: a snapshot in, a plan out. No I/O, no clock of its own, no
 * randomness — the same input always produces the same plan, which is both a stated
 * invariant and the only way a scheduler this size stays debuggable.
 */

import { generateCandidates } from "@/lib/today/candidates";
import { gateMessage } from "@/lib/today/gate";
import { daysUntil, selectMode, suppressionFor } from "@/lib/today/mode";
import { packSession, schoolTestCap, shapeSession } from "@/lib/today/pack";
import { rationaleFor } from "@/lib/today/rationale";
import { dominantTerm } from "@/lib/today/scoring";
import { DAY_MS } from "@/lib/today/mode";
import { DURATION, PACKING } from "@/lib/today/weights";
import type { HistoryEntry, Plan, PlannedTask, PlannerInput } from "@/lib/today/types";

/**
 * The student's rolling actual-to-estimated ratio (doc 05 §6).
 *
 * Students who read slowly stop getting plans they can never finish. Clamped, because
 * one abandoned task left open in a tab should not convince the planner that
 * everything takes three times as long.
 */
export function durationRatio(history: HistoryEntry[]): number {
  const completed = history
    .filter(
      (entry) =>
        entry.status === "DONE" &&
        typeof entry.actualMinutes === "number" &&
        typeof entry.estMinutes === "number" &&
        entry.estMinutes > 0,
    )
    .slice(-DURATION.window);

  if (completed.length === 0) return 1;

  const ratio =
    completed.reduce((sum, entry) => sum + entry.actualMinutes! / entry.estMinutes!, 0) /
    completed.length;

  if (!Number.isFinite(ratio)) return 1;

  return Math.min(Math.max(ratio, DURATION.minRatio), DURATION.maxRatio);
}

export function buildPlan(input: PlannerInput): Plan {
  const suppressed = suppressionFor(input);

  // A hard precondition, so no other code path can resurrect a finished account.
  if (suppressed) {
    return {
      mode: "BALANCED",
      targetMinutes: input.targetMinutes,
      tasks: [],
      totalEstMinutes: 0,
      gateMessage: null,
      suppressed,
      algoVersion: input.algoVersion,
    };
  }

  const mode = selectMode(input);
  const { candidates, gates } = generateCandidates(input, mode);

  // Personalise estimates before packing, or the packing is sized for someone else.
  const ratio = durationRatio(input.recentHistory);
  const scaled = candidates.map((candidate) => ({
    ...candidate,
    estMinutes: Math.max(1, Math.round(candidate.estMinutes * ratio)),
  }));

  const nearestTest = input.schoolTests
    .filter((test) => test.date.getTime() >= input.now.getTime())
    .sort((a, b) => a.date.getTime() - b.date.getTime())[0];

  const packed = packSession({
    candidates: scaled,
    targetMinutes: input.targetMinutes,
    subjectCount: input.enrolments.length,
    schoolTestBudget: schoolTestCap(
      scaled,
      input.targetMinutes,
      nearestTest ? daysUntil(nearestTest.date, input.now) : null,
      nearestTest?.kind === "SCHOOL_MOCK",
    ),
  });

  const shaped = shapeSession(packed);

  const tasks: PlannedTask[] = shaped.map((candidate, index) => {
    const enrolment = input.enrolments.find((entry) => entry.subjectId === candidate.subjectId);
    const subTopic = input.contentIndex.subTopics.find(
      (entry) => entry.id === candidate.subTopicId,
    );

    const examDate =
      enrolment && subTopic
        ? (enrolment.examDates
            .filter(
              (exam) =>
                exam.paper === subTopic.paper && exam.date.getTime() >= input.now.getTime(),
            )
            .sort((a, b) => a.date.getTime() - b.date.getTime())[0]?.date ?? null)
        : null;

    const touched = input.mastery
      .filter((entry) => subTopic?.specPointIds.includes(entry.specPointId))
      .map((entry) => entry.lastTouchedAt ?? entry.lastAttemptAt)
      .filter((date): date is Date => date instanceof Date);

    const daysSinceTouched =
      touched.length === 0
        ? null
        : Math.floor(
            (input.now.getTime() - Math.max(...touched.map((date) => date.getTime()))) / DAY_MS,
          );

    const test =
      candidate.subTopicId != null
        ? (input.schoolTests
            .filter(
              (entry) =>
                entry.subTopicIds.includes(candidate.subTopicId!) &&
                entry.date.getTime() >= input.now.getTime(),
            )
            .sort((a, b) => a.date.getTime() - b.date.getTime())[0] ?? null)
        : null;

    const gate = gates.find((entry) => entry.subjectId === candidate.subjectId)?.gate;

    return {
      ...candidate,
      order: index,
      rationale: rationaleFor(candidate, {
        now: input.now,
        dominant: dominantTerm(candidate.terms),
        dueCards: input.dueCards.total,
        maxOverdueDays:
          input.dueCards.overdueDays.length === 0 ? 0 : Math.max(...input.dueCards.overdueDays),
        examDate,
        schoolTest: test,
        schoolTestSubject:
          input.enrolments.find((entry) => entry.subjectId === test?.subjectId)?.subjectName ??
          null,
        daysSinceTouched,
        gateJustOpened: gate?.reason === "all-green" || gate?.reason === "stale-relief",
        holidayBlock:
          input.calendarPeriod.kind === "HOLIDAY" || input.calendarPeriod.kind === "HALF_TERM",
        studyLeaveNext: null,
      }),
    };
  });

  return {
    mode,
    targetMinutes: input.targetMinutes,
    tasks: tasks.slice(0, PACKING.maxTasks),
    totalEstMinutes: tasks.reduce((sum, task) => sum + task.estMinutes, 0),
    gateMessage: gateMessage(
      gates.map((entry) => ({ subjectName: entry.subjectName, gate: entry.gate })),
    ),
    suppressed: null,
    algoVersion: input.algoVersion,
  };
}

/** The deep link for a task (doc 05 §10). Never a hub page. */
export function targetHref(task: PlannedTask, taskId: string): string {
  const q = `task=${encodeURIComponent(taskId)}`;

  switch (task.ref.kind) {
    case "FLASHCARDS":
      return `/revise/flashcards?${q}`;
    case "LESSON":
      return `/learn/${task.subjectSlug}/${task.ref.subTopicCode.replaceAll(".", "-")}/${task.ref.lessonSlug}?${q}`;
    case "NOTES":
      return `/revise/${task.subjectSlug}/notes/${task.ref.subTopicCode.replaceAll(".", "-")}?${q}${
        task.ref.anchor ? `#${task.ref.anchor}` : ""
      }`;
    case "BLURT":
      return `/revise/blurt/${task.ref.promptId}?${q}`;
    case "QUESTIONS":
    case "DIAGNOSTIC":
    case "MINI_MOCK":
    case "FULL_MOCK":
      // The set is materialised at generation time, so the href carries its id.
      return `/test/practice/${taskId}?${q}`;
    case "PRACTICAL":
      return `/revise/${task.subjectSlug}/practicals/rp-${task.ref.practicalNumber}?${q}`;
    case "RAG_REFINE":
      return `/settings/ratings?topic=${encodeURIComponent(task.ref.topicId)}&${q}`;
  }
}
