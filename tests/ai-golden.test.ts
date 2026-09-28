import { describe, expect, it } from "vitest";

import { goldenSet, type GoldenCase } from "../content/golden/biology-4.1.1.2";
import { rawContent } from "../content";
import { markWithFallback } from "@/lib/ai/fallback";
import {
  AGREEMENT_TARGETS,
  formatAgreement,
  scoreAgreement,
  type GoldenOutcome,
} from "@/lib/ai/golden";
import type { MarkInput } from "@/lib/ai/types";

type RawQuestion = (typeof rawContent.questions)[number];

const questions = new Map<string, RawQuestion>(rawContent.questions.map((q) => [q.id, q]));

function toMarkInput(testCase: GoldenCase): MarkInput {
  const question = questions.get(testCase.questionId);
  if (!question)
    throw new Error(`golden set references unknown question ${testCase.questionId}`);

  const scheme = question.markScheme;

  return {
    question: {
      id: question.id,
      stem: question.stem,
      commandWord: question.commandWord,
      marks: question.marks,
      tier: String(question.tier ?? "BOTH"),
      specPointStatements: [],
    },
    markScheme: {
      points: scheme.points.map((point) => ({
        id: point.id,
        text: point.text,
        marks: point.marks,
        alternatives: point.alternatives ?? [],
        reject: point.reject ?? [],
      })),
      guidance: scheme.guidance ?? null,
      ecfRules: scheme.ecfRules ?? null,
    },
    answer: testCase.answer,
  };
}

// ---------------------------------------------------------------------------

describe("the golden set itself", () => {
  it("is big enough to mean anything, and spans the awkward cases", () => {
    expect(goldenSet.length).toBeGreaterThanOrEqual(16);

    const kinds = new Set(goldenSet.map((c) => c.kind));
    for (const required of [
      "textbook",
      "oddly-worded",
      "partial",
      "wrong",
      "off-topic",
      "blank",
      "injection",
    ]) {
      expect(kinds, `missing case kind: ${required}`).toContain(required);
    }
  });

  it("has unique ids", () => {
    expect(new Set(goldenSet.map((c) => c.id)).size).toBe(goldenSet.length);
  });

  it("references real questions, and no human mark exceeds the question", () => {
    for (const testCase of goldenSet) {
      const question = questions.get(testCase.questionId);
      expect(question, `unknown question ${testCase.questionId}`).toBeDefined();
      expect(testCase.humanMarks).toBeGreaterThanOrEqual(0);
      expect(testCase.humanMarks).toBeLessThanOrEqual(question!.marks);
    }
  });

  it("awards human marks only for mark points that exist, and they add up", () => {
    for (const testCase of goldenSet) {
      const scheme = questions.get(testCase.questionId)!.markScheme;
      const ids = new Set(scheme.points.map((p) => p.id));

      let total = 0;
      for (const pointId of testCase.humanPoints) {
        expect(ids, `${testCase.id} cites unknown mark point ${pointId}`).toContain(pointId);
        total += scheme.points.find((p) => p.id === pointId)!.marks;
      }

      // The cited points must justify the mark given, or one of the two is wrong.
      expect(
        total,
        `${testCase.id}: cited points total ${total}, human gave ${testCase.humanMarks}`,
      ).toBe(testCase.humanMarks);
    }
  });

  it("records why every case is marked the way it is", () => {
    for (const testCase of goldenSet) {
      expect(testCase.note.length, `${testCase.id} has no note`).toBeGreaterThan(10);
    }
  });
});

// ---------------------------------------------------------------------------

describe("scoreAgreement", () => {
  const outcome = (human: number, machine: number, max = 3): GoldenOutcome => ({
    testCase: {
      id: `c${human}${machine}`,
      questionId: "q",
      answer: "",
      humanMarks: human,
      humanPoints: [],
      kind: "partial",
      note: "fixture",
    },
    awardedMarks: machine,
    maxMarks: max,
  });

  it("counts exact and within-one agreement", () => {
    const report = scoreAgreement([outcome(3, 3), outcome(3, 2), outcome(3, 0)]);
    expect(report.exact).toBe(1);
    expect(report.withinOne).toBe(2);
    expect(report.withinOnePct).toBeCloseTo(66.7, 1);
  });

  it("reports the direction of the error, not just its size", () => {
    expect(scoreAgreement([outcome(1, 3), outcome(1, 3)]).meanBias).toBe(2);
    expect(scoreAgreement([outcome(3, 1), outcome(3, 1)]).meanBias).toBe(-2);
    expect(scoreAgreement([outcome(3, 1), outcome(1, 3)]).meanBias).toBe(0);
    expect(scoreAgreement([outcome(3, 1), outcome(1, 3)]).meanAbsoluteError).toBe(2);
  });

  it("counts awarding more than the question is worth", () => {
    const report = scoreAgreement([outcome(3, 4, 3), outcome(3, 3, 3)]);
    expect(report.overMax).toBe(1);
    expect(report.neverOverMaxPct).toBe(50);
  });

  it("lists the worst misses first", () => {
    const report = scoreAgreement([outcome(3, 1), outcome(3, 0)]);
    expect(report.worst[0]?.delta).toBe(-3);
  });

  it("handles an empty set without dividing by zero", () => {
    expect(scoreAgreement([]).withinOnePct).toBe(0);
    expect(scoreAgreement([]).neverOverMaxPct).toBe(100);
  });
});

