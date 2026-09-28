import "server-only";

/**
 * The cost and reliability ledger (doc 06 §6).
 *
 * Every call writes a row — including cache hits and fallbacks — so "what does a
 * student cost" and "how often is the marker degraded" are both answerable from one
 * table, and the monthly ceiling is checked against real spend rather than an estimate.
 *
 * Quotas count only calls that actually reached the model. A student who hits the
 * cache all afternoon has cost nothing and should not be rationed for it.
 */

import { aiLimits } from "@/lib/ai/config";
import { costMicroUsd, type TokenUsage } from "@/lib/ai/cost";
import { prisma } from "@/lib/db/prisma";
import type { AiFeature, AiOutcome } from "@/generated/prisma/enums";

/** Outcomes that consumed real tokens and therefore real money. */
const BILLABLE: AiOutcome[] = ["OK"];

export function startOfUtcDay(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function startOfUtcMonth(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function recordUsage(entry: {
  userId: string | null;
  feature: AiFeature;
  model: string;
  promptVersion: string;
  usage?: TokenUsage;
  latencyMs: number;
  outcome: AiOutcome;
  at?: Date;
}): Promise<void> {
  const usage = entry.usage ?? { inputTokens: 0, outputTokens: 0 };
  const billable = BILLABLE.includes(entry.outcome);

  try {
    await prisma.aiUsage.create({
      data: {
        userId: entry.userId,
        feature: entry.feature,
        model: entry.model,
        promptVersion: entry.promptVersion,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        costMicroUsd: billable ? costMicroUsd(usage, entry.at ?? new Date()) : 0,
        latencyMs: Math.max(0, Math.trunc(entry.latencyMs)),
        outcome: entry.outcome,
      },
    });
  } catch (error) {
    // The ledger must never be the reason a student can't get a mark.
    console.error("[ai] could not write the usage ledger", error);
  }
}

/** Calls that reached the model today, for this student. */
export async function marksUsedToday(userId: string, now: Date = new Date()): Promise<number> {
  return prisma.aiUsage.count({
    where: {
      userId,
      feature: { in: ["MARK", "MARK_BATCH"] },
      outcome: { in: BILLABLE },
      createdAt: { gte: startOfUtcDay(now) },
    },
  });
}

export async function tutorTurnsUsedToday(
  userId: string,
  now: Date = new Date(),
): Promise<number> {
  return prisma.aiUsage.count({
    where: {
      userId,
      feature: "TUTOR",
      outcome: { in: BILLABLE },
      createdAt: { gte: startOfUtcDay(now) },
    },
  });
}

/** Whole-app spend for the calendar month, in micro-dollars. */
export async function monthlySpendMicroUsd(now: Date = new Date()): Promise<number> {
  const result = await prisma.aiUsage.aggregate({
    _sum: { costMicroUsd: true },
    where: { createdAt: { gte: startOfUtcMonth(now) } },
  });

  return result._sum.costMicroUsd ?? 0;
}

export type Allowance =
  | { allowed: true }
  | { allowed: false; reason: "quota" | "ceiling"; used: number; limit: number };

/**
 * Whether this student may make a billable marking call right now.
 *
 * Hitting either limit degrades to fallback marking with a clear message; it is never
 * a hard block, because a student who cannot get their work marked has lost the
 * product entirely (doc 06 §6).
 */
export async function checkMarkAllowance(
  userId: string,
  now: Date = new Date(),
): Promise<Allowance> {
  const limits = aiLimits();

  const ceilingMicro = Math.round(limits.monthlyCeilingUsd * 1_000_000);
  const spent = await monthlySpendMicroUsd(now);
  if (spent >= ceilingMicro) {
    return { allowed: false, reason: "ceiling", used: spent, limit: ceilingMicro };
  }

  const used = await marksUsedToday(userId, now);
  if (used >= limits.dailyMarks) {
    return { allowed: false, reason: "quota", used, limit: limits.dailyMarks };
  }

  return { allowed: true };
}
