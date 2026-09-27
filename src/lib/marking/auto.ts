/**
 * What can be marked without a language model.
 *
 * Phase 5 adds the AI marker. Phase 4 needs a mastery check now, so it draws the line
 * honestly: an objective question with a single correct key is marked by the machine, and
 * everything else is marked by the student against the real mark scheme. Self-marking is
 * a legitimate revision technique — reading a mark scheme and deciding whether you hit
 * each point is most of what a revision guide teaches — and it is far better than faking
 * a marker or hiding the questions until Phase 5.
 *
 * The important part is that the *attempt* is recorded either way, with `markedBy`
 * saying which happened. When the AI marker lands it changes who fills in the marks, not
 * the shape of the data, and Phase 6 can build flashcards from attempts made today.
 */
import { checkNumericAnswer, type NumericSpec, type NumericVerdict } from "./numeric";

export type MarkedBy = "AUTO" | "AI" | "AI_FALLBACK" | "SELF";

export type MarkableQuestion = {
  id: string;
  type: string;
  marks: number;
  /** Present on objective questions only. */
  correctKey?: string | null;
};

export type MarkOutcome = {
  awardedMarks: number;
  markedBy: MarkedBy;
  /** True when the student still has to award the marks themselves. */
  needsSelfMark: boolean;
  /** Stored on the attempt as `markDetail`, and rendered as feedback. */
  detail: {
    kind: "objective" | "numeric-verdict" | "unmarked";
    correctKey?: string;
    chosenKey?: string | null;
    numeric?: NumericVerdict;
  };
};

/** An objective question is one where a key is either right or it is not. */
export const isObjective = (question: MarkableQuestion): boolean =>
  question.type === "MCQ" && typeof question.correctKey === "string";

/**
 * Marks what can be marked.
 *
 * `answerKey` is the option a student chose; `answerText` is what they wrote. A numeric
 * question gets a verdict on its final value but is still handed back for self-marking,
 * because its method marks live in the working and no deterministic check can see them.
 */
export function autoMark(
  question: MarkableQuestion,
  answer: { answerKey?: string | null; answerText?: string | null },
  numericSpec?: NumericSpec | null,
): MarkOutcome {
  if (isObjective(question)) {
    const chosenKey = answer.answerKey ?? null;
    const correct = chosenKey !== null && chosenKey === question.correctKey;
    return {
      awardedMarks: correct ? question.marks : 0,
      markedBy: "AUTO",
      needsSelfMark: false,
      detail: {
        kind: "objective",
        correctKey: question.correctKey as string,
        chosenKey,
      },
    };
  }

  if (numericSpec) {
    return {
      awardedMarks: 0,
      markedBy: "SELF",
      needsSelfMark: true,
      detail: {
        kind: "numeric-verdict",
        numeric: checkNumericAnswer(numericSpec, answer.answerText ?? null),
      },
    };
  }

  return {
    awardedMarks: 0,
    markedBy: "SELF",
    needsSelfMark: true,
    detail: { kind: "unmarked" },
  };
}

/** Clamps a self-awarded mark to something the question can actually be worth. */
export function clampSelfMark(awarded: number, maxMarks: number): number {
  if (!Number.isFinite(awarded)) return 0;
  return Math.min(Math.max(Math.round(awarded), 0), Math.max(maxMarks, 0));
}

/** Percentage, rounded, with 0/0 reading as 0 rather than NaN. */
export function percentage(awarded: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((awarded / total) * 100);
}
