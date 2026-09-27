import "server-only";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { env, isEmailEnabled, isProduction } from "@/lib/env";

/**
 * Email delivery.
 *
 * With RESEND_API_KEY set, mail goes out through Resend. Without it, mail is written to
 * the server console and to ./.mail as HTML — so verification and password reset are
 * fully exercisable in development and in CI without a provider account or a network
 * round trip. The application code never branches on which transport is active.
 */

export type Mail = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type SendResult =
  { ok: true; transport: "resend" | "log" } | { ok: false; error: string };

const MAIL_DIR = path.join(process.cwd(), ".mail");

export async function sendMail(mail: Mail): Promise<SendResult> {
  if (!isEmailEnabled) return logTransport(mail);

  try {
    // Imported lazily so the SDK is not pulled into the bundle when unused.
    const { Resend } = await import("resend");
    const resend = new Resend(env.RESEND_API_KEY);

    const { error } = await resend.emails.send({
      from: env.EMAIL_FROM,
      to: mail.to,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    });

    if (error) return { ok: false, error: error.message };
    return { ok: true, transport: "resend" };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unknown email error" };
  }
}

async function logTransport(mail: Mail): Promise<SendResult> {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safeRecipient = mail.to.replace(/[^a-z0-9]/gi, "_");
  const file = path.join(MAIL_DIR, `${stamp}__${safeRecipient}.html`);

  console.info(
    [
      "",
      "──────────────────────────────────────────────────────────────",
      " EMAIL (no RESEND_API_KEY — not actually sent)",
      `  to:      ${mail.to}`,
      `  subject: ${mail.subject}`,
      "",
      mail.text.trim(),
      `  saved to: ${path.relative(process.cwd(), file)}`,
      "──────────────────────────────────────────────────────────────",
      "",
    ].join("\n"),
  );

  try {
    await mkdir(MAIL_DIR, { recursive: true });
    await writeFile(file, mail.html, "utf8");
  } catch {
    // Writing the copy is a convenience; never fail a sign-up because of it.
  }

  return { ok: true, transport: "log" };
}

/** Shared shell so every email looks like it came from the same product. */
function layout(heading: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>${escapeHtml(heading)}</title></head>
  <body style="margin:0;padding:24px;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2430;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e3e6eb;border-radius:12px;">
      <tr><td style="padding:28px 28px 8px;">
        <p style="margin:0 0 20px;font-size:15px;font-weight:700;letter-spacing:-0.01em;">ReviseIQ</p>
        <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;font-weight:600;">${escapeHtml(heading)}</h1>
      </td></tr>
      <tr><td style="padding:0 28px 28px;font-size:15px;line-height:1.6;color:#454c5a;">${bodyHtml}</td></tr>
    </table>
    <p style="max-width:560px;margin:16px auto 0;font-size:12px;color:#7b8394;text-align:center;">
      You're receiving this because someone used this address to sign up to ReviseIQ.
      If that wasn't you, you can safely ignore it.
    </p>
  </body>
</html>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:0 0 20px;">
    <a href="${escapeHtml(href)}" style="display:inline-block;background:#3b4ba8;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;font-size:15px;">${escapeHtml(label)}</a>
  </p>
  <p style="margin:0 0 4px;font-size:13px;color:#7b8394;">Or paste this into your browser:</p>
  <p style="margin:0;font-size:13px;word-break:break-all;"><a href="${escapeHtml(href)}" style="color:#3b4ba8;">${escapeHtml(href)}</a></p>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function verificationEmail(to: string, url: string, hours: number): Mail {
  return {
    to,
    subject: "Confirm your email for ReviseIQ",
    html: layout(
      "Confirm your email",
      `<p style="margin:0 0 20px;">One quick step and your account is ready.</p>${button(url, "Confirm my email")}<p style="margin:20px 0 0;font-size:13px;color:#7b8394;">This link works for ${hours} hours.</p>`,
    ),
    text: [
      "Confirm your email for ReviseIQ",
      "",
      "One quick step and your account is ready:",
      url,
      "",
      `This link works for ${hours} hours.`,
    ].join("\n"),
  };
}

export function passwordResetEmail(to: string, url: string, minutes: number): Mail {
  return {
    to,
    subject: "Reset your ReviseIQ password",
    html: layout(
      "Reset your password",
      `<p style="margin:0 0 20px;">Use the button below to choose a new password.</p>${button(url, "Choose a new password")}<p style="margin:20px 0 0;font-size:13px;color:#7b8394;">This link works for ${minutes} minutes and can only be used once. If you didn't ask for it, nothing has changed on your account.</p>`,
    ),
    text: [
      "Reset your ReviseIQ password",
      "",
      "Use this link to choose a new password:",
      url,
      "",
      `It works for ${minutes} minutes and can only be used once.`,
      "If you didn't ask for it, nothing has changed on your account.",
    ].join("\n"),
  };
}

/**
 * In development the verification link is surfaced in the UI as well as the console,
 * so the flow can be completed without an inbox. Never enabled in production.
 */
export const canRevealLinksInUi = !isProduction && !isEmailEnabled;
