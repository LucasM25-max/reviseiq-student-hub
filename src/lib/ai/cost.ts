/**
 * What a call cost.
 *
 * Money is held as integer micro-dollars everywhere. Floating point dollars accumulate
 * error across a ledger, and the ledger is the thing the monthly ceiling is checked
 * against, so it has to be exact.
 *
 * Pricing is date-aware because `gemini-3.8-flash` doubles on 1 January 2027 (doc 06
 * §6). Hard-coding today's price would silently halve every projection the moment it
 * changes, which is precisely when the numbers start to matter.
 */

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  /** Portion of `inputTokens` served from Gemini's context cache, at 10× less. */
  cachedInputTokens?: number;
};

export type Pricing = {
  inputPerMillionUsd: number;
  outputPerMillionUsd: number;
  cachedInputPerMillionUsd: number;
};

const INTRODUCTORY: Pricing = {
  inputPerMillionUsd: 0.75,
  outputPerMillionUsd: 3.75,
  cachedInputPerMillionUsd: 0.075,
};

const FROM_2027: Pricing = {
  inputPerMillionUsd: 1.5,
  outputPerMillionUsd: 7.5,
  cachedInputPerMillionUsd: 0.15,
};

/** The introductory rate ends at the start of 1 January 2027, UTC. */
export const PRICE_RISE_AT = Date.UTC(2027, 0, 1);

export function pricingAt(when: Date = new Date()): Pricing {
  return when.getTime() >= PRICE_RISE_AT ? FROM_2027 : INTRODUCTORY;
}

const MICRO = 1_000_000;

/**
 * Cost in micro-dollars, rounded up.
 *
 * Rounding up rather than to nearest keeps the ledger a conservative bound: the
 * ceiling should trip slightly early rather than slightly late.
 */
export function costMicroUsd(usage: TokenUsage, when: Date = new Date()): number {
  const price = pricingAt(when);

  const input = Math.max(0, Math.trunc(usage.inputTokens) || 0);
  const output = Math.max(0, Math.trunc(usage.outputTokens) || 0);
  const cached = Math.min(Math.max(0, Math.trunc(usage.cachedInputTokens ?? 0) || 0), input);
  const fresh = input - cached;

  const dollars =
    (fresh / MICRO) * price.inputPerMillionUsd +
    (cached / MICRO) * price.cachedInputPerMillionUsd +
    (output / MICRO) * price.outputPerMillionUsd;

  return Math.ceil(dollars * MICRO);
}

/** For display only. */
export function formatUsd(micro: number): string {
  const dollars = micro / MICRO;
  if (dollars === 0) return "$0.00";
  if (dollars < 0.01) return `$${dollars.toFixed(4)}`;
  return `$${dollars.toFixed(2)}`;
}

export const usdToMicro = (usd: number): number => Math.round(usd * MICRO);
