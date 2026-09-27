import { describe, expect, it } from "vitest";

import { rawContent } from "@content/index";
import { autoMark, clampSelfMark, isObjective, percentage } from "@/lib/marking/auto";
import { checkNumericAnswer, normaliseUnit, parseQuantity } from "@/lib/marking/numeric";

/**
 * Deterministic marking.
 *
 * The failure mode this suite exists to stop is the quiet one: reading "×499" as 499 in
 * one place and as nothing in another, so a student is told they are wrong when they are
 * right. Every numeric question in the shipped bank is driven through the checker with a
 * correct answer, a wrong answer and a boundary answer, so the tolerance windows the
 * content authored are the tolerance windows the app applies.
 */

describe("parseQuantity", () => {
  it("reads a bare number", () => {
    expect(parseQuantity("60")).toEqual({ value: 60, unit: null });
    expect(parseQuantity("  60  ")).toEqual({ value: 60, unit: null });
    expect(parseQuantity("0.25")).toEqual({ value: 0.25, unit: null });
    expect(parseQuantity("-3")).toEqual({ value: -3, unit: null });
  });

  it("reads a number with a unit", () => {
    expect(parseQuantity("60 µm")).toEqual({ value: 60, unit: "µm" });
    expect(parseQuantity("60µm")).toEqual({ value: 60, unit: "µm" });
    expect(parseQuantity("25 µm²")).toEqual({ value: 25, unit: "µm²" });
    expect(parseQuantity("1200 nm")).toEqual({ value: 1200, unit: "nm" });
  });

  it("reads standard form in the shapes students write it", () => {
    expect(parseQuantity("1 × 10^-4 m")).toEqual({ value: 1e-4, unit: "m" });
    expect(parseQuantity("1x10^-4 m")).toEqual({ value: 1e-4, unit: "m" });
    expect(parseQuantity("1*10**-4")).toEqual({ value: 1e-4, unit: null });
    expect(parseQuantity("1e-4")).toEqual({ value: 1e-4, unit: null });
    expect(parseQuantity("5 × 10^-6 m")).toEqual({ value: 5e-6, unit: "m" });
  });

  it("reads a bare power of ten as having a mantissa of one", () => {
    expect(parseQuantity("10^4")).toEqual({ value: 10000, unit: null });
    expect(parseQuantity("×10^3")).toEqual({ value: 1000, unit: null });
  });

  it("strips the multiplication sign a magnification is written with", () => {
    // "×499" is a magnification, not an operator. Getting this wrong marks every
    // correctly-notated magnification as unreadable.
    expect(parseQuantity("×499.4")).toEqual({ value: 499.4, unit: null });
    expect(parseQuantity("x400")).toEqual({ value: 400, unit: null });
    expect(parseQuantity("× 500")).toEqual({ value: 500, unit: null });
  });

  it("strips hedges a student writes in front of a value", () => {
    expect(parseQuantity("about 60 µm")).toEqual({ value: 60, unit: "µm" });
    expect(parseQuantity("approx. 60 µm")).toEqual({ value: 60, unit: "µm" });
    expect(parseQuantity("~60")).toEqual({ value: 60, unit: null });
    expect(parseQuantity("≈ 60")).toEqual({ value: 60, unit: null });
    expect(parseQuantity("= 60 µm")).toEqual({ value: 60, unit: "µm" });
  });

  it("handles a thousands separator without eating a comma in prose", () => {
    expect(parseQuantity("1,200 nm")).toEqual({ value: 1200, unit: "nm" });
    expect(parseQuantity("60, roughly")).toEqual({ value: 60, unit: ", roughly" });
  });

  it("returns nothing when there is no number to find", () => {
    expect(parseQuantity("I don't know")).toBeNull();
    expect(parseQuantity("")).toBeNull();
    expect(parseQuantity("   ")).toBeNull();
    expect(parseQuantity(null)).toBeNull();
    expect(parseQuantity(undefined)).toBeNull();
  });

  it("refuses to evaluate working, because working is not an answer", () => {
    // "300 ÷ 5" is a student showing their method, not finishing it. Computing it for
    // them would award the answer mark for a question they have not answered.
    expect(parseQuantity("300 ÷ 5")).toEqual({ value: 300, unit: "÷ 5" });
  });
});

