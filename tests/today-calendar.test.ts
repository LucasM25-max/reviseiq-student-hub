import { describe, expect, it } from "vitest";

import {
  academicYearOf,
  crossedBoundary,
  defaultEnglandYear,
  periodFor,
  type PeriodRow,
} from "@/lib/today/calendar";
import { reactionTo, SURPRISE, surpriseFrom } from "@/lib/today/adapt";

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

describe("the default English year", () => {
  const year = defaultEnglandYear(2026);

  it("covers September to August without a gap", () => {
    const sorted = [...year].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

    expect(sorted[0]!.startDate).toEqual(utc(2026, 9, 1));
    expect(sorted[sorted.length - 1]!.endDate).toEqual(utc(2027, 8, 31));

    // Each period starts the day after the previous one ends.
    for (let i = 1; i < sorted.length; i += 1) {
      const gap = sorted[i]!.startDate.getTime() - sorted[i - 1]!.endDate.getTime();
      expect(gap, `gap before ${sorted[i]!.label}`).toBe(24 * 60 * 60 * 1000);
    }
  });

  it("has the holidays a student would expect", () => {
    const labels = year.map((period) => period.label);
    expect(labels).toContain("Christmas");
    expect(labels).toContain("Easter");
    expect(labels).toContain("October half term");
    expect(labels).toContain("Summer holiday");
  });

  it("never starts a period after it ends", () => {
    for (const period of year) {
      expect(period.endDate.getTime(), period.label ?? "").toBeGreaterThanOrEqual(
        period.startDate.getTime(),
      );
    }
  });
});

describe("academicYearOf", () => {
  it("runs September to August", () => {
    expect(academicYearOf(utc(2026, 9, 1))).toBe(2026);
    expect(academicYearOf(utc(2026, 12, 25))).toBe(2026);
    expect(academicYearOf(utc(2027, 1, 5))).toBe(2026);
    expect(academicYearOf(utc(2027, 8, 31))).toBe(2026);
    expect(academicYearOf(utc(2027, 9, 1))).toBe(2027);
  });
});

describe("periodFor", () => {
  const periods: PeriodRow[] = [
    { kind: "TERM", startDate: utc(2027, 4, 13), endDate: utc(2027, 7, 22), label: "Summer" },
    { kind: "STUDY_LEAVE", startDate: utc(2027, 5, 11), endDate: utc(2027, 6, 20) },
    { kind: "HOLIDAY", startDate: utc(2027, 3, 28), endDate: utc(2027, 4, 12) },
  ];

  it("finds the period covering a date", () => {
    expect(periodFor(utc(2027, 4, 1), periods)?.kind).toBe("HOLIDAY");
    expect(periodFor(utc(2027, 4, 20), periods)?.kind).toBe("TERM");
  });

  it("lets study leave win over the term it sits inside", () => {
    // Study leave describes what the student is actually doing.
    expect(periodFor(utc(2027, 5, 20), periods)?.kind).toBe("STUDY_LEAVE");
  });

  it("includes both end points", () => {
    expect(periodFor(utc(2027, 4, 13), periods)?.kind).toBe("TERM");
    expect(periodFor(utc(2027, 7, 22), periods)?.kind).toBe("TERM");
  });

  it("returns null outside everything, rather than guessing", () => {
    expect(periodFor(utc(2029, 1, 1), periods)).toBeNull();
    expect(periodFor(utc(2027, 4, 1), [])).toBeNull();
  });

  it("lets a later edit laid over a default take effect", () => {
    const withEdit: PeriodRow[] = [
      { kind: "TERM", startDate: utc(2027, 4, 13), endDate: utc(2027, 7, 22) },
      {
        kind: "TERM",
        startDate: utc(2027, 4, 20),
        endDate: utc(2027, 7, 30),
        label: "Corrected",
      },
    ];
    expect(periodFor(utc(2027, 5, 1), withEdit)?.label).toBe("Corrected");
  });
});

describe("crossedBoundary", () => {
  const periods: PeriodRow[] = [
    { kind: "TERM", startDate: utc(2027, 3, 1), endDate: utc(2027, 3, 27) },
    { kind: "HOLIDAY", startDate: utc(2027, 3, 28), endDate: utc(2027, 4, 12) },
  ];

  it("notices the move from term into a holiday", () => {
    expect(crossedBoundary(utc(2027, 3, 27), utc(2027, 3, 28), periods)).toBe(true);
  });

  it("is quiet within one period", () => {
    expect(crossedBoundary(utc(2027, 3, 2), utc(2027, 3, 3), periods)).toBe(false);
  });
});

describe("adaptive re-ranking", () => {
  it("ignores a result that is roughly what was expected", () => {
    expect(surpriseFrom(3, 6)).toBeNull();
    expect(surpriseFrom(4, 6)).toBeNull();
  });

  it("notices a student struggling", () => {
    expect(surpriseFrom(1, 6)).toBe("STRUGGLED");
    expect(surpriseFrom(0, 3)).toBe("STRUGGLED");
  });

  it("notices a student breezing it", () => {
    expect(surpriseFrom(6, 6)).toBe("BREEZED");
    expect(surpriseFrom(3, 3)).toBe("BREEZED");
  });

  it("never twitches over a single one-marker", () => {
    // One mark either way is noise, not a signal.
    expect(surpriseFrom(0, 1)).toBeNull();
    expect(surpriseFrom(1, 1)).toBeNull();
  });

  it("survives nonsense input", () => {
    expect(surpriseFrom(Number.NaN, 6)).toBeNull();
    expect(surpriseFrom(99, 6)).toBe("BREEZED");
    expect(surpriseFrom(-5, 6)).toBe("STRUGGLED");
  });

  it("uses the documented thresholds", () => {
    expect(SURPRISE.low).toBe(0.4);
    expect(SURPRISE.high).toBe(0.9);
  });

  it("only ever removes work, and explains itself", () => {
    const struggled = reactionTo("STRUGGLED");
    const breezed = reactionTo("BREEZED");

    expect(struggled?.drop).toContain("QUESTIONS");
    expect(breezed?.drop).toContain("NOTES");

    // More questions on something you just scored 1/6 on is not the next right thing.
    expect(struggled?.drop).not.toContain("NOTES");
    expect(breezed?.drop).not.toContain("QUESTIONS");

    expect(struggled?.message.length).toBeGreaterThan(10);
    expect(breezed?.message.length).toBeGreaterThan(10);
  });

  it("does nothing when nothing was surprising", () => {
    expect(reactionTo(null)).toBeNull();
  });
});
