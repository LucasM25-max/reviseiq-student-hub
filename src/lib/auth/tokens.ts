import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { prisma } from "@/lib/db/prisma";

/**
 * Single-use, expiring tokens for email verification and password reset.
 *
 * Only the sha256 of each token is stored. A database leak therefore yields nothing
 * usable — the raw token exists only in the email that was sent.
 */

export const EMAIL_VERIFICATION_TTL_MINUTES = 60 * 24; // 24 hours
export const PASSWORD_RESET_TTL_MINUTES = 60; // 1 hour

function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Constant-time comparison, to keep token checks free of timing signals. */
export function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

function expiryFromNow(minutes: number): Date {
  return new Date(Date.now() + minutes * 60_000);
}

/**
 * Issues an email-verification token, invalidating any outstanding ones so a single
 * account never has two live links.
 */
export async function createEmailVerificationToken(userId: string): Promise<string> {
  const token = generateToken();

  await prisma.$transaction([
    prisma.emailVerificationToken.deleteMany({ where: { userId, usedAt: null } }),
    prisma.emailVerificationToken.create({
      data: {
        userId,
        tokenHash: hashToken(token),
        expiresAt: expiryFromNow(EMAIL_VERIFICATION_TTL_MINUTES),
      },
    }),
  ]);

  return token;
}

export type TokenResult =
  { ok: true; userId: string } | { ok: false; reason: "invalid" | "expired" | "used" };

export async function consumeEmailVerificationToken(token: string): Promise<TokenResult> {
  const record = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });

  if (!record) return { ok: false, reason: "invalid" };
  if (record.usedAt) return { ok: false, reason: "used" };
  if (record.expiresAt.getTime() < Date.now()) return { ok: false, reason: "expired" };

  await prisma.$transaction([
    prisma.emailVerificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerified: new Date() },
    }),
  ]);

  return { ok: true, userId: record.userId };
}

export async function createPasswordResetToken(userId: string): Promise<string> {
  const token = generateToken();

  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId, usedAt: null } }),
    prisma.passwordResetToken.create({
      data: {
        userId,
        tokenHash: hashToken(token),
        expiresAt: expiryFromNow(PASSWORD_RESET_TTL_MINUTES),
      },
    }),
  ]);

  return token;
}

/** Validates without consuming — used to decide whether to render the reset form. */
export async function peekPasswordResetToken(token: string): Promise<TokenResult> {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });

  if (!record) return { ok: false, reason: "invalid" };
  if (record.usedAt) return { ok: false, reason: "used" };
  if (record.expiresAt.getTime() < Date.now()) return { ok: false, reason: "expired" };

  return { ok: true, userId: record.userId };
}

/**
 * Consumes a reset token and sets the new password in one transaction. Also marks the
 * email verified: possession of the inbox has just been demonstrated.
 */
export async function consumePasswordResetToken(
  token: string,
  newPasswordHash: string,
): Promise<TokenResult> {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });

  if (!record) return { ok: false, reason: "invalid" };
  if (record.usedAt) return { ok: false, reason: "used" };
  if (record.expiresAt.getTime() < Date.now()) return { ok: false, reason: "expired" };

  await prisma.$transaction([
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: record.userId },
      data: {
        passwordHash: newPasswordHash,
        emailVerified: new Date(),
      },
    }),
    // Any other outstanding reset links for this account are now void.
    prisma.passwordResetToken.deleteMany({
      where: { userId: record.userId, usedAt: null },
    }),
    // Database sessions are unused (JWT strategy) but clearing them is correct hygiene.
    prisma.session.deleteMany({ where: { userId: record.userId } }),
  ]);

  return { ok: true, userId: record.userId };
}

/** Housekeeping for a future cron job; safe to call at any time. */
export async function purgeExpiredTokens(): Promise<number> {
  const now = new Date();
  const [emails, passwords] = await prisma.$transaction([
    prisma.emailVerificationToken.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: now } } }),
  ]);
  return emails.count + passwords.count;
}
