import { describe, expect, it } from "vitest";

import { ageOn, isUnderMinimumAge, MINIMUM_AGE, parseDateOfBirth } from "@/lib/auth/age";

const now = new Date("2026-09-27T12:00:00.000Z");

describe("ageOn", () => {
  it("counts whole years", () => {
    expect(ageOn(new Date(Date.UTC(2010, 8, 27)), now)).toBe(16);
    expect(ageOn(new Date(Date.UTC(2010, 0, 1)), now)).toBe(16);
  });

  it("does not credit a birthday that hasn't happened yet", () => {
    expect(ageOn(new Date(Date.UTC(2010, 8, 28)), now)).toBe(15);
    expect(ageOn(new Date(Date.UTC(2010, 11, 31)), now)).toBe(15);
  });

  it("treats the birthday itself as the new age", () => {
    expect(ageOn(new Date(Date.UTC(2013, 8, 27)), now)).toBe(13);
  });
});

describe("isUnderMinimumAge", () => {
  it("blocks the day before the thirteenth birthday", () => {
    expect(isUnderMinimumAge(new Date(Date.UTC(2013, 8, 28)), now)).toBe(true);
  });

  it("allows the thirteenth birthday", () => {
    expect(isUnderMinimumAge(new Date(Date.UTC(2013, 8, 27)), now)).toBe(false);
  });
});

describe("parseDateOfBirth", () => {
  it("accepts a valid date and returns midnight UTC", () => {
    const result = parseDateOfBirth("2010-05-17", now);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.toISOString()).toBe("2010-05-17T00:00:00.000Z");
    }
  });

  it("rejects an empty or missing value", () => {
    expect(parseDateOfBirth("", now).ok).toBe(false);
    expect(parseDateOfBirth(undefined, now).ok).toBe(false);
    expect(parseDateOfBirth(null, now).ok).toBe(false);
    expect(parseDateOfBirth(42, now).ok).toBe(false);
  });

  it("rejects a malformed value", () => {
    expect(parseDateOfBirth("17/05/2010", now).ok).toBe(false);
    expect(parseDateOfBirth("2010-5-17", now).ok).toBe(false);
    expect(parseDateOfBirth("not a date", now).ok).toBe(false);
  });

  it("rejects a date that doesn't exist rather than rolling it over", () => {
    // `new Date(Date.UTC(2011, 1, 30))` would silently become 2 March.
    const result = parseDateOfBirth("2011-02-30", now);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("doesn't exist");
  });

  it("rejects a future date", () => {
    const result = parseDateOfBirth("2030-01-01", now);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("future");
  });

  it("rejects an implausible year", () => {
    const result = parseDateOfBirth("0210-01-01", now);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("typo");
  });

  it("flags under-13s specifically so the caller can delete the account", () => {
    const result = parseDateOfBirth("2015-01-01", now);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.tooYoung).toBe(true);
      expect(result.error).toContain(String(MINIMUM_AGE));
    }
  });

  it("accepts someone who turns 13 today", () => {
    expect(parseDateOfBirth("2013-09-27", now).ok).toBe(true);
  });

  it("rejects someone who turns 13 tomorrow", () => {
    const result = parseDateOfBirth("2013-09-28", now);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.tooYoung).toBe(true);
  });
});
