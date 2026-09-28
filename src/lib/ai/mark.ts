import "server-only";

/**
 * Marking one open response, end to end (doc 06 §1).
 *
 * The order of the guards is the whole design. Each one is cheaper than the next, and
 * every branch ends in a usable mark rather than an error:
 *
 *   blank answer      → no call at all
 *   no key            → deterministic fallback
 *   cache hit         → replay, free
 *   quota or ceiling  → deterministic fallback, clearly labelled
 *   model call        → one retry on a malformed reply, then fallback
 *
 * Nothing above the fallback can make the app unusable, which is the point: an AI
 * marker that fails closed takes the product down with it.
 */

import { readCachedMark, writeCachedMark } from "@/lib/ai/cache";
import { markCacheKey } from "@/lib/ai/cache-key";
import {
  geminiModel,
  hasGeminiKey,
  MARK_SCHEMA_RETRIES,
  MARK_TEMPERATURE,
  MARK_TIMEOUT_MS,
  MAX_OUTPUT_TOKENS,
} from "@/lib/ai/config";
import { isEmptyAnswer, markEmptyAnswer, markWithFallback } from "@/lib/ai/fallback";
import { postProcessMark } from "@/lib/ai/post-process";
import {
  buildMarkPrompt,
  MARK_PROMPT_VERSION,
  MARK_SYSTEM_INSTRUCTION,
} from "@/lib/ai/prompts/mark";
import { MARK_RESPONSE_SCHEMA, parseMarkResponse } from "@/lib/ai/schema";
import { callGemini, type GeminiResponse, type Transport } from "@/lib/ai/client";
import { checkMarkAllowance, recordUsage } from "@/lib/ai/usage";
import type { MarkDegradation, MarkInput, MarkResult } from "@/lib/ai/types";
import type { AiOutcome } from "@/generated/prisma/enums";

export type MarkOptions = {
  userId: string | null;
  /** Injected by the tests; production always uses the real client. */
  fetchImpl?: Transport;
  /** Skips the cache read and write. Used by the golden set. */
  bypassCache?: boolean;
  now?: () => number;
};

/** Attaches the reason a mark is not the model's considered opinion. */
function degrade(result: MarkResult, degraded: MarkDegradation, note: string): MarkResult {
  return {
    ...result,
    degraded,
    provisional: true,
    notes: [note, ...result.notes.filter((existing) => existing !== note)],
  };
}

const FALLBACK_NOTES: Record<string, string> = {
  "no-key": "Marked automatically — the AI marker isn't configured on this deployment.",
  quota:
    "You've reached today's AI marking limit, so this was checked by word matching instead.",
  ceiling: "AI marking is paused for now, so this was checked by word matching instead.",
  "api-error":
    "The AI marker couldn't be reached, so this was checked by word matching instead.",
  schema:
    "The AI marker returned something unusable, so this was checked by word matching instead.",
};

export async function markOpenResponse(
  input: MarkInput,
  options: MarkOptions,
): Promise<MarkResult> {
  const model = geminiModel();

  // 1. Nothing to mark. No call, no cost, no cache entry.
  if (isEmptyAnswer(input.answer)) {
    return markEmptyAnswer(input);
  }

  const fallback = (degraded: Exclude<MarkDegradation, null | "empty-answer">): MarkResult =>
    degrade(
      markWithFallback(input),
      degraded,
      FALLBACK_NOTES[degraded] ?? FALLBACK_NOTES.schema,
    );

  const ledger = (outcome: AiOutcome, latencyMs: number, usage?: GeminiResponse) =>
    recordUsage({
      userId: options.userId,
      feature: "MARK",
      model,
      promptVersion: MARK_PROMPT_VERSION,
      usage: usage?.ok ? usage.usage : undefined,
      latencyMs,
      outcome,
    });

  // 2. No key: every deployment without one still marks, just deterministically.
  if (!hasGeminiKey()) {
    await ledger("FALLBACK_NO_KEY", 0);
    return fallback("no-key");
  }

  const key = markCacheKey({
    questionId: input.question.id,
    model,
    promptVersion: MARK_PROMPT_VERSION,
    answer: input.answer,
  });

  // 3. Someone has already had this exact answer marked.
  if (!options.bypassCache) {
    const cached = await readCachedMark(key).catch(() => null);
    if (cached) {
      await ledger("CACHED", 0);
      return cached;
    }
  }

  // 4. Rationing, per student and globally.
  if (options.userId) {
    const allowance = await checkMarkAllowance(options.userId);
    if (!allowance.allowed) {
      await ledger(allowance.reason === "quota" ? "FALLBACK_QUOTA" : "FALLBACK_CEILING", 0);
      return fallback(allowance.reason);
    }
  }

  // 5. The model. One retry, because a malformed reply is usually transient.
  const prompt = buildMarkPrompt(input);
  let lastLatency = 0;

  for (let attempt = 0; attempt <= MARK_SCHEMA_RETRIES; attempt += 1) {
    const response = await callGemini(
      {
        systemInstruction: MARK_SYSTEM_INSTRUCTION,
        prompt,
        responseSchema: MARK_RESPONSE_SCHEMA,
        temperature: MARK_TEMPERATURE,
        maxOutputTokens: MAX_OUTPUT_TOKENS.mark,
        timeoutMs: MARK_TIMEOUT_MS,
      },
      { fetchImpl: options.fetchImpl, now: options.now },
    );

    lastLatency = response.latencyMs;

    if (!response.ok) {
      // A transport failure will not fix itself on a retry within the same second.
      await ledger("FALLBACK_ERROR", response.latencyMs);
      console.error(`[ai] mark call failed (${response.reason})`, response.detail);
      return fallback("api-error");
    }

    const raw = parseMarkResponse(response.text);

    if (raw) {
      const result = postProcessMark(input, raw, "AI", MARK_PROMPT_VERSION, model);
      await ledger("OK", response.latencyMs, response);
      if (!options.bypassCache) {
        await writeCachedMark(
          key,
          { questionId: input.question.id, model, promptVersion: MARK_PROMPT_VERSION },
          result,
        );
      }
      return result;
    }

    if (attempt === MARK_SCHEMA_RETRIES) break;
  }

  await ledger("FALLBACK_SCHEMA", lastLatency);
  return fallback("schema");
}
