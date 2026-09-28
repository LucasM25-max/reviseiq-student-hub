/**
 * The shapes the marker consumes and produces.
 *
 * Kept in their own module with no dependencies so the prompt builder, the response
 * validator, the post-processor, the fallback and the UI can all agree on one contract
 * without importing each other.
 */

/** One independently awardable point from a mark scheme. */
export type MarkPoint = {
  id: string;
  text: string;
  marks: number;
  /** Example acceptable wordings — illustrative, never exhaustive. */
  alternatives: string[];
  /** Phrasings that must never be credited. */
  reject: string[];
};

/** Everything the marker is allowed to know about the question. */
export type MarkableQuestionContext = {
  id: string;
  stem: string;
  commandWord: string;
  marks: number;
  tier: string;
  /** The spec statements the question assesses, for context on depth expected. */
  specPointStatements: string[];
};

export type MarkSchemeContext = {
  points: MarkPoint[];
  guidance: string | null;
  ecfRules: string | null;
};

export type MarkInput = {
  question: MarkableQuestionContext;
  markScheme: MarkSchemeContext;
  /** Untrusted student text. Always delimited before it reaches a model. */
  answer: string;
};

export type AwardedPoint = {
  markPointId: string;
  awarded: boolean;
  /** A quote from the student's own answer. Null when nothing was awarded. */
  evidence: string | null;
  reason: string;
};

export type MissingPoint = {
  markPointId: string;
  whatWasNeeded: string;
};

export type MarkFeedback = {
  whatWentWell: string;
  evenBetterIf: string;
};

/** The model's raw reply, after schema validation but before post-processing. */
export type RawMarkResponse = {
  awardedMarks: number;
  maxMarks: number;
  pointsAwarded: AwardedPoint[];
  missing: MissingPoint[];
  misconceptions: string[];
  feedback: MarkFeedback;
  confidence: number;
};

export type MarkSource =
  | "AUTO"
  | "AI"
  | "AI_FALLBACK"
  | "SELF"
  /** Served from the exact-answer cache; originally produced by the model. */
  | "AI_CACHED";

/** Why a mark is not the model's considered opinion. Null when it is. */
export type MarkDegradation =
  "no-key" | "quota" | "ceiling" | "api-error" | "schema" | "empty-answer" | null;

/** What the rest of the app stores and renders. */
export type MarkResult = {
  awardedMarks: number;
  maxMarks: number;
  pointsAwarded: AwardedPoint[];
  missing: MissingPoint[];
  misconceptions: string[];
  feedback: MarkFeedback;
  confidence: number;
  /**
   * True when the mark should be shown with a "check this yourself" caveat: low
   * confidence, a post-processing correction, or any fallback.
   */
  provisional: boolean;
  /** Human-readable reasons the mark was adjusted or flagged. Never shown raw. */
  notes: string[];
  source: MarkSource;
  degraded: MarkDegradation;
  promptVersion: string;
  model: string | null;
};

/** What `markedBy` becomes on the stored attempt. */
export function markedByFor(source: MarkSource): "AUTO" | "AI" | "AI_FALLBACK" | "SELF" {
  if (source === "AI_CACHED") return "AI";
  return source;
}