// ---------------------------------------------------------------------------

/**
 * The safety invariants hold for *any* marker, including the deterministic fallback
 * that runs with no API key. These are the ones that must never regress: they are
 * what stops a student being told they scored marks they did not.
 */
describe("marker invariants, on the deterministic fallback", () => {
  const outcomes: GoldenOutcome[] = goldenSet.map((testCase) => {
    const input = toMarkInput(testCase);
    return {
      testCase,
      awardedMarks: markWithFallback(input).awardedMarks,
      maxMarks: input.question.marks,
    };
  });

  it("never awards more than the question is worth", () => {
    const report = scoreAgreement(outcomes);
    expect(report.overMax, formatAgreement(report)).toBe(0);
  });

  it("gives nothing for a blank answer", () => {
    for (const outcome of outcomes.filter((o) => o.testCase.kind === "blank")) {
      expect(outcome.awardedMarks).toBe(0);
    }
  });

  it("cannot be talked into marks by the answer text", () => {
    for (const outcome of outcomes.filter((o) => o.testCase.kind === "injection")) {
      expect(
        outcome.awardedMarks,
        `${outcome.testCase.id} was talked up from ${outcome.testCase.humanMarks}`,
      ).toBeLessThanOrEqual(outcome.testCase.humanMarks);
    }
  });

  it("gives nothing for an answer to a different question", () => {
    for (const outcome of outcomes.filter((o) => o.testCase.kind === "off-topic")) {
      expect(outcome.awardedMarks, outcome.testCase.id).toBe(0);
    }
  });

  it("never invents a mark for a confidently wrong answer", () => {
    for (const outcome of outcomes.filter((o) => o.testCase.kind === "wrong")) {
      expect(outcome.awardedMarks, outcome.testCase.id).toBe(0);
    }
  });

  /**
   * Reported, not asserted. Word matching cannot reach the ±1 target and is not meant
   * to — it exists so the app still works with no key. Printing the number keeps it
   * visible, so a change that makes the fallback markedly worse is noticed.
   */
  it("reports how far word matching gets, without pretending it is the target", () => {
    const report = scoreAgreement(outcomes);
    console.log(`\n[fallback marker]\n${formatAgreement(report)}\n`);

    expect(report.total).toBe(goldenSet.length);
    // A floor, so a regression to "awards nothing ever" is still caught.
    expect(report.withinOnePct).toBeGreaterThan(40);
  });
});

// ---------------------------------------------------------------------------

/**
 * The real target (doc 06 §7), against the real model.
 *
 * Skipped without a key, which is every run in this sandbox and in CI unless a key is
 * configured. It is written and ready so that the first deployment with a key can
 * prove the exit criterion rather than assume it.
 */
describe.skipIf(!process.env.GEMINI_API_KEY)("agreement with the AI marker", () => {
  it(
    `meets the ±1 target on ≥${AGREEMENT_TARGETS.withinOnePct}% of the golden set`,
    { timeout: 180_000 },
    async () => {
      const { markOpenResponse } = await import("@/lib/ai/mark");

      const outcomes: GoldenOutcome[] = [];
      for (const testCase of goldenSet) {
        const input = toMarkInput(testCase);
        const result = await markOpenResponse(input, { userId: null, bypassCache: true });
        outcomes.push({
          testCase,
          awardedMarks: result.awardedMarks,
          maxMarks: input.question.marks,
        });
      }

      const report = scoreAgreement(outcomes);
      console.log(`\n[ai marker]\n${formatAgreement(report)}\n`);

      expect(report.withinOnePct, formatAgreement(report)).toBeGreaterThanOrEqual(
        AGREEMENT_TARGETS.withinOnePct,
      );
      expect(report.neverOverMaxPct, formatAgreement(report)).toBeGreaterThanOrEqual(
        AGREEMENT_TARGETS.neverOverMaxPct,
      );
    },
  );
});
