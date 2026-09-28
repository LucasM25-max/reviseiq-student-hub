import "server-only";

/**
 * The exact-answer cache (doc 06 §6).
 *
 * GCSE short answers repeat heavily across students — "it controls what enters and
 * leaves the cell" is written thousands of times — so marking the same answer to the
 * same question twice is pure waste. Expect a real hit rate on 1–2 mark questions and
 * almost none on 6-markers.
 *
 * Only genuinely model-produced marks are cached. Caching a fallback would freeze a
 * degraded mark in place long after the key came back.
 */

import { markCacheKey } from "@/lib/ai/cache-key";
import { prisma } from "@/lib/db/prisma";
import type { MarkResult } from "@/lib/ai/types";

export { markCacheKey };

/**
 * Returns a previously served mark, or null.
 *
 * The hit counter is a best-effort write: a cache that cannot record statistics should
 * still serve, so a failure here is swallowed rather than surfaced.
 */
export async function readCachedMark(key: string): Promise<MarkResult | null> {
  const row = await prisma.markCache.findUnique({ where: { key } });
  if (!row) return null;

  prisma.markCache
    .update({
      where: { key },
      data: { hits: { increment: 1 }, lastUsedAt: new Date() },
    })
    .catch(() => {});

  const cached = row.result as unknown as MarkResult;

  return { ...cached, source: "AI_CACHED" };
}

export async function writeCachedMark(
  key: string,
  parts: { questionId: string; model: string; promptVersion: string },
  result: MarkResult,
): Promise<void> {
  if (result.source !== "AI") return;

  try {
    await prisma.markCache.upsert({
      where: { key },
      create: {
        key,
        questionId: parts.questionId,
        model: parts.model,
        promptVersion: parts.promptVersion,
        result: result as unknown as object,
      },
      // A re-mark of the same answer is the same mark; refresh rather than duplicate.
      update: { result: result as unknown as object, lastUsedAt: new Date() },
    });
  } catch (error) {
    console.error("[ai] could not write the mark cache", error);
  }
}
