/**
 * Marking for the widget engines.
 *
 * All of it is pure: arrays in, results out, no React, no DOM, no clock. That is a
 * deliberate constraint — there is no headless browser in this environment, so anything
 * that cannot be exercised by `vitest` from plain data is effectively untested. Keeping
 * the judgement here and the components dumb means the part that can be wrong is the
 * part that is covered.
 */

export type SlotResult = {
  /** Stable key for the slot — a structure key, or a left-hand card. */
  key: string;
  /** What the student put there, or null if they left it blank. */
  chosen: string | null;
  expected: string;
  correct: boolean;
};

export type AssignmentGrade = {
  results: SlotResult[];
  correct: number;
  answered: number;
  total: number;
  allCorrect: boolean;
  /** True when every slot has something in it, right or wrong. */
  complete: boolean;
};

/**
 * Grades "put the right value in each slot" — which is what a card sort and a diagram
 * labelling both are, once the presentation is stripped away.
 *
 * Comparison is exact against the expected string. The student never types these values;
 * they pick them from a bank built out of the same strings, so fuzzy matching would only
 * add a way to be wrong.
 */
export function gradeAssignment(
  slots: readonly { key: string; expected: string }[],
  answers: Readonly<Record<string, string | null | undefined>>,
): AssignmentGrade {
  const results: SlotResult[] = slots.map((slot) => {
    const raw = answers[slot.key];
    const chosen = raw === undefined || raw === null || raw === "" ? null : raw;
    return {
      key: slot.key,
      chosen,
      expected: slot.expected,
      correct: chosen === slot.expected,
    };
  });

  const correct = results.filter((result) => result.correct).length;
  const answered = results.filter((result) => result.chosen !== null).length;

  return {
    results,
    correct,
    answered,
    total: results.length,
    allCorrect: results.length > 0 && correct === results.length,
    complete: answered === results.length,
  };
}

export type CellResult = {
  row: number;
  column: number;
  chosen: boolean | null;
  expected: boolean;
  correct: boolean;
};

export type TableGrade = {
  cells: CellResult[];
  correct: number;
  answered: number;
  total: number;
  allCorrect: boolean;
  complete: boolean;
  /** Row indices where at least one cell is wrong — what the feedback highlights. */
  wrongRows: number[];
  rows: number;
  /**
   * Rows where every cell is right.
   *
   * This, not the cell count, is what a student is shown. Where the grid is filled with
   * checkboxes an empty table already agrees with every "does not apply" cell, so a
   * cell score would congratulate someone who did nothing. A row only counts when the
   * whole comparison is right, which is also how the exam question is marked.
   */
  rowsCorrect: number;
};

/**
 * Grades a tick-or-cross comparison grid.
 *
 * A blank cell is wrong rather than unmarked. The whole point of the exercise is to
 * commit to an answer for every cell: "I don't know" is exactly the state a student is
 * trying to find, and letting a blank sit as neutral hides it.
 */
export function gradeComparisonTable(
  expected: readonly (readonly boolean[])[],
  answers: readonly (readonly (boolean | null)[])[],
): TableGrade {
  const cells: CellResult[] = [];

  expected.forEach((row, rowIndex) => {
    row.forEach((expectedValue, columnIndex) => {
      const chosen = answers[rowIndex]?.[columnIndex] ?? null;
      cells.push({
        row: rowIndex,
        column: columnIndex,
        chosen,
        expected: expectedValue,
        correct: chosen === expectedValue,
      });
    });
  });

  const correct = cells.filter((cell) => cell.correct).length;
  const answered = cells.filter((cell) => cell.chosen !== null).length;
  const wrongRows = [
    ...new Set(cells.filter((cell) => !cell.correct).map((cell) => cell.row)),
  ].sort((a, b) => a - b);

  return {
    cells,
    correct,
    answered,
    total: cells.length,
    allCorrect: cells.length > 0 && correct === cells.length,
    complete: answered === cells.length,
    wrongRows,
    rows: expected.length,
    rowsCorrect: expected.length - wrongRows.length,
  };
}

/**
 * A, B, C … then AA, AB for the pathological case. Diagram letters are capped at 26 in
 * practice — no diagram in the registry has more than eight structures — but a widget
 * that silently produced `undefined` for the 27th would be a nasty surprise later.
 */
export function letterFor(index: number): string {
  if (index < 0) throw new RangeError(`letterFor: index must not be negative (got ${index})`);
  let remaining = index;
  let letters = "";
  do {
    letters = String.fromCharCode(65 + (remaining % 26)) + letters;
    remaining = Math.floor(remaining / 26) - 1;
  } while (remaining >= 0);
  return letters;
}

/** Plain-English score, used in the live region so it is announced, not just coloured. */
export function scoreSentence(correct: number, total: number): string {
  if (correct === total) return `All ${total} correct.`;
  return `${correct} of ${total} correct.`;
}