describe("normaliseUnit", () => {
  it("treats all three ways of writing micro as the same", () => {
    expect(normaliseUnit("\u00b5m")).toBe("um"); // MICRO SIGN
    expect(normaliseUnit("\u03bcm")).toBe("um"); // GREEK SMALL LETTER MU
    expect(normaliseUnit("um")).toBe("um");
    expect(normaliseUnit(" µM ")).toBe("um");
  });

  it("treats superscripts and carets as the same", () => {
    expect(normaliseUnit("µm²")).toBe("um2");
    expect(normaliseUnit("µm^2")).toBe("um2");
    expect(normaliseUnit("um2")).toBe("um2");
  });

  it("does not confuse different units", () => {
    expect(normaliseUnit("mm")).not.toBe(normaliseUnit("µm"));
    expect(normaliseUnit("nm")).not.toBe(normaliseUnit("µm"));
  });

  it("returns null for nothing", () => {
    expect(normaliseUnit(null)).toBeNull();
    expect(normaliseUnit("   ")).toBeNull();
  });
});

describe("checkNumericAnswer", () => {
  const spec = { accept: { min: 50, max: 75 }, unit: "µm" };

  it("accepts a value inside the window, including both boundaries", () => {
    expect(checkNumericAnswer(spec, "60 µm").inRange).toBe(true);
    expect(checkNumericAnswer(spec, "50 µm").inRange).toBe(true);
    expect(checkNumericAnswer(spec, "75 µm").inRange).toBe(true);
  });

  it("rejects a value just outside it", () => {
    expect(checkNumericAnswer(spec, "49.9 µm").inRange).toBe(false);
    expect(checkNumericAnswer(spec, "75.1 µm").inRange).toBe(false);
  });

  it("notices a missing unit when the question needs one", () => {
    const verdict = checkNumericAnswer(spec, "60");
    expect(verdict.inRange).toBe(true);
    expect(verdict.unitOk).toBe(false);
    expect(verdict.summary).toContain("No unit given");
  });

  it("notices the wrong unit", () => {
    const verdict = checkNumericAnswer(spec, "60 mm");
    expect(verdict.unitOk).toBe(false);
    expect(verdict.summary).toContain("needs µm");
  });

  it("accepts any spelling of micro", () => {
    expect(checkNumericAnswer(spec, "60 um").unitOk).toBe(true);
    expect(checkNumericAnswer(spec, "60 \u03bcm").unitOk).toBe(true);
  });

  it("reports no unit expectation for a dimensionless quantity", () => {
    const verdict = checkNumericAnswer({ accept: { min: 480, max: 515 } }, "×499.4");
    expect(verdict.unitOk).toBeNull();
    expect(verdict.inRange).toBe(true);
    expect(verdict.summary).not.toContain("unit");
  });

  it("says so plainly when there is no number at all", () => {
    const verdict = checkNumericAnswer(spec, "I'm not sure");
    expect(verdict.parsed).toBeNull();
    expect(verdict.inRange).toBe(false);
    expect(verdict.summary).toContain("couldn't find a number");
  });

  it("handles a null answer", () => {
    expect(checkNumericAnswer(spec, null).inRange).toBe(false);
  });
});

describe("every numeric question in the shipped bank", () => {
  const numericQuestions = rawContent.questions.filter(
    (question) => question.markScheme.numericAnswer !== undefined,
  );

  it("finds the four the content authored", () => {
    expect(numericQuestions.map((question) => question.id)).toEqual([
      "bio-4112-q07",
      "bio-4112-q08",
      "bio-4112-q09",
      "bio-4112-q17",
    ]);
  });

  it("accepts the midpoint of its own tolerance window", () => {
    for (const question of numericQuestions) {
      const numeric = question.markScheme.numericAnswer!;
      const mid = (numeric.accept.min + numeric.accept.max) / 2;
      const answer = numeric.unit ? `${mid} ${numeric.unit}` : String(mid);
      const verdict = checkNumericAnswer(numeric, answer);
      expect(verdict.inRange, `${question.id} rejected its own midpoint`).toBe(true);
      expect(verdict.unitOk, `${question.id} rejected its own unit`).not.toBe(false);
    }
  });

  it("rejects an order of magnitude out in either direction", () => {
    for (const question of numericQuestions) {
      const numeric = question.markScheme.numericAnswer!;
      const mid = (numeric.accept.min + numeric.accept.max) / 2;
      const unit = numeric.unit ? ` ${numeric.unit}` : "";
      expect(checkNumericAnswer(numeric, `${mid * 10}${unit}`).inRange).toBe(false);
      expect(checkNumericAnswer(numeric, `${mid / 10}${unit}`).inRange).toBe(false);
    }
  });

  it("has a window that is a window, not a point or a reversal", () => {
    for (const question of numericQuestions) {
      const numeric = question.markScheme.numericAnswer!;
      expect(numeric.accept.min, question.id).toBeLessThan(numeric.accept.max);
    }
  });

  it("accepts the exact answers worked through in the content", () => {
    // These are the values the lessons and notes derive in front of the student. If the
    // tolerance windows ever drifted away from the taught arithmetic, a student would
    // follow the worked example exactly and be told they were wrong.
    const worked: Record<string, string> = {
      "bio-4112-q07": "60 µm", // 300 ÷ mean(5,6,4)
      "bio-4112-q08": "5 µm", // 20 ÷ 4
      "bio-4112-q09": "25 µm²", // (30 × 15) ÷ 18
      "bio-4112-q17": "×499.4", // 120 mm ÷ 0.2403 mm
    };

    for (const [questionId, answer] of Object.entries(worked)) {
      const question = numericQuestions.find((candidate) => candidate.id === questionId);
      expect(question, `${questionId} is missing from the bank`).toBeDefined();
      const verdict = checkNumericAnswer(question!.markScheme.numericAnswer!, answer);
      expect(verdict.inRange, `${questionId}: ${verdict.summary}`).toBe(true);
      expect(verdict.unitOk, `${questionId}: ${verdict.summary}`).not.toBe(false);
    }
  });

  it("rejects ×400 on the magnification question, which is the whole point of it", () => {
    const q17 = numericQuestions.find((question) => question.id === "bio-4112-q17")!;
    // The classic error is writing the microscope's magnification under the drawing.
    expect(checkNumericAnswer(q17.markScheme.numericAnswer!, "×400").inRange).toBe(false);
  });
});

