/**
 * Choosing the questions for an end-of-lesson mastery check.
 *
 * Doc 01 §3: every lesson ends with 3–5 questions drawn from the real bank, in Test
 * context. "Drawn from the real bank" is the load-bearing phrase — these are the same
 * rows the Test section serves, not a second set written for lessons, so a student who
 * meets a question here and again in a mock is meeting the same question.
 *
 * Selection is deterministic. The same lesson and the same bank always produce the same
 * set, which means a mastery check is reproducible when a student reports a problem, and
 * a test can assert on it. Randomising would buy variety at the cost of both.
 */

export type MasteryCandidate = {
  id: string;
  marks: number;
  difficulty: number;
  specPoints: string[];
  retired?: boolean;
  type?: string;
};

export type MasterySelection = {
  questionIds: string[];
  /** Lesson spec points no selected question touches. Surfaced, never hidden. */
  uncoveredSpecPoints: string[];
  totalMarks: number;
  /**
   * True when the bank could not supply the 3-question minimum. The check still runs —
   * two real questions beat none — but the page says so rather than quietly looking thin.
   */
  belowTarget: boolean;
};

export type SelectOptions = {
  min?: number;
  max?: number;
};

/**
 * Greedy set cover, then fill.
 *
 * Covering every spec point the lesson taught matters more than any other property of the
 * set: a mastery check that tests two of a lesson's four ideas tells the student almost
 * nothing. So the first pass repeatedly takes whichever question closes the most
 * still-uncovered points, and only once coverage is done does a second pass top the set
 * up to `max` with the easiest questions left.
 *
 * Ties break on marks, then difficulty, then id — all stable, so the result never depends
 * on the order the bank happened to arrive in.
 */
export function selectMasteryQuestions(
  lessonSpecPoints: readonly string[],
  candidates: readonly MasteryCandidate[],
  options: SelectOptions = {},
): MasterySelection {
  const min = options.min ?? 3;
  const max = options.max ?? 5;

  const wanted = new Set(lessonSpecPoints);

  const pool = candidates
    .filter((candidate) => !candidate.retired)
    .filter((candidate) => candidate.specPoints.some((point) => wanted.has(point)))
    // A stable base order so every later comparison is total, not partial.
    .sort(
      (a, b) => a.marks - b.marks || a.difficulty - b.difficulty || a.id.localeCompare(b.id),
    );

  const chosen: MasteryCandidate[] = [];
  const covered = new Set<string>();

  const relevantPoints = (candidate: MasteryCandidate) =>
    candidate.specPoints.filter((point) => wanted.has(point));

  // Pass 1 — coverage.
  while (chosen.length < max) {
    let best: MasteryCandidate | undefined;
    let bestGain = 0;

    for (const candidate of pool) {
      if (chosen.includes(candidate)) continue;
      const gain = relevantPoints(candidate).filter((point) => !covered.has(point)).length;
      if (gain > bestGain) {
        best = candidate;
        bestGain = gain;
      }
    }

    if (!best) break;
    chosen.push(best);
    for (const point of relevantPoints(best)) covered.add(point);
  }

  // Pass 2 — top up to `max`, easiest first, so the set has a shape rather than being
  // three hard questions in a row.
  for (const candidate of pool) {
    if (chosen.length >= max) break;
    if (chosen.includes(candidate)) continue;
    chosen.push(candidate);
  }

  // Keep the presented order easiest-first rather than coverage-first: opening a mastery
  // check with the six-mark extended response is a good way to make someone stop.
  chosen.sort(
    (a, b) => a.marks - b.marks || a.difficulty - b.difficulty || a.id.localeCompare(b.id),
  );

  // A lesson whose spec points only have two questions in the bank gets two. That is a
  // content problem, and the coverage gates (≥8 questions per sub-topic) are where it is
  // meant to be caught — failing at render time would take the lesson down instead of
  // the build. So it is reported, not thrown.
  return {
    questionIds: chosen.map((candidate) => candidate.id),
    uncoveredSpecPoints: [...wanted].filter((point) => !covered.has(point)).sort(),
    totalMarks: chosen.reduce((sum, candidate) => sum + candidate.marks, 0),
    belowTarget: chosen.length < min,
  };
}

/** Distinct spec points taught by a lesson's blocks, in first-appearance order. */
export function lessonSpecPoints(
  blocks: readonly { specPoints?: readonly string[] }[],
): string[] {
  const seen: string[] = [];
  for (const block of blocks) {
    for (const point of block.specPoints ?? []) {
      if (!seen.includes(point)) seen.push(point);
    }
  }
  return seen;
}
