import { describe, expect, it } from "vitest";

import { markCacheKey } from "@/lib/ai/cache-key";
import { costMicroUsd, formatUsd, PRICE_RISE_AT, pricingAt } from "@/lib/ai/cost";
import {
  containsPhrase,
  contentTokens,
  coverage,
  normaliseText,
  tokenSet,
} from "@/lib/ai/normalise";

describe("normaliseText", () => {
  it("folds case, accents, curly quotes and micro signs", () => {
    expect(normaliseText("The CELL’s size is 60 µm")).toBe("the cells size is 60 um");
    expect(normaliseText("60 μm")).toBe("60 um"); // Greek mu
    expect(normaliseText("café")).toBe("cafe");
  });

  it("collapses punctuation and whitespace but keeps numbers and signs", () => {
    expect(normaliseText("  a,b;c\n\nd  ")).toBe("a b c d");
    expect(normaliseText("1 × 10^-4 m")).toBe("1 10-4 m");
  });

  it("is idempotent", () => {
    const once = normaliseText("The CELL’s  size — 60µm!");
    expect(normaliseText(once)).toBe(once);
  });
});

describe("contentTokens", () => {
  it("drops stop words", () => {
    expect(contentTokens("the nucleus is in the cell")).toEqual(["nucleus", "cell"]);
  });

  it("keeps negations and quantifiers, which change the science", () => {
    expect(contentTokens("does not control all")).toContain("not");
    expect(contentTokens("does not control all")).toContain("all");
  });

  it("folds plurals and listed synonyms to one token", () => {
    expect(tokenSet("mitochondrion").has("mitochondria")).toBe(true);
    expect(tokenSet("mitochondria").has("mitochondria")).toBe(true);
    expect(tokenSet("releases energy").has("release")).toBe(true);
    expect(tokenSet("produces protein").has("make")).toBe(true);
  });

  it("does not fold distinctions that can themselves be the mark point", () => {
    expect(tokenSet("cell wall").has("membrane")).toBe(false);
    expect(tokenSet("diffusion").has("osmosis")).toBe(false);
  });
});

describe("coverage", () => {
  it("measures how much of the expected idea is present", () => {
    expect(
      coverage(
        "controls what enters and leaves the cell",
        "it controls what enters and leaves the cell",
      ),
    ).toBe(1);
    expect(coverage("controls what enters and leaves the cell", "it is a cell")).toBeLessThan(
      0.5,
    );
  });

  it("is not punished by extra correct words", () => {
    const exact = coverage("site of respiration", "site of respiration");
    const verbose = coverage(
      "site of respiration",
      "this is the site of respiration, where energy is released for the cell to use",
    );
    expect(verbose).toBe(exact);
  });

  it("scores an empty expectation as zero, never as a free mark", () => {
    expect(coverage("", "anything at all")).toBe(0);
    expect(coverage("   ", "anything at all")).toBe(0);
  });
});

describe("containsPhrase", () => {
  it("matches a contiguous run only", () => {
    expect(containsPhrase("the wall controls what enters", "controls what enters")).toBe(true);
    expect(containsPhrase("the wall controls entry", "controls what enters")).toBe(false);
  });

  it("cannot match a phrase longer than the text", () => {
    expect(containsPhrase("cell", "the cell wall supports the cell")).toBe(false);
  });

  it("ignores an empty phrase rather than matching everything", () => {
    expect(containsPhrase("anything", "")).toBe(false);
  });
});

describe("cost", () => {
  it("uses the introductory rate before 2027 and the higher one after", () => {
    expect(pricingAt(new Date("2026-12-31T23:59:59Z")).inputPerMillionUsd).toBe(0.75);
    expect(pricingAt(new Date(PRICE_RISE_AT)).inputPerMillionUsd).toBe(1.5);
    expect(pricingAt(new Date("2027-06-01T00:00:00Z")).outputPerMillionUsd).toBe(7.5);
  });

  it("prices a typical marking call at about a fifth of a cent", () => {
    // doc 06 §6: ~1,000 in, ~350 out => $0.0021
    const micro = costMicroUsd(
      { inputTokens: 1000, outputTokens: 350 },
      new Date("2026-09-28Z"),
    );
    expect(micro).toBe(Math.ceil(1000 * 0.75e-6 * 1e6 + 350 * 3.75e-6 * 1e6));
    expect(micro / 1e6).toBeCloseTo(0.00206, 5);
  });

  it("doubles from January 2027", () => {
    const before = costMicroUsd(
      { inputTokens: 1000, outputTokens: 350 },
      new Date("2026-12-31Z"),
    );
    const after = costMicroUsd(
      { inputTokens: 1000, outputTokens: 350 },
      new Date("2027-01-01Z"),
    );
    expect(before).toBe(2063); // $0.0020625, rounded up
    expect(after).toBe(4125); // $0.004125, exact
    // Not exactly 2×: each is rounded up independently.
    expect(Math.abs(after - before * 2)).toBeLessThanOrEqual(1);
  });

  it("charges cached input ten times less, and never more than total input", () => {
    const plain = costMicroUsd({ inputTokens: 1000, outputTokens: 0 }, new Date("2026-09-28Z"));
    const cached = costMicroUsd(
      { inputTokens: 1000, outputTokens: 0, cachedInputTokens: 1000 },
      new Date("2026-09-28Z"),
    );
    expect(cached).toBe(Math.ceil(plain / 10));

    // Claiming more cached tokens than were sent cannot produce a negative charge.
    const absurd = costMicroUsd(
      { inputTokens: 100, outputTokens: 0, cachedInputTokens: 10_000 },
      new Date("2026-09-28Z"),
    );
    expect(absurd).toBeGreaterThan(0);
  });

  it("rounds up, so the ceiling trips early rather than late", () => {
    expect(costMicroUsd({ inputTokens: 1, outputTokens: 0 }, new Date("2026-09-28Z"))).toBe(1);
  });

  it("treats rubbish input as zero rather than NaN", () => {
    expect(costMicroUsd({ inputTokens: Number.NaN, outputTokens: -5 })).toBe(0);
  });

  it("formats small amounts without collapsing them to $0.00", () => {
    expect(formatUsd(0)).toBe("$0.00");
    expect(formatUsd(2060)).toBe("$0.0021");
    expect(formatUsd(1_500_000)).toBe("$1.50");
  });
});

describe("markCacheKey", () => {
  const base = {
    questionId: "bio-4112-q03",
    model: "gemini-3.8-flash",
    promptVersion: "markPromptV1",
    answer: "The nucleus controls the cell.",
  };

  it("is stable for the same inputs", () => {
    expect(markCacheKey(base)).toBe(markCacheKey({ ...base }));
  });

  it("ignores differences normalisation is meant to erase", () => {
    expect(markCacheKey({ ...base, answer: "  the NUCLEUS controls the cell!  " })).toBe(
      markCacheKey(base),
    );
  });

  it("changes when anything that could change the mark changes", () => {
    const key = markCacheKey(base);
    expect(markCacheKey({ ...base, questionId: "bio-4112-q04" })).not.toBe(key);
    expect(markCacheKey({ ...base, model: "gemini-3.5-flash-lite" })).not.toBe(key);
    expect(markCacheKey({ ...base, promptVersion: "markPromptV2" })).not.toBe(key);
    expect(markCacheKey({ ...base, answer: "Something else entirely" })).not.toBe(key);
  });

  it("cannot be collided by running fields together", () => {
    const a = markCacheKey({ ...base, questionId: "ab", model: "c" });
    const b = markCacheKey({ ...base, questionId: "a", model: "bc" });
    expect(a).not.toBe(b);
  });
});