describe("autoMark", () => {
  const mcq = { id: "q01", type: "MCQ", marks: 1, correctKey: "B" };

  it("marks a right multiple choice answer automatically", () => {
    const outcome = autoMark(mcq, { answerKey: "B" });
    expect(outcome).toMatchObject({ awardedMarks: 1, markedBy: "AUTO", needsSelfMark: false });
    expect(outcome.detail).toMatchObject({
      kind: "objective",
      correctKey: "B",
      chosenKey: "B",
    });
  });

  it("marks a wrong one automatically too", () => {
    expect(autoMark(mcq, { answerKey: "C" })).toMatchObject({
      awardedMarks: 0,
      markedBy: "AUTO",
    });
  });

  it("marks a blank multiple choice as zero, not as needing self-marking", () => {
    expect(autoMark(mcq, {})).toMatchObject({ awardedMarks: 0, needsSelfMark: false });
  });

  it("hands a written answer back for self-marking", () => {
    const outcome = autoMark(
      { id: "q04", type: "SHORT", marks: 2 },
      { answerText: "Because." },
    );
    expect(outcome).toMatchObject({ awardedMarks: 0, markedBy: "SELF", needsSelfMark: true });
    expect(outcome.detail.kind).toBe("unmarked");
  });

  it("checks the value of a numeric answer but still asks for a self-mark", () => {
    // A three-mark calculation has method marks in the working, and no regular
    // expression can see those. Awarding only the answer mark would under-mark someone
    // who did everything right and slipped at the end.
    const outcome = autoMark(
      { id: "q07", type: "DATA_RESPONSE", marks: 3 },
      { answerText: "60 µm" },
      { accept: { min: 50, max: 75 }, unit: "µm" },
    );
    expect(outcome.needsSelfMark).toBe(true);
    expect(outcome.markedBy).toBe("SELF");
    expect(outcome.detail.kind).toBe("numeric-verdict");
    expect(outcome.detail.numeric?.inRange).toBe(true);
  });

  it("treats a non-MCQ with a stray correctKey as not objective", () => {
    expect(isObjective({ id: "x", type: "SHORT", marks: 1, correctKey: "A" })).toBe(false);
    expect(isObjective({ id: "x", type: "MCQ", marks: 1 })).toBe(false);
  });
});

describe("clampSelfMark", () => {
  it("keeps a mark inside what the question is worth", () => {
    expect(clampSelfMark(2, 3)).toBe(2);
    expect(clampSelfMark(9, 3)).toBe(3);
    expect(clampSelfMark(-4, 3)).toBe(0);
  });

  it("rounds a fractional mark and survives junk", () => {
    expect(clampSelfMark(1.6, 3)).toBe(2);
    expect(clampSelfMark(Number.NaN, 3)).toBe(0);
    expect(clampSelfMark(1, -3)).toBe(0);
  });
});

describe("percentage", () => {
  it("rounds, and reads 0 out of 0 as zero rather than NaN", () => {
    expect(percentage(3, 4)).toBe(75);
    expect(percentage(1, 3)).toBe(33);
    expect(percentage(0, 0)).toBe(0);
  });
});
