import "server-only";

/**
 * Password hashing and policy, for request-handling code.
 *
 * The argon2id primitives live in ./password-hash, which carries no `server-only`
 * guard so the database seed can share the exact same parameters. The policy rules
 * live in ./password-policy so the browser can apply the same ones.
 */

export { hashPassword, verifyPassword } from "@/lib/auth/password-hash";

export {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  checkPasswordStrength,
  type PasswordProblem,
} from "@/lib/auth/password-policy";
