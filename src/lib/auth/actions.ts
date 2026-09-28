"use server";

import { AuthError } from "next-auth";
import { cookies } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { signIn, signOut } from "@/lib/auth/auth";
import { parseDateOfBirth } from "@/lib/auth/age";
import { checkPasswordStrength, hashPassword, PASSWORD_MAX_LENGTH } from "@/lib/auth/password";
import {
  consumePasswordResetToken,
  createEmailVerificationToken,
  createPasswordResetToken,
  EMAIL_VERIFICATION_TTL_MINUTES,
  PASSWORD_RESET_TTL_MINUTES,
} from "@/lib/auth/tokens";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import {
  canRevealLinksInUi,
  passwordResetEmail,
  sendMail,
  verificationEmail,
} from "@/lib/email/mailer";
import { formatRetryAfter, rateLimit } from "@/lib/rate-limit";
import { absoluteUrl, clientIp, safeRedirectPath } from "@/lib/url";
import { fieldError, formError, formSuccess, text, type FormState } from "@/lib/forms";

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address."))
  .pipe(z.string().max(254));

const GENERIC_SIGN_IN_ERROR = "That email and password don't match. Try again.";

// ---------------------------------------------------------------------------
// Sign up
// ---------------------------------------------------------------------------

export async function signUpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = text(formData, "name");
  const rawEmail = text(formData, "email");
  const password = formData.get("password");
  const rawDob = text(formData, "dateOfBirth");

  const fieldErrors: Record<string, string> = {};

  const email = emailSchema.safeParse(rawEmail ?? "");
  if (!email.success) fieldErrors.email = "Enter a valid email address.";

  if (typeof password !== "string" || password.length === 0) {
    fieldErrors.password = "Choose a password.";
  } else {
    const problem = checkPasswordStrength(password, rawEmail);
    if (problem) fieldErrors.password = problem;
  }

  const dob = parseDateOfBirth(rawDob);
  if (!dob.ok) fieldErrors.dateOfBirth = dob.error;

  if (name && name.length > 80) fieldErrors.name = "That's a bit long — 80 characters max.";

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  // Types are narrowed by the guard above, but TypeScript can't see that.
  if (!email.success || !dob.ok || typeof password !== "string") {
    return formError("Something went wrong. Try again.");
  }

  const ip = await clientIp();
  const limit = await rateLimit("signup", ip);
  if (!limit.allowed) {
    return formError(
      `Too many accounts created from this connection. Try again ${formatRetryAfter(limit.retryAfterSeconds)}.`,
    );
  }

  const existing = await prisma.user.findUnique({
    where: { email: email.data },
    select: { id: true },
  });

  if (existing) {
    // Sign-up is the one place where telling the truth about an existing address is
    // worth more than hiding it: the alternative silently strands a student who has
    // simply forgotten they already registered.
    return fieldError("email", "There's already an account with this email. Log in instead.");
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      email: email.data,
      name: name ?? null,
      passwordHash,
      dateOfBirth: dob.value,
      profile: { create: {} },
    },
    select: { id: true, email: true },
  });

  await sendVerificationEmail(user.id, user.email);

  // Sign in immediately. Verification is required before Today will build a plan, but
  // it should not stand between a new student and onboarding.
  const signedIn = await attemptCredentialsSignIn(email.data, password);

  redirect(signedIn ? "/onboarding/subjects" : "/login?created=1");
}

// ---------------------------------------------------------------------------
// Sign in / out
// ---------------------------------------------------------------------------

/**
 * Whether the browser is keeping the cookies we set.
 *
 * Rendering the login page always sets a CSRF cookie, so any submission of that form
 * should carry at least one cookie back. None at all means the browser is discarding
 * everything we send — which is what a cross-site iframe looks like when third-party
 * cookies are blocked.
 *
 * Worth detecting explicitly because the failure is otherwise completely silent and
 * looks like a broken button: signing in genuinely succeeds, the session cookie is
 * genuinely set, the browser throws it away, and the redirect lands back on the login
 * page with nothing to show for it. The student sees the form reappear and has no way
 * of knowing why.
 */
async function browserKeepsCookies(): Promise<boolean> {
  const jar = await cookies();
  return jar.getAll().length > 0;
}

const COOKIES_BLOCKED_ERROR =
  "Your browser is blocking cookies for this page, so we can't keep you signed in. " +
  "This usually happens when the app is shown inside another site — open it in its own " +
  "browser tab and sign in there.";

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const rawEmail = text(formData, "email");
  const password = formData.get("password");
  const next = safeRedirectPath(text(formData, "next"), "/today");

  const email = emailSchema.safeParse(rawEmail ?? "");

  if (!email.success || typeof password !== "string" || password.length === 0) {
    return formError(GENERIC_SIGN_IN_ERROR);
  }

  // Checked before the attempt, so a student is never told their details are wrong
  // when the real problem is that the session could never have been kept.
  if (!(await browserKeepsCookies())) return formError(COOKIES_BLOCKED_ERROR);

  const signedIn = await attemptCredentialsSignIn(email.data, password);
  if (!signedIn) return formError(GENERIC_SIGN_IN_ERROR);

  redirect(next);
}

