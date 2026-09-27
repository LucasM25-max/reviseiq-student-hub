/**
 * Age gate (docs/plan/07-privacy-compliance.md).
 *
 * ReviseIQ is for GCSE students, and under-13s cannot consent to processing under UK
 * GDPR without a parent. Rather than build parental-consent flows for a group the
 * product isn't aimed at, accounts below the threshold are refused outright.
 */

export const MINIMUM_AGE = 13;

/** Oldest date of birth we treat as plausible — guards against typos and bad data. */
export const OLDEST_PLAUSIBLE_YEAR = 1900;

export function ageOn(dateOfBirth: Date, on: Date = new Date()): number {
  let age = on.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const monthDelta = on.getUTCMonth() - dateOfBirth.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && on.getUTCDate() < dateOfBirth.getUTCDate())) {
    age -= 1;
  }
  return age;
}

export function isUnderMinimumAge(dateOfBirth: Date, on: Date = new Date()): boolean {
  return ageOn(dateOfBirth, on) < MINIMUM_AGE;
}

export type DateOfBirthResult =
  { ok: true; value: Date } | { ok: false; error: string; tooYoung?: boolean };

/**
 * Parses a `<input type="date">` value (YYYY-MM-DD) into a UTC date and applies the gate.
 * Kept free of dependencies so it can be unit-tested and reused on both sides.
 */
export function parseDateOfBirth(input: unknown, now: Date = new Date()): DateOfBirthResult {
  if (typeof input !== "string" || input.trim() === "") {
    return { ok: false, error: "Enter your date of birth." };
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.trim());
  if (!match) return { ok: false, error: "Enter your date of birth as a valid date." };

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const value = new Date(Date.UTC(year, month - 1, day));

  // Rejects impossible dates such as 2011-02-30, which Date would silently roll over.
  if (
    value.getUTCFullYear() !== year ||
    value.getUTCMonth() !== month - 1 ||
    value.getUTCDate() !== day
  ) {
    return { ok: false, error: "That date doesn't exist. Check the day and month." };
  }

  if (year < OLDEST_PLAUSIBLE_YEAR) {
    return { ok: false, error: "Check the year — that looks like a typo." };
  }

  if (value.getTime() > now.getTime()) {
    return { ok: false, error: "Your date of birth can't be in the future." };
  }

  if (isUnderMinimumAge(value, now)) {
    return {
      ok: false,
      tooYoung: true,
      error: `You need to be at least ${MINIMUM_AGE} to have a ReviseIQ account.`,
    };
  }

  return { ok: true, value };
}
