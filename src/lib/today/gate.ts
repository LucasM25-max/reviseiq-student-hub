/**
 * The NOT_LEARNT gate (doc 05 §4).
 *
 * The rule as specified: Today suggests lessons for not-yet-learnt content only when
 * all learnt content is green.
 *
 * Applied **per subject**, not globally. A student who is green across Biology should
 * be learning new Biology even if their Physics is a mess — otherwise one weak
 * subject freezes progress everywhere, which is not what the rule is for.
 *
 * The gate is correct as a default and wrong as an absolute, so it has three exits.
 * Without them it produces a student who is being taught something in school this
 * week, cannot access the lesson for it, and concludes the app is broken.
 */

import { STALE_GATE_DAYS } from "@/lib/today/weights";
import type { RagEntry } from "@/lib/today/types";

export type GateState = {
  open: boolean;
  /** Why it is open, when it is not simply that everything is green. */
  reason: "all-green" | "nothing-learnt-yet" | "stale-relief" | "shut";
  /** Red and Amber sub-topics standing in the way, for the explanation. */
  blockingCount: number;
};

/**
 * The gate for one subject.
 *
 * `rag` must already be filtered to that subject's entries.
 */
export function gateFor(rag: RagEntry[], gateShutDays = 0): GateState {
  const learnt = rag.filter((entry) => entry.value !== "NOT_LEARNT");

  // A brand-new student has nothing to fix yet, so nothing to gate.
  if (learnt.length === 0) {
    return { open: true, reason: "nothing-learnt-yet", blockingCount: 0 };
  }

  const blocking = learnt.filter(
    (entry) => entry.value === "RED" || entry.value === "AMBER",
  ).length;

  if (blocking === 0) return { open: true, reason: "all-green", blockingCount: 0 };

  /*
   * Stale-gate relief. Perpetual gating is demotivating, and demotivated students
   * close the app — so after a fortnight of grinding with nothing moving, one lesson
   * comes through anyway, with an explanation.
   */
  if (gateShutDays >= STALE_GATE_DAYS) {
    return { open: true, reason: "stale-relief", blockingCount: blocking };
  }

  return { open: false, reason: "shut", blockingCount: blocking };
}

/** Escape hatch 1: "we're doing this in school now", good for 28 days. */
export function hasLearningNowFlag(
  subTopicId: string,
  flags: Array<{ subTopicId: string; expiresAt: Date }>,
  now: Date,
): boolean {
  return flags.some(
    (flag) => flag.subTopicId === subTopicId && flag.expiresAt.getTime() > now.getTime(),
  );
}

/**
 * Never a silent absence. When the gate is shut Today says so, with the count.
 *
 * Escape hatch 2 is stated here too: the gate governs what Today *recommends*, never
 * what the student may access. Locking content would be hostile.
 */
export function gateMessage(
  states: Array<{ subjectName: string; gate: GateState }>,
): string | null {
  const shut = states.filter((state) => !state.gate.open);
  if (shut.length === 0) return null;

  const total = shut.reduce((sum, state) => sum + state.gate.blockingCount, 0);
  const subjects = shut.map((state) => state.subjectName).join(" and ");

  return `New ${subjects} lessons unlock when your ${total} remaining Red and Amber ${
    total === 1 ? "topic goes" : "topics go"
  } Green. You can still open anything you like from Learn.`;
}
