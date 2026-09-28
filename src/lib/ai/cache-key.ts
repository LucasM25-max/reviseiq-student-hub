/**
 * The exact-answer cache key (doc 06 §6).
 *
 * Split from the cache itself so the hashing is pure and testable, and so the golden
 * set can compute keys without a database.
 *
 * Every input that can change a mark is in the key. The model and the prompt version
 * are there deliberately: a mark produced by a different prompt is a different mark,
 * and replaying it after a prompt change would make the change unmeasurable.
 */

import { createHash } from "node:crypto";

import { normaliseForCache } from "@/lib/ai/normalise";

export function markCacheKey(parts: {
  questionId: string;
  model: string;
  promptVersion: string;
  answer: string;
}): string {
  const normalised = normaliseForCache(parts.answer);

  // Length-prefixed so no combination of values can collide by running together.
  const payload = [parts.questionId, parts.model, parts.promptVersion, normalised]
    .map((value) => `${value.length}:${value}`)
    .join("|");

  return createHash("sha256").update(payload, "utf8").digest("hex");
}
