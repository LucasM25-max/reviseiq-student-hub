import { describe, expect, it } from "vitest";

import { daysUntil, estimatedExamDates, examSeriesOptions } from "@/lib/curriculum/exam-dates";
import { SUBJECTS } from "@/lib/curriculum/taxonomy";

describe("estimatedExamDates", () => {
  it("returns one date per paper for every subject", () => {
    for (const subject of SUBJECTS) {
      const dates = estimatedExamDates(subject.code, 2027);
      expect(dates.map((entry) => entry.paper)).toEqual([1, 2]);
    }
  });

  it("puts Paper 1 in May and Paper 2 in June", () => {
    for (const subject of SUBJECTS) {
      const [paperOne, paperTwo] = estimatedExamDates(subject.code, 2027);
      expect(paperOne.date.getUTCMonth()).toBe(4);
      expect(paperTwo.date.getUTCMonth()).toBe(5);
      expect(paperTwo.date.getTime()).toBeGreaterThan(paperOne.date.getTime());
    }
  });

  it("never schedules two papers on the same day", () => {
    const all = SUBJECTS.flatMap((subject) =>
      estimatedExamDates(subject.code, 2027).map((entry) => entry.date.toISOString()),
    );
    expect(new Set(all).size).toBe(all.length);
  });

  it("produces dates in the requested year", () => {
    for (const year of [2026, 2027, 2028]) {
      for (const entry of estimatedExamDates("BIOLOGY", year)) {
        expect(entry.date.getUTCFullYear()).toBe(year);
      }
    }
  });

  it("anchors on weekdays, never a weekend", () => {
    for (const subject of SUBJECTS) {
      for (const entry of estimatedExamDates(subject.code, 2027)) {
        const weekday = entry.date.getUTCDay();
        expect(weekday).toBeGreaterThanOrEqual(1);
        expect(weekday).toBeLessThanOrEqual(5);
      }
    }
  });
});

describe("examSeriesOptions", () => {
  it("offers this summer and the next during the school year", () => {
    expect(examSeriesOptions(new Date("2027-01-15T00:00:00Z"))).toEqual([2027, 2028]);
  });

  it("rolls over once the summer series is done", () => {
    expect(examSeriesOptions(new Date("2026-09-27T00:00:00Z"))).toEqual([2027, 2028]);
    expect(examSeriesOptions(new Date("2026-07-01T00:00:00Z"))).toEqual([2027, 2028]);
  });

  it("still offers the current year in the middle of the exam season", () => {
    expect(examSeriesOptions(new Date("2027-05-20T00:00:00Z"))).toEqual([2027, 2028]);
  });
});

describe("daysUntil", () => {
  it("counts whole days from the start of today", () => {
    const from = new Date("2026-09-27T23:30:00.000Z");
    expect(daysUntil(new Date(Date.UTC(2026, 8, 28)), from)).toBe(1);
    expect(daysUntil(new Date(Date.UTC(2026, 8, 27)), from)).toBe(0);
  });

  it("goes negative once the date has passed", () => {
    const from = new Date("2026-09-27T09:00:00.000Z");
    expect(daysUntil(new Date(Date.UTC(2026, 8, 20)), from)).toBe(-7);
  });
});
