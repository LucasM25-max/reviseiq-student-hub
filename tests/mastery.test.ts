import { describe, expect, it } from "vitest";

import { rawContent } from "@content/index";
import type { LessonBlock } from "@/lib/content/schema";
import {
  lessonSpecPoints,
  selectMasteryQuestions,
  type MasteryCandidate,
} from "@/lib/learn/mastery";

/**
 * Choosing the questions for a mastery check.
 *
 * The property that matters most is coverage: a check that tests two of a lesson's four
 * ideas tells a student almost nothing, and does it while looking thorough. The second
 * is determinism — the same lesson must always produce the same set, or a bug report
 * cannot be reproduced and this suite could not assert anything.
 */

const candidate = (
  id: string,
  specPoints: string[],
  marks = 2,
  difficulty = 3,
): MasteryCandidate => ({ id, specPoints, marks, difficulty });

describe("selectMasteryQuestions", () => {
  it("covers every spec point it can before adding anything else", () => {
    const selection = selectMasteryQuestions(
      ["sp-a", "sp-b", "sp-c"],
      [
        candidate("q1", ["sp-a"]),
        candidate("q2", ["sp-a"]),
        candidate("q3", ["sp-a"]),
        candidate("q4", ["sp-b"]),
        candidate("q5", ["sp-c"]),
      ],
      { max: 3 },
    );
    expect(selection.questionIds).toHaveLength(3);
    expect(selection.uncoveredSpecPoints).toEqual([]);
    // One from each point, not three from the one with the most questions.
    expect(selection.questionIds).toContain("q4");
    expect(selection.questionIds).toContain("q5");
  });

  it("prefers a question that closes two gaps over one that closes one", () => {
    const selection = selectMasteryQuestions(
      ["sp-a", "sp-b"],
      [candidate("single", ["sp-a"]), candidate("double", ["sp-a", "sp-b"])],
      { max: 1 },
    );
    expect(selection.questionIds).toEqual(["double"]);
  });

  it("tops the set up once coverage is done", () => {
    const selection = selectMasteryQuestions(
      ["sp-a"],
      [
        candidate("q1", ["sp-a"], 1),
        candidate("q2", ["sp-a"], 2),
        candidate("q3", ["sp-a"], 3),
        candidate("q4", ["sp-a"], 4),
      ],
      { max: 3 },
    );
    expect(selection.questionIds).toHaveLength(3);
  });

  it("presents the set easiest first", () => {
    const selection = selectMasteryQuestions(
      ["sp-a", "sp-b"],
      [
        candidate("hard", ["sp-a"], 6, 5),
        candidate("easy", ["sp-b"], 1, 1),
        candidate("middling", ["sp-a", "sp-b"], 3, 3),
      ],
      { max: 3 },
    );
    expect(selection.questionIds).toEqual(["easy", "middling", "hard"]);
  });

  it("is deterministic no matter what order the bank arrives in", () => {
    const pool = [
      candidate("q1", ["sp-a"], 1, 2),
      candidate("q2", ["sp-b"], 3, 4),
      candidate("q3", ["sp-a", "sp-b"], 2, 1),
      candidate("q4", ["sp-c"], 5, 3),
      candidate("q5", ["sp-c"], 2, 5),
    ];
    const forwards = selectMasteryQuestions(["sp-a", "sp-b", "sp-c"], pool);
    const backwards = selectMasteryQuestions(["sp-a", "sp-b", "sp-c"], [...pool].reverse());
    expect(backwards.questionIds).toEqual(forwards.questionIds);
  });

  it("breaks a total tie on id, so the result never depends on insertion order", () => {
    const pool = [candidate("zeta", ["sp-a"]), candidate("alpha", ["sp-a"])];
    expect(selectMasteryQuestions(["sp-a"], pool, { max: 1 }).questionIds).toEqual(["alpha"]);
  });

  it("ignores retired questions", () => {
    const selection = selectMasteryQuestions(
      ["sp-a"],
      [{ ...candidate("retired", ["sp-a"]), retired: true }, candidate("live", ["sp-a"])],
    );
    expect(selection.questionIds).toEqual(["live"]);
  });

  it("ignores questions from other spec points entirely", () => {
    const selection = selectMasteryQuestions(["sp-a"], [candidate("elsewhere", ["sp-z"])]);
    expect(selection.questionIds).toEqual([]);
    expect(selection.uncoveredSpecPoints).toEqual(["sp-a"]);
  });

  it("reports what it could not cover rather than hiding it", () => {
    const selection = selectMasteryQuestions(
      ["sp-a", "sp-missing"],
      [candidate("q1", ["sp-a"])],
    );
    expect(selection.uncoveredSpecPoints).toEqual(["sp-missing"]);
  });

  it("flags a set that falls short of the three-question target", () => {
    expect(selectMasteryQuestions(["sp-a"], [candidate("only", ["sp-a"])]).belowTarget).toBe(
      true,
    );
    expect(
      selectMasteryQuestions(
        ["sp-a"],
        [candidate("a", ["sp-a"]), candidate("b", ["sp-a"]), candidate("c", ["sp-a"])],
      ).belowTarget,
    ).toBe(false);
  });

  it("never exceeds the maximum", () => {
    const pool = Array.from({ length: 20 }, (_, i) => candidate(`q${i}`, ["sp-a"]));
    expect(selectMasteryQuestions(["sp-a"], pool).questionIds).toHaveLength(5);
    expect(selectMasteryQuestions(["sp-a"], pool, { max: 2 }).questionIds).toHaveLength(2);
  });

  it("totals the marks of what it chose", () => {
    const selection = selectMasteryQuestions(
      ["sp-a", "sp-b"],
      [candidate("q1", ["sp-a"], 2), candidate("q2", ["sp-b"], 3)],
    );
    expect(selection.totalMarks).toBe(5);
  });

  it("copes with a lesson that teaches nothing", () => {
    const selection = selectMasteryQuestions([], [candidate("q1", ["sp-a"])]);
    expect(selection.questionIds).toEqual([]);
    expect(selection.totalMarks).toBe(0);
  });

  it("never returns the same question twice", () => {
    const pool = [candidate("q1", ["sp-a", "sp-b", "sp-c"]), candidate("q2", ["sp-a"])];
    const ids = selectMasteryQuestions(["sp-a", "sp-b", "sp-c"], pool).questionIds;
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("lessonSpecPoints", () => {
  it("collects them in first-appearance order, without duplicates", () => {
    expect(
      lessonSpecPoints([
        { specPoints: ["b", "a"] },
        { specPoints: ["a", "c"] },
        { specPoints: [] },
        {},
      ]),
    ).toEqual(["b", "a", "c"]);
  });
});

describe("against the real bank", () => {
  const bySpecPoint = rawContent.questions.map((question) => ({
    id: question.id,
    marks: question.marks,
    difficulty: question.difficulty,
    retired: question.retired ?? false,
    specPoints: question.specPoints.map((link) => link.code),
  }));

  it("gives every shipped lesson a usable mastery check", () => {
    for (const lesson of rawContent.lessons) {
      const points = lessonSpecPoints(lesson.blocks as LessonBlock[]);
      const selection = selectMasteryQuestions(points, bySpecPoint);

      expect(
        selection.questionIds.length,
        `${lesson.id} got no questions`,
      ).toBeGreaterThanOrEqual(3);
      expect(selection.questionIds.length).toBeLessThanOrEqual(5);
      expect(selection.belowTarget, `${lesson.id} is below target`).toBe(false);
      expect(selection.totalMarks).toBeGreaterThan(0);
    }
  });

  it("covers every spec point each lesson actually teaches", () => {
    for (const lesson of rawContent.lessons) {
      const points = lessonSpecPoints(lesson.blocks as LessonBlock[]);
      const selection = selectMasteryQuestions(points, bySpecPoint);
      expect(
        selection.uncoveredSpecPoints,
        `${lesson.id} leaves ${selection.uncoveredSpecPoints.join(", ")} untested`,
      ).toEqual([]);
    }
  });

  it("only ever picks questions that exist and are not retired", () => {
    const live = new Set(
      rawContent.questions
        .filter((question) => !question.retired)
        .map((question) => question.id),
    );
    for (const lesson of rawContent.lessons) {
      const points = lessonSpecPoints(lesson.blocks as LessonBlock[]);
      for (const id of selectMasteryQuestions(points, bySpecPoint).questionIds) {
        expect(live.has(id), `${id} is not a live question`).toBe(true);
      }
    }
  });

  it("produces a stable set — these exact ids, until the bank changes", () => {
    // Pinned deliberately. If a content change moves these, that is a real change to
    // what students are asked, and it should be seen in a diff rather than discovered.
    const byLesson = Object.fromEntries(
      rawContent.lessons.map((lesson) => [
        lesson.id,
        selectMasteryQuestions(lessonSpecPoints(lesson.blocks as LessonBlock[]), bySpecPoint)
          .questionIds,
      ]),
    );

    expect(byLesson).toEqual({
      "bio-4112-l1": [
        "bio-4112-q01",
        "bio-4112-q03",
        "bio-4112-q06",
        "bio-4112-q11",
        "bio-4112-q12",
      ],
      "bio-4112-l2": [
        "bio-4112-q02",
        "bio-4112-q04",
        "bio-4112-q08",
        "bio-4112-q05",
        "bio-4112-q09",
      ],
      "bio-4112-l3": [
        "bio-4112-q08",
        "bio-4112-q15",
        "bio-4112-q14",
        "bio-4112-q09",
        "bio-4112-q17",
      ],
    });
  });

  it("opens each check with its cheapest question and never buries a one-marker", () => {
    // Order is marks-ascending, so the first thing a student meets is the smallest. A
    // check that opened with the six-mark extended response is one people abandon.
    for (const lesson of rawContent.lessons) {
      const points = lessonSpecPoints(lesson.blocks as LessonBlock[]);
      const ids = selectMasteryQuestions(points, bySpecPoint).questionIds;
      const marks = ids.map(
        (id) => rawContent.questions.find((question) => question.id === id)!.marks,
      );
      expect(marks[0], `${lesson.id} opens with a ${marks[0]}-mark question`).toBe(
        Math.min(...marks),
      );
    }
  });

  it("keeps a check to a sitting — no more than 20 marks", () => {
    for (const lesson of rawContent.lessons) {
      const points = lessonSpecPoints(lesson.blocks as LessonBlock[]);
      const selection = selectMasteryQuestions(points, bySpecPoint);
      expect(
        selection.totalMarks,
        `${lesson.id} is ${selection.totalMarks} marks`,
      ).toBeLessThanOrEqual(20);
    }
  });
});
