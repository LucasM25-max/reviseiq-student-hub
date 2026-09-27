/**
 * A deterministic shuffle.
 *
 * Widgets present answer banks in a scrambled order, and that order must be identical on
 * the server and in the browser. `Math.random()` would give two different orders and
 * React would throw a hydration mismatch — so the order is derived from a seed built out
 * of the widget's own content, which means it is stable across renders, across processes
 * and across deploys, while still looking arbitrary to a student.
 *
 * Stability has a second benefit: a student who reloads mid-task sees the same layout
 * rather than having the cards move under them.
 */

/** FNV-1a. Small, fast, and good enough to spread short strings across 32 bits. */
export function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    // The FNV prime, applied with 32-bit wraparound via Math.imul.
    hash = Math.imul(hash, 0x01000193);
  }
  // `>>> 0` forces an unsigned 32-bit result; the hash is only ever used as a seed.
  return hash >>> 0;
}

/** mulberry32 — a tiny PRNG with a 32-bit state. Returns values in [0, 1). */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fisher–Yates, seeded. Returns a new array; the input is not mutated.
 *
 * A shuffle that happens to return the original order is not wrong, but for a matching
 * task it is a free answer, so `seededShuffle` rotates by one when the permutation comes
 * back unchanged and the list is long enough for that to be meaningful.
 */
export function seededShuffle<T>(items: readonly T[], seed: string | number): T[] {
  const random = mulberry32(typeof seed === "string" ? hashString(seed) : seed);
  const result = [...items];

  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  if (result.length > 1 && result.every((item, index) => item === items[index])) {
    result.push(result.shift() as T);
  }

  return result;
}
