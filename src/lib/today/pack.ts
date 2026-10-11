/**
 * Session packing (doc 05 §6).
 *
 * Scoring gives an ordered list; packing turns it into a session a human would
 * actually enjoy. Greedy by priority, with the constraints that stop the greedy
 * answer being a miserable one: no long runs of the same task type, more than one
 * subject once there is room, and a hard cap on how many things a person is willing
 * to look at.
 */

import { PACKING, SCHOOL_TEST_SHARE } from "@/lib/today/weights";
import type { Candidate } from "@/lib/today/types";

/** The school-test share cap for today (doc 05 §5a). */
export function schoolTestCap(
  candidates: Candidate[],
  targetMinutes: number,
  daysToNearestTest: number | null,
  nearestIsMock: boolean,
): number {
  if (daysToNearestTest === null) return targetMinutes;

  const share = nearestIsMock
    ? SCHOOL_TEST_SHARE.mockShare
    : daysToNearestTest <= SCHOOL_TEST_SHARE.nearDays
      ? SCHOOL_TEST_SHARE.nearShare
      : SCHOOL_TEST_SHARE.farShare;

  void candidates;
  return targetMinutes * share;
}

export type PackInput = {
  candidates: Candidate[];
  targetMinutes: number;
  subjectCount: number;
  /** Minutes of school-test work allowed before normal priority takes over. */
  schoolTestBudget: number;
};

/**
 * Packs the session.
 *
 * Flashcards are reserved first when they exist: overdue cards decay fastest and it
 * is a genuinely easy start, which matters more than squeezing out one extra mark's
 * worth of questions.
 */
export function packSession(input: PackInput): Candidate[] {
  const budget = input.targetMinutes * PACKING.overrun;

  const sorted = [...input.candidates].sort(
    (a, b) => b.score - a.score || a.key.localeCompare(b.key),
  );

  const chosen: Candidate[] = [];
  let used = 0;
  let testMinutes = 0;

  const cards = sorted.find((candidate) => candidate.type === "FLASHCARDS");
  if (cards) {
    chosen.push(cards);
    used += cards.estMinutes;
  }

  const fits = (candidate: Candidate): boolean => {
    if (used + candidate.estMinutes <= input.targetMinutes) return true;
    // Allow a small overrun on the final task rather than leaving a hole.
    return chosen.length > 0 && used + candidate.estMinutes <= budget;
  };

  const runLengthOk = (candidate: Candidate): boolean => {
    const tail = chosen.slice(-PACKING.maxConsecutiveSameType);
    if (tail.length < PACKING.maxConsecutiveSameType) return true;
    return !tail.every((task) => task.type === candidate.type);
  };

  for (const candidate of sorted) {
    if (chosen.length >= PACKING.maxTasks) break;
    if (chosen.includes(candidate)) continue;

    // A full mock is only ever placed when it is the whole session.
    if (candidate.type === "FULL_MOCK") continue;

    if (
      candidate.fromSchoolTest &&
      testMinutes + candidate.estMinutes > input.schoolTestBudget
    ) {
      continue;
    }

    if (!runLengthOk(candidate)) continue;
    if (!fits(candidate)) continue;

    chosen.push(candidate);
    used += candidate.estMinutes;
    if (candidate.fromSchoolTest) testMinutes += candidate.estMinutes;
  }

  /*
   * At least two subjects once the session is long enough to hold them. A 60-minute
   * block entirely on one subject is how a student ends up neglecting the other two
   * without ever deciding to.
   */
  if (
    input.targetMinutes >= PACKING.twoSubjectsFrom &&
    input.subjectCount >= 2 &&
    new Set(chosen.map((task) => task.subjectId)).size === 1 &&
    chosen.length > 1
  ) {
    const present = chosen[0]!.subjectId;
    const alternative = sorted.find(
      (candidate) =>
        candidate.subjectId !== present &&
        !chosen.includes(candidate) &&
        candidate.type !== "FULL_MOCK",
    );

    if (alternative) {
      // Swap out the lowest-scoring non-flashcard task to make room.
      const replaceable = [...chosen]
        .filter((task) => task.type !== "FLASHCARDS")
        .sort((a, b) => a.score - b.score)[0];

      if (replaceable) {
        const index = chosen.indexOf(replaceable);
        const without = used - replaceable.estMinutes;
        if (without + alternative.estMinutes <= budget) {
          chosen[index] = alternative;
          used = without + alternative.estMinutes;
        }
      }
    }
  }

  /*
   * A plan always contains at least one task, even if everything is green and
   * nothing is due. An empty Today is indistinguishable from a broken one.
   */
  if (chosen.length === 0 && sorted.length > 0) {
    const smallest = [...sorted]
      .filter((candidate) => candidate.type !== "FULL_MOCK")
      .sort((a, b) => a.estMinutes - b.estMinutes || b.score - a.score)[0];
    if (smallest) chosen.push(smallest);
  }

  return chosen;
}

/**
 * Orders the chosen tasks into warm-up, main and cool-down.
 *
 * Flashcards lead when present. After that the heaviest substantive work goes in the
 * middle, and something small and confirming closes — finishing on a six-marker is
 * how a session ends in defeat.
 */
export function shapeSession(tasks: Candidate[]): Candidate[] {
  if (tasks.length <= 2) return tasks;

  const cards = tasks.filter((task) => task.type === "FLASHCARDS");
  const rest = tasks.filter((task) => task.type !== "FLASHCARDS");

  if (rest.length <= 1) return [...cards, ...rest];

  const byWeight = [...rest].sort((a, b) => b.estMinutes - a.estMinutes || b.score - a.score);
  const closer = byWeight[byWeight.length - 1]!;
  const main = byWeight.slice(0, -1).sort((a, b) => b.score - a.score);

  return [...cards, ...main, closer];
}
