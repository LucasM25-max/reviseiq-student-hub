import "server-only";

import { hash, verify, type Algorithm } from "@node-rs/argon2";

/**
 * @node-rs/argon2 declares `Algorithm` as an ambient const enum. It can't be read as a
 * value under `isolatedModules`, and its runtime export is an empty object — so
 * `Algorithm.Argon2id` would silently be `undefined`. The member's own numeric value is
 * used instead, checked against the declared type.
 */
const ARGON2ID: Algorithm = 2;

/**
 * Password hashing.
 *
 * argon2id with OWASP's recommended baseline (19 MiB memory, 2 iterations, 1 degree of
 * parallelism). Memory-hard by design, so a leaked database is expensive to attack.
 *
 * The policy rules live in ./password-policy so the browser can apply the same ones.
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

export {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  checkPasswordStrength,
  type PasswordProblem,
} from "@/lib/auth/password-policy";
