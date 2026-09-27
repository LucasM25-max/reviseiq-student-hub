import "server-only";

import { z } from "zod";

/**
 * Environment validation.
 *
 * Parsed once, at first import, so a misconfigured deployment fails immediately with a
 * readable message instead of surfacing as `undefined` somewhere deep in a request.
 *
 * Optional integrations (Google OAuth, Resend) are modelled as genuinely optional: the
 * app degrades gracefully rather than refusing to boot. `isGoogleEnabled` and
 * `isEmailEnabled` are the single source of truth for whether those paths are live.
 */

/** Treats "" the same as unset — Vercel and .env files both produce empty strings. */
const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value === "" ? undefined : value));

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  AUTH_SECRET: z
    .string()
    .min(
      32,
      "AUTH_SECRET must be at least 32 characters. Generate one with `npx auth secret`.",
    ),
  AUTH_URL: z.url().default("http://localhost:3000"),
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),

  AUTH_GOOGLE_ID: optionalString,
  AUTH_GOOGLE_SECRET: optionalString,

  RESEND_API_KEY: optionalString,
  EMAIL_FROM: z.string().trim().default("ReviseIQ <noreply@reviseiq.app>"),
});

function loadEnv() {
  // During `next build` the app is compiled without a real environment in some CI setups.
  // Validation still runs, but we give a precise error rather than a stack trace.
  const parsed = schema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  • ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Invalid environment variables:\n${issues}\n\nCheck your .env file against .env.example.`,
    );
  }

  const value = parsed.data;

  // Google OAuth needs both halves or neither; one alone is always a misconfiguration.
  if (Boolean(value.AUTH_GOOGLE_ID) !== Boolean(value.AUTH_GOOGLE_SECRET)) {
    throw new Error(
      "Invalid environment variables:\n  • AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET must be set together.",
    );
  }

  return value;
}

export const env = loadEnv();

/** Google sign-in is only offered when credentials are configured. */
export const isGoogleEnabled = Boolean(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET);

/** With no Resend key, mail is written to the console and ./.mail instead of being sent. */
export const isEmailEnabled = Boolean(env.RESEND_API_KEY);

export const isProduction = env.NODE_ENV === "production";
export const isDevelopment = env.NODE_ENV === "development";
