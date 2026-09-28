import "server-only";

import { prisma } from "@/lib/db/prisma";

/**
 * Fixed-window rate limiting backed by Postgres.
 *
 * Deliberately not Redis: one fewer service and one fewer bill for v1
 * (docs/plan/02-architecture.md). The counter is incremented and the window rolled over
 * in a single atomic statement, so concurrent requests cannot race past the limit.
 */

export type RateLimitRule = {
  /** Maximum number of attempts allowed inside the window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
};

export const RATE_LIMITS = {
  /** Sign-in attempts, per email. */
  login: { limit: 5, windowSeconds: 15 * 60 },
  /** Account creation, per IP. */
  signup: { limit: 5, windowSeconds: 60 * 60 },
  /** Verification emails, per user. */
  emailVerification: { limit: 3, windowSeconds: 60 * 60 },
  /** Password-reset requests, per email. */
  passwordReset: { limit: 3, windowSeconds: 60 * 60 },
  /**
   * AI marking, per user. Sits in front of the daily quota rather than instead of it:
   * the quota controls spend across a day, this stops a loop burning it in seconds.
   * Generous enough that working through a practice set never trips it.
   */
  aiMark: { limit: 20, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitName = keyof typeof RATE_LIMITS;

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  /** When the current window ends and the counter resets. */
  resetAt: Date;
  retryAfterSeconds: number;
};

/**
 * Records an attempt and reports whether it is allowed.
 *
 * `identifier` should be low-cardinality and already normalised (a lowercased email, a
 * user id, an IP address).
 */
export async function rateLimit(
  name: RateLimitName,
  identifier: string,
  rule: RateLimitRule = RATE_LIMITS[name],
): Promise<RateLimitResult> {
  const key = `${name}:${identifier}`;
  const windowEnd = new Date(Date.now() + rule.windowSeconds * 1000);

  const rows = await prisma.$queryRaw<{ count: number; windowEnd: Date }[]>`
    INSERT INTO "RateBucket" ("key", "count", "windowEnd")
    VALUES (${key}, 1, ${windowEnd})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateBucket"."windowEnd" <= (now() AT TIME ZONE 'UTC') THEN 1
        ELSE "RateBucket"."count" + 1
      END,
      "windowEnd" = CASE
        WHEN "RateBucket"."windowEnd" <= (now() AT TIME ZONE 'UTC') THEN EXCLUDED."windowEnd"
        ELSE "RateBucket"."windowEnd"
      END
    RETURNING "count", "windowEnd"
  `;

  const row = rows[0];

  // Defensive: RETURNING always yields a row, but never throw from a limiter.
  if (!row) {
    return {
      allowed: true,
      remaining: rule.limit - 1,
      resetAt: windowEnd,
      retryAfterSeconds: 0,
    };
  }

  const count = Number(row.count);
  const resetAt = row.windowEnd;
  const allowed = count <= rule.limit;

  return {
    allowed,
    remaining: Math.max(0, rule.limit - count),
    resetAt,
    retryAfterSeconds: Math.max(0, Math.ceil((resetAt.getTime() - Date.now()) / 1000)),
  };
}

/** Clears a counter — used after a successful sign-in so one bad day isn't punished. */
export async function resetRateLimit(name: RateLimitName, identifier: string): Promise<void> {
  await prisma.rateBucket.deleteMany({ where: { key: `${name}:${identifier}` } });
}

/** Renders a retry delay as something a person would say. */
export function formatRetryAfter(seconds: number): string {
  if (seconds <= 60) return "in less than a minute";
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `in about ${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.ceil(minutes / 60);
  return `in about ${hours} hour${hours === 1 ? "" : "s"}`;
}
