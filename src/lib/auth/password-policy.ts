/**
 * Password policy.
 *
 * Isolated from password.ts (which pulls in argon2 and `server-only`) so the sign-up
 * form can apply exactly the same rules live, in the browser, as the server applies on
 * submit. One definition, two callers — the two can never drift.
 */

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 200;

/**
 * The most-breached passwords, normalised. Deliberately a short curated list rather than
 * a megabyte dependency: it catches the overwhelming majority of real-world bad choices
 * at zero bundle cost. A full strength estimator (zxcvbn) is a Phase 11 upgrade.
 */
const COMMON_PASSWORDS = new Set([
  "password",
  "password1",
  "password12",
  "password123",
  "password1234",
  "passw0rd123",
  "123456789",
  "1234567890",
  "12345678910",
  "qwertyuiop",
  "qwerty123",
  "qwerty12345",
  "1q2w3e4r5t",
  "iloveyou123",
  "letmein123",
  "welcome123",
  "admin12345",
  "football123",
  "liverpool1",
  "manchester",
  "arsenal123",
  "chelsea123",
  "princess1",
  "sunshine1",
  "superman1",
  "trustno1234",
  "monkey1234",
  "dragon1234",
  "baseball12",
  "abc12345678",
  "revision123",
  "reviseiq123",
  "biology123",
  "chemistry1",
  "physics123",
  "school1234",
  "homework123",
]);

export type PasswordProblem = string;

/**
 * Returns a human-readable problem, or null when the password is acceptable.
 * Messages are written to tell the student what to do, not to scold them.
 */
export function checkPasswordStrength(
  password: string,
  email?: string,
): PasswordProblem | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Keep it under ${PASSWORD_MAX_LENGTH} characters.`;
  }

  const normalised = password.toLowerCase().replace(/[^a-z0-9]/g, "");

  if (COMMON_PASSWORDS.has(normalised)) {
    return "That's one of the most commonly used passwords. Pick something less guessable.";
  }

  if (new Set(password).size <= 3) {
    return "Too repetitive — use a wider mix of characters.";
  }

  if (isSequential(password.toLowerCase())) {
    return "Avoid simple sequences like 1234 or abcd running through the whole password.";
  }

  if (email) {
    const localPart = email.split("@")[0]?.toLowerCase() ?? "";
    if (localPart.length >= 4 && normalised.includes(localPart.replace(/[^a-z0-9]/g, ""))) {
      return "Don't build your password out of your email address.";
    }
  }

  return null;
}

/** True when the string is one long run of consecutive characters, e.g. "abcdefghij". */
function isSequential(value: string): boolean {
  if (value.length < PASSWORD_MIN_LENGTH) return false;

  let ascending = true;
  let descending = true;

  for (let i = 1; i < value.length; i += 1) {
    const delta = value.charCodeAt(i) - value.charCodeAt(i - 1);
    if (delta !== 1) ascending = false;
    if (delta !== -1) descending = false;
    if (!ascending && !descending) return false;
  }

  return ascending || descending;
}
