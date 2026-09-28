/**
 * The response contract.
 *
 * Two representations of one shape: the JSON schema Gemini enforces while generating,
 * and a Zod schema that re-checks what actually arrived. Both, not either — structured
 * output is a strong constraint but it is still the other side of a network call, and
 * a marker that trusts a malformed reply shows a student a wrong mark.
 */

import { z } from "zod";

import type { RawMarkResponse } from "@/lib/ai/types";

/**
 * Gemini's `responseSchema`. A deliberately restricted subset of JSON Schema: object,
 * array, string, number, boolean, plus `enum` and `required`.
 */
export const MARK_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    awardedMarks: { type: "integer" },
    maxMarks: { type: "integer" },
    pointsAwarded: {
      type: "array",
      items: {
        type: "object",
        properties: {
          markPointId: { type: "string" },
          awarded: { type: "boolean" },
          evidence: { type: "string", nullable: true },
          reason: { type: "string" },
        },
        required: ["markPointId", "awarded", "reason"],
      },
    },
    missing: {
      type: "array",
      items: {
        type: "object",
        properties: {
          markPointId: { type: "string" },
          whatWasNeeded: { type: "string" },
        },
        required: ["markPointId", "whatWasNeeded"],
      },
    },
    misconceptions: { type: "array", items: { type: "string" } },
    feedback: {
      type: "object",
      properties: {
        whatWentWell: { type: "string" },
        evenBetterIf: { type: "string" },
      },
      required: ["whatWentWell", "evenBetterIf"],
    },
    confidence: { type: "number" },
  },
  required: [
    "awardedMarks",
    "maxMarks",
    "pointsAwarded",
    "missing",
    "misconceptions",
    "feedback",
    "confidence",
  ],
} as const;

/**
 * Tolerant where tolerance is safe, strict where it is not.
 *
 * Marks are coerced to integers and clamped later by the post-processor rather than
 * rejected here: a model returning 2.0 is not a failure worth throwing away a whole
 * response for. Missing *structure* is a failure.
 */
export const markResponseSchema = z.object({
  awardedMarks: z.number().finite(),
  maxMarks: z.number().finite(),
  pointsAwarded: z
    .array(
      z.object({
        markPointId: z.string().min(1),
        awarded: z.boolean(),
        evidence: z.string().nullable().optional().default(null),
        reason: z.string().default(""),
      }),
    )
    .default([]),
  missing: z
    .array(
      z.object({
        markPointId: z.string().min(1),
        whatWasNeeded: z.string().default(""),
      }),
    )
    .default([]),
  misconceptions: z.array(z.string()).default([]),
  feedback: z
    .object({
      whatWentWell: z.string().default(""),
      evenBetterIf: z.string().default(""),
    })
    .default({ whatWentWell: "", evenBetterIf: "" }),
  confidence: z.number().finite().default(0.5),
});

export type ParsedMarkResponse = z.infer<typeof markResponseSchema>;

/**
 * Parses the model's text as JSON and validates it.
 *
 * Returns null rather than throwing: an unparseable reply is an expected event on this
 * path, handled by one retry and then the deterministic fallback.
 */
export function parseMarkResponse(text: string): RawMarkResponse | null {
  let json: unknown;

  try {
    json = JSON.parse(text);
  } catch {
    // Structured output occasionally arrives wrapped in a code fence.
    const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
    if (!fenced?.[1]) return null;
    try {
      json = JSON.parse(fenced[1]);
    } catch {
      return null;
    }
  }

  const parsed = markResponseSchema.safeParse(json);
  if (!parsed.success) return null;

  return {
    awardedMarks: parsed.data.awardedMarks,
    maxMarks: parsed.data.maxMarks,
    pointsAwarded: parsed.data.pointsAwarded.map((point) => ({
      markPointId: point.markPointId,
      awarded: point.awarded,
      evidence: point.evidence ?? null,
      reason: point.reason,
    })),
    missing: parsed.data.missing,
    misconceptions: parsed.data.misconceptions,
    feedback: parsed.data.feedback,
    confidence: parsed.data.confidence,
  };
}