export async function signInWithGoogleAction(formData: FormData): Promise<void> {
  const next = safeRedirectPath(text(formData, "next"), "/today");
  await signIn("google", { redirectTo: next });
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/" });
}

// ---------------------------------------------------------------------------
// Email verification
// ---------------------------------------------------------------------------

export async function resendVerificationAction(
  _prev: FormState,
  _formData: FormData,
): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return formError("You need to be signed in to do that.");
  if (user.isEmailVerified) return formSuccess("Your email is already confirmed.");

  const limit = await rateLimit("emailVerification", user.id);
  if (!limit.allowed) {
    return formError(
      `We've sent a few already. Check your spam folder, or try again ${formatRetryAfter(limit.retryAfterSeconds)}.`,
    );
  }

  const link = await sendVerificationEmail(user.id, user.email);

  return formSuccess(
    "Sent. Check your inbox.",
    canRevealLinksInUi && link ? { devLink: link } : undefined,
  );
}

async function sendVerificationEmail(userId: string, email: string): Promise<string | null> {
  const token = await createEmailVerificationToken(userId);
  const link = await absoluteUrl(`/verify-email?token=${encodeURIComponent(token)}`);

  await sendMail(
    verificationEmail(email, link, Math.round(EMAIL_VERIFICATION_TTL_MINUTES / 60)),
  );

  return canRevealLinksInUi ? link : null;
}

// ---------------------------------------------------------------------------
// Password reset
// ---------------------------------------------------------------------------

export async function requestPasswordResetAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const rawEmail = text(formData, "email");
  const email = emailSchema.safeParse(rawEmail ?? "");

  if (!email.success) return fieldError("email", "Enter a valid email address.");

  const limit = await rateLimit("passwordReset", email.data);

  // The response is identical whether or not the address exists, and whether or not it
  // was throttled — otherwise this endpoint becomes an account-existence oracle.
  const confirmation = formSuccess(
    "If there's an account with that email, a reset link is on its way.",
  );

  if (!limit.allowed) return confirmation;

  const user = await prisma.user.findFirst({
    where: { email: email.data, deletedAt: null },
    select: { id: true, email: true, passwordHash: true },
  });

  if (!user) return confirmation;

  const token = await createPasswordResetToken(user.id);
  const link = await absoluteUrl(`/reset-password?token=${encodeURIComponent(token)}`);

  await sendMail(passwordResetEmail(user.email, link, PASSWORD_RESET_TTL_MINUTES));

  if (canRevealLinksInUi) return formSuccess(confirmation.message, { devLink: link });
  return confirmation;
}

export async function resetPasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = text(formData, "token");
  const password = formData.get("password");
  const confirm = formData.get("confirmPassword");

  if (!token) return formError("That reset link is no longer valid. Request a new one.");

  if (typeof password !== "string" || password.length === 0) {
    return fieldError("password", "Choose a new password.");
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    return fieldError("password", `Keep it under ${PASSWORD_MAX_LENGTH} characters.`);
  }

  const problem = checkPasswordStrength(password);
  if (problem) return fieldError("password", problem);

  if (password !== confirm) {
    return fieldError("confirmPassword", "Both passwords need to match.");
  }

  const hash = await hashPassword(password);
  const result = await consumePasswordResetToken(token, hash);

  if (!result.ok) {
    const reason =
      result.reason === "expired"
        ? "That link has expired."
        : result.reason === "used"
          ? "That link has already been used."
          : "That link isn't valid.";
    return formError(`${reason} Request a new one and we'll send a fresh link.`);
  }

  redirect("/login?reset=1");
}

// ---------------------------------------------------------------------------
// Date of birth (Google sign-ups, who never supplied one)
// ---------------------------------------------------------------------------

export async function setDateOfBirthAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return formError("You need to be signed in to do that.");

  const dob = parseDateOfBirth(text(formData, "dateOfBirth"));

  if (!dob.ok) {
    if (dob.tooYoung) {
      // Refusing the account means not keeping the child's data either.
      await prisma.user.delete({ where: { id: user.id } });
      await signOut({ redirectTo: "/too-young" });
    }
    return fieldError("dateOfBirth", dob.error);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { dateOfBirth: dob.value },
  });

  redirect("/onboarding/subjects");
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

/**
 * Wraps Auth.js sign-in so callers get a boolean instead of an exception.
 *
 * Next's `redirect()` also communicates by throwing, so that specific error has to be
 * re-thrown rather than swallowed as a failed login.
 */
async function attemptCredentialsSignIn(email: string, password: string): Promise<boolean> {
  try {
    await signIn("credentials", { email, password, redirect: false });
    return true;
  } catch (error) {
    // Re-throws Next's control-flow signals (redirect, notFound, dynamic usage) untouched.
    unstable_rethrow(error);
    if (error instanceof AuthError) return false;
    throw error;
  }
}
