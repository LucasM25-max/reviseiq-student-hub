/**
 * Marking without a model (doc 06 §5).
 *
 * The app must never be unusable because the AI is. This runs when there is no key,
 * when a quota or the monthly ceiling is spent, and whenever a call fails — and it is
 * what makes local development and a deterministic test suite possible at all.
 *
 * It is deliberately cautious. Token overlap cannot understand a sentence, so it is
 * tuned to award only when the expected idea is substantially present, and everything
 * it produces is labelled provisional with the mark scheme expanded beside it. Being
 * quietly generous here would teach a student they had scored a mark they had not.
 */

import { containsPhrase, contentTokens, coverage, tokenSet } from "@/lib/ai/normalise";
import type { AwardedPoint, MarkInput, MarkResult, MissingPoint } from "@/lib/ai/types";

/**
 * How much of a mark point's wording must be present.
 *
 * Tuned against the golden set. High enough that a vaguely related sentence does not
 * score, low enough that a correct answer in the student's own words usually does —
 * the acceptable wordings in `alternatives` carry most of that load.
 */
export const FALLBACK_THRESHOLD = 0.6;

/** Below this many content words there is nothing to judge. */
const MIN_ANSWER_TOKENS = 2;

export const FALLBACK_PROMPT_VERSION = "fallbackV1";

/**
 * Best coverage across the mark point's own text and each accepted alternative.
 *
 * Alternatives are separate phrasings of the same idea, so the best match is the right
 * summary — averaging them would punish a mark scheme for listing many wordings.
 */
export function bestCoverage(
  point: { text: string; alternatives: string[] },
  answer: string,
  /** Words already in the question stem, which earn nothing on their own. */
  ignore?: ReadonlySet<string>,
) {
  const candidates = [point.text, ...point.alternatives];

  let best = 0;
  let matched = point.text;
  for (const candidate of candidates) {
    const score = coverage(candidate, answer, ignore);
    if (score > best) {
      best = score;
      matched = candidate;
    }
  }

  return { score: best, matched };
}

export function markWithFallback(input: MarkInput): MarkResult {
  const answer = input.answer ?? "";
  const answerTokens = contentTokens(answer);
  const maxMarks = Math.max(0, input.question.marks);

  // Repeating the question earns nothing, so its words are discounted everywhere below.
  const stemWords = tokenSet(input.question.stem);

  const pointsAwarded: AwardedPoint[] = [];
  const missing: MissingPoint[] = [];
  let awardedMarks = 0;

  for (const point of input.markScheme.points) {
    const rejected = point.reject.find((phrase) => containsPhrase(answer, phrase));
    const { score } = bestCoverage(point, answer, stemWords);

    const award =
      !rejected && answerTokens.length >= MIN_ANSWER_TOKENS && score >= FALLBACK_THRESHOLD;

    if (award) {
      awardedMarks += point.marks;
      pointsAwarded.push({
        markPointId: point.id,
        awarded: true,
        // No quoting: overlap cannot say which words earned it, and inventing a quote
        // would look like evidence the machine does not have.
        evidence: null,
        reason: "Your answer covers most of the wording this point asks for.",
      });
    } else {
      pointsAwarded.push({
        markPointId: point.id,
        awarded: false,
        evidence: null,
        reason: rejected
          ? "This point can't be awarded because the answer includes something the mark scheme rejects."
          : "Not enough of this point appeared in the answer for an automatic check to be sure.",
      });
      missing.push({ markPointId: point.id, whatWasNeeded: point.text });
    }
  }

  return {
    awardedMarks: Math.min(awardedMarks, maxMarks),
    maxMarks,
    pointsAwarded,
    missing,
    misconceptions: [],
    feedback: {
      whatWentWell:
        answerTokens.length >= MIN_ANSWER_TOKENS
          ? "You've written an answer to compare against the mark scheme."
          : "There wasn't enough here to mark.",
      evenBetterIf:
        "Read the mark scheme below and decide honestly which points you hit — then correct your mark if this got it wrong.",
    },
    // Never presented as a real mark. This is word matching, not marking.
    confidence: 0,
    provisional: true,
    notes: ["Marked by word matching, not by the AI marker."],
    source: "AI_FALLBACK",
    degraded: "api-error",
    promptVersion: FALLBACK_PROMPT_VERSION,
    model: null,
  };
}

/** A blank or near-blank answer never reaches a model, or the matcher (doc 06 §1). */
export function markEmptyAnswer(input: MarkInput): MarkResult {
  const maxMarks = Math.max(0, input.question.marks);

  return {
    awardedMarks: 0,
    maxMarks,
    pointsAwarded: input.markScheme.points.map((point) => ({
      markPointId: point.id,
      awarded: false,
      evidence: null,
      reason: "No answer was given.",
    })),
    missing: input.markScheme.points.map((point) => ({
      markPointId: point.id,
      whatWasNeeded: point.text,
    })),
    misconceptions: [],
    feedback: {
      whatWentWell: "",
      evenBetterIf:
        "Have a go before checking — even a partly right answer is worth marks, and it tells you far more than a blank.",
    },
    confidence: 1,
    provisional: false,
    notes: [],
    source: "AUTO",
    degraded: "empty-answer",
    promptVersion: FALLBACK_PROMPT_VERSION,
    model: null,
  };
}

/** Blank, whitespace, or too short to be an attempt. */
export function isEmptyAnswer(answer: string | null | undefined): boolean {
  return (answer ?? "").trim().length < 3;
}
