import { afterAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { formatRetryAfter, rateLimit, resetRateLimit } from "@/lib/rate-limit";

/**
 * The limiter is a security control, so it is tested against a real Postgres rather
 * than a mock — the whole point of the design is that the increment and the window
 * rollover happen in one atomic statement.
 */

const keys: string[] = [];

function identifier(): string {
  const value = `vitest-${Math.random().toString(36).slice(2, 10)}`;
  keys.push(value);
  return value;
}

afterAll(async () => {
  await prisma.rateBucket.deleteMany({
    where: { OR: keys.map((key) => ({ key: { contains: key } })) },
  });
  await prisma.$disconnect();
});

describe("rateLimit", () => {
  it("allows requests up to the limit and then blocks", async () => {
    const id = identifier();
    const rule = { limit: 3, windowSeconds: 60 };

    const first = await rateLimit("login", id, rule);
    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(2);

    expect((await rateLimit("login", id, rule)).remaining).toBe(1);
    expect((await rateLimit("login", id, rule)).remaining).toBe(0);

    const blocked = await rateLimit("login", id, rule);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("keeps separate counters per identifier", async () => {
    const rule = { limit: 1, windowSeconds: 60 };
    const a = identifier();
    const b = identifier();

    expect((await rateLimit("login", a, rule)).allowed).toBe(true);
    expect((await rateLimit("login", a, rule)).allowed).toBe(false);
    // b is untouched by a hitting its limit.
    expect((await rateLimit("login", b, rule)).allowed).toBe(true);
  });

  it("keeps separate counters per limit name", async () => {
    const rule = { limit: 1, windowSeconds: 60 };
    const id = identifier();

    expect((await rateLimit("login", id, rule)).allowed).toBe(true);
    expect((await rateLimit("login", id, rule)).allowed).toBe(false);
    expect((await rateLimit("passwordReset", id, rule)).allowed).toBe(true);
  });

  it("starts a fresh window once the old one has expired", async () => {
    const id = identifier();
    const expired = { limit: 1, windowSeconds: 0 };

    expect((await rateLimit("login", id, expired)).allowed).toBe(true);
    // windowEnd is already in the past, so the next call rolls the window over.
    const next = await rateLimit("login", id, expired);
    expect(next.allowed).toBe(true);
  });

  it("counts correctly under concurrent calls", async () => {
    const id = identifier();
    const rule = { limit: 5, windowSeconds: 60 };

    const results = await Promise.all(
      Array.from({ length: 10 }, () => rateLimit("login", id, rule)),
    );

    // Exactly five may pass, no matter how the ten interleave.
    expect(results.filter((result) => result.allowed)).toHaveLength(5);
  });

  it("clears the counter on reset", async () => {
    const id = identifier();
    const rule = { limit: 1, windowSeconds: 60 };

    expect((await rateLimit("login", id, rule)).allowed).toBe(true);
    expect((await rateLimit("login", id, rule)).allowed).toBe(false);

    await resetRateLimit("login", id);
    expect((await rateLimit("login", id, rule)).allowed).toBe(true);
  });
});

describe("formatRetryAfter", () => {
  it("reads like something a person would say", () => {
    expect(formatRetryAfter(0)).toBe("in less than a minute");
    expect(formatRetryAfter(45)).toBe("in less than a minute");
    expect(formatRetryAfter(61)).toBe("in about 2 minutes");
    expect(formatRetryAfter(120)).toBe("in about 2 minutes");
    expect(formatRetryAfter(3600)).toBe("in about 1 hour");
    expect(formatRetryAfter(7200)).toBe("in about 2 hours");
  });
});
