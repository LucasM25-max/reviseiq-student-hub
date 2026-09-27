import { hash, verify, type Algorithm } from "@node-rs/argon2";

/**
 * The argon2id primitives, kept free of `server-only` so non-request code — the
 * database seed, one-off scripts — can produce hashes the app will accept. Application
 * code should import from ./password, which re-exports these alongside the policy.
 *
 * @node-rs/argon2 declares `Algorithm` as an ambient const enum. It can't be read as a
 * value under `isolatedModules`, and its runtime export is an empty object — so
 * `Algorithm.Argon2id` would silently be `undefined`. The member's own numeric value is
 * used instead, checked against the declared type.
 */
const ARGON2ID: Algorithm = 2;

/**
 * OWASP's recommended baseline (19 MiB memory, 2 iterations, 1 degree of parallelism).
 * Memory-hard by design, so a leaked database is expensive to attack.
 *
 * These must stay identical everywhere: a hash written with different parameters still
 * verifies, but one written by a *different* algorithm does not.
 */
const ARGON2_OPTIONS = {
  algorithm: ARGON2ID,
  memoryCost: 19_456, // KiB — 19 MiB
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
} as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(hashed: string, password: string): Promise<boolean> {
  try {
    return await verify(hashed, password, ARGON2_OPTIONS);
  } catch {
    // A malformed or truncated hash must read as "wrong password", never as a crash.
    return false;
  }
}
