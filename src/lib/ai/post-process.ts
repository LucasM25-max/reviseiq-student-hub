/**
 * Everything that happens between the model replying and a student seeing a mark
 * (doc 06 §1).
 *
 * A structured response is not a correct one. The model can return marks that do not
 * add up, award a point id that is not in the mark scheme, omit a point entirely, or
 * claim evidence it cannot quote. None of that should ever reach a student unchecked,
 * so the mark scheme — not the reply — is treated as the authority on what exists and
 * what each point is worth.
 */

import { normaliseText } from "@/lib/ai/normalise";
import type {
  AwardedPoint,
  MarkInput,
  MarkResult,
  MarkSource,
  MissingPoint,
  RawMarkResponse,
} from "@/lib/ai/types";

/** Below this the model is telling us it is unsure, so the student should be told too. */
export const LOW_CONFIDENCE = 0.6;

/**
 * A one-mark question is all-or-nothing: there is no partial credit to soften a
 * misjudgement, so it needs more certainty before being presented as settled.
 */
export const BOUNDARY_CONFIDENCE = 0.75;

/**
 * Whether a quote genuinely appears in the answer.
 *
 * Compared on normalised text rather than character-for-character: a model that
 * corrects a student's capitalisation or drops a stray comma while copying has still
 * quoted them, and failing that would flag almost every honest mark.
 */
export function evidenceAppearsIn(answer: string, evidence: string | null): boolean {
  if (evidence === null) return false;

  const needle = normaliseText(evidence);
  if (needle.length === 0) return false;

  return normaliseText(answer).includes(needle);
}

/**
 * Reconciles a model reply against the mark scheme.
 *
 * The scheme drives the output: one entry per scheme point, in scheme order, worth
 * what the scheme says it is worth. Anything the model invented is dropped, anything
 * it forgot counts as not awarded.
 */
export function postProcessMark(
  input: MarkInput,
  raw: RawMarkResponse,
  source: MarkSource,
  promptVersion: string,
  model: string | null,
): MarkResult {
  const maxMarks = Math.max(0, Math.trunc(input.question.marks));
  const notes: string[] = [];

  const byId = new Map(raw.pointsAwarded.map((point) => [point.markPointId, point]));

  const known = new Set(input.markScheme.points.map((point) => point.id));
  const invented = raw.pointsAwarded.filter((point) => !known.has(point.markPointId));
  if (invented.length > 0) {
    notes.push(`Ignored ${invented.length} mark point(s) the marker invented.`);
  }

  const pointsAwarded: AwardedPoint[] = [];
  const missing: MissingPoint[] = [];
  let recomputed = 0;
  let unverifiedEvidence = 0;
  let omitted = 0;

  for (const point of input.markScheme.points) {
    const reply = byId.get(point.id);

    if (!reply) {
      omitted += 1;
      pointsAwarded.push({
        markPointId: point.id,
        awarded: false,
        evidence: null,
        reason: "The marker didn't reach a decision on this point.",
      });
      missing.push({ markPointId: point.id, whatWasNeeded: point.text });
      continue;
    }

    if (reply.awarded) {
      // The mark scheme decides what a point is worth, never the reply.
      recomputed += Math.max(0, Math.trunc(point.marks));

      if (!evidenceAppearsIn(input.answer, reply.evidence)) {
        unverifiedEvidence += 1;
      }

      pointsAwarded.push({
        markPointId: point.id,
        awarded: true,
        evidence: reply.evidence,
        reason: reply.reason,
      });
    } else {
      pointsAwarded.push({
        markPointId: point.id,
        awarded: false,
        // A quote is only meaningful as the reason a mark was given.
        evidence: null,
        reason: reply.reason,
      });
      const stated = raw.missing.find((entry) => entry.markPointId === point.id);
      missing.push({
        markPointId: point.id,
        whatWasNeeded: stated?.whatWasNeeded?.trim() || point.text,
      });
    }
  }

  if (omitted > 0) {
    notes.push(`The marker skipped ${omitted} mark point(s); they count as not awarded.`);
  }

  const awardedMarks = Math.min(Math.max(recomputed, 0), maxMarks);

  if (recomputed > maxMarks) {
    notes.push(`Marks were capped at the ${maxMarks} available.`);
  }

  const claimed = Math.trunc(raw.awardedMarks);
  if (Number.isFinite(claimed) && claimed !== awardedMarks) {
    notes.push(
      `The marker's total (${claimed}) didn't match its own points; used ${awardedMarks}.`,
    );
  }

  if (unverifiedEvidence > 0) {
    /*
     * Flagged, not revoked. The instruction tells the model not to award without a
     * quote, so this is a real signal — but deleting a mark a student may well have
     * earned is the worse error of the two, and "provisional" plus the mark scheme
     * beside it lets them settle it themselves.
     */
    notes.push(
      `${unverifiedEvidence} awarded point(s) couldn't be traced to a quote from your answer.`,
    );
  }

  const confidence = Math.min(Math.max(raw.confidence, 0), 1);

  const provisional =
    confidence < LOW_CONFIDENCE ||
    notes.length > 0 ||
    (maxMarks === 1 && confidence < BOUNDARY_CONFIDENCE);

  return {
    awardedMarks,
    maxMarks,
    pointsAwarded,
    missing,
    misconceptions: raw.misconceptions.filter((tag) => tag.trim().length > 0),
    feedback: {
      whatWentWell: raw.feedback.whatWentWell.trim(),
      evenBetterIf: raw.feedback.evenBetterIf.trim(),
    },
    confidence,
    provisional,
    notes,
    source,
    degraded: null,
    promptVersion,
    model,
  };
}
