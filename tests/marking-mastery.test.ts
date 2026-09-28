import { describe, expect, it } from "vitest";

import { MASTERY_ALPHA, masteryBand, nextMastery, weightFor } from "@/lib/marking/mastery";

describe("nextMastery", () => {
  it("takes the first result at face value", () => {
    // A student who scores 3/3 first time is not 40% masterful.
    expect(nextMastery(null, 3, 3)).toBe(1);
    expect(nextMastery(null, 0, 3)).toBe(0);
    expect(nextMastery(null, 2, 4)).toBe(0.5);
  });

  it("moves an existing average toward the new score", () => {
    expect(nextMastery(0, 3, 3)).toBe(MASTERY_ALPHA);
    expect(nextMastery(1, 0, 3)).toBeCloseTo(1 - MASTERY_ALPHA, 10);
  });

  it("converges rather than oscillating", () => {
    let mastery = nextMastery(null, 0, 3);
    for (let i = 0; i < 12; i += 1) mastery = nextMastery(mastery, 3, 3);
    expect(mastery).toBeGreaterThan(0.99);
    expect(mastery).toBeLessThanOrEqual(1);
  });

  it("never leaves the 0–1 range, whatever it is fed", () => {
    expect(nextMastery(0.5, 99, 3)).toBeLessThanOrEqual(1);
    expect(nextMastery(0.5, -5, 3)).toBeGreaterThanOrEqual(0);
    expect(nextMastery(Number.NaN, 1, 2)).toBeGreaterThanOrEqual(0);
    expect(nextMastery(0.5, Number.NaN, 3)).toBeGreaterThanOrEqual(0);
  });

  it("leaves mastery alone for a question worth nothing", () => {
    expect(nextMastery(0.6, 0, 0)).toBe(0.6);
    expect(nextMastery(null, 0, 0)).toBe(0);
  });

  it("moves less for a weakly-evidenced attempt", () => {
    const strong = nextMastery(0, 3, 3, 1);
    const weak = nextMastery(0, 3, 3, 0.5);
    expect(weak).toBeLessThan(strong);
    expect(weak).toBeGreaterThan(0);
  });

  it("is deterministic and rounded, so it does not drift on re-read", () => {
    const once = nextMastery(0.3333, 2, 3);
    expect(nextMastery(0.3333, 2, 3)).toBe(once);
    expect(Number.isInteger(once * 10_000)).toBe(true);
  });
});

describe("weightFor", () => {
  it("trusts a real mark more than a self-mark or a word match", () => {
    expect(weightFor("AI")).toBe(1);
    expect(weightFor("AUTO")).toBe(1);
    expect(weightFor("AI_FALLBACK")).toBe(0.5);
    expect(weightFor("SELF")).toBe(0.5);
  });

  it("halves again when the mark is provisional", () => {
    expect(weightFor("AI", true)).toBe(0.5);
    expect(weightFor("SELF", true)).toBe(0.25);
  });

  it("treats an unknown source cautiously rather than fully", () => {
    expect(weightFor("SOMETHING_NEW")).toBe(0.5);
  });
});

describe("masteryBand", () => {
  it("maps onto the RAG bands the student already uses", () => {
    expect(masteryBand(0)).toBe("RED");
    expect(masteryBand(0.49)).toBe("RED");
    expect(masteryBand(0.5)).toBe("AMBER");
    expect(masteryBand(0.79)).toBe("AMBER");
    expect(masteryBand(0.8)).toBe("GREEN");
    expect(masteryBand(1)).toBe("GREEN");
  });
});
