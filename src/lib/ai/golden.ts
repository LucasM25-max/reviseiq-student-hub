/**
 * Scoring the golden set (doc 06 §7).
 *
 * Pure, so the agreement numbers can be computed in a unit test, in CI, and by a
 * future admin page from the same code.
 *
 * The headline target is agreement within ±1 mark rather than exact agreement,
 * because two human examiners do not agree exactly either. The non-negotiable is the
 * second number: a marker that awards more than the question is worth is not
 * slightly wrong, it is broken.
 */

import type { GoldenCase } from "../../../content/golden/biology-4.1.1.2";

export type GoldenOutcome = {
  testCase: GoldenCase;
  awardedMarks: number;
  maxMarks: number;
};

export type AgreementReport = {
  total: number;
  exact: number;
  withinOne: number;
  overMax: number;
  /** Signed mean of (machine − human): positive means it marks generously. */
  meanBias: number;
  meanAbsoluteError: number;
  exactPct: number;
  withinOnePct: number;
  neverOverMaxPct: number;
  /** Cases further than one mark from the human, worst first. */
  worst: Array<{ id: string; human: number; machine: number; delta: number }>;
};

export const AGREEMENT_TARGETS = {
  /** ≥ 90% of marks within ±1 mark of the human mark. */
  withinOnePct: 90,
  /** ≥ 98% never awarding more than maxMarks. */
  neverOverMaxPct: 98,
} as const;

export function scoreAgreement(outcomes: GoldenOutcome[]): AgreementReport {
  const total = outcomes.length;

  if (total === 0) {
    return {
      total: 0,
      exact: 0,
      withinOne: 0,
      overMax: 0,
      meanBias: 0,
      meanAbsoluteError: 0,
      exactPct: 0,
      withinOnePct: 0,
      neverOverMaxPct: 100,
      worst: [],
    };
  }

  let exact = 0;
  let withinOne = 0;
  let overMax = 0;
  let biasSum = 0;
  let absSum = 0;
  const worst: AgreementReport["worst"] = [];

  for (const outcome of outcomes) {
    const human = outcome.testCase.humanMarks;
    const machine = outcome.awardedMarks;
    const delta = machine - human;

    if (delta === 0) exact += 1;
    if (Math.abs(delta) <= 1) withinOne += 1;
    else worst.push({ id: outcome.testCase.id, human, machine, delta });

    if (machine > outcome.maxMarks) overMax += 1;

    biasSum += delta;
    absSum += Math.abs(delta);
  }

  worst.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.id.localeCompare(b.id));

  const pct = (n: number) => Math.round((n / total) * 1000) / 10;

  return {
    total,
    exact,
    withinOne,
    overMax,
    meanBias: Math.round((biasSum / total) * 100) / 100,
    meanAbsoluteError: Math.round((absSum / total) * 100) / 100,
    exactPct: pct(exact),
    withinOnePct: pct(withinOne),
    neverOverMaxPct: pct(total - overMax),
    worst,
  };
}

export function formatAgreement(report: AgreementReport): string {
  const lines = [
    `golden set: ${report.total} answers`,
    `  within ±1 mark : ${report.withinOnePct}% (target ${AGREEMENT_TARGETS.withinOnePct}%)`,
    `  exact          : ${report.exactPct}%`,
    `  never over max : ${report.neverOverMaxPct}% (target ${AGREEMENT_TARGETS.neverOverMaxPct}%)`,
    `  mean bias      : ${report.meanBias > 0 ? "+" : ""}${report.meanBias} marks`,
    `  mean abs error : ${report.meanAbsoluteError} marks`,
  ];

  for (const miss of report.worst.slice(0, 8)) {
    lines.push(
      `  off by ${miss.delta > 0 ? "+" : ""}${miss.delta}: ${miss.id} (human ${miss.human}, machine ${miss.machine})`,
    );
  }

  return lines.join("\n");
}
