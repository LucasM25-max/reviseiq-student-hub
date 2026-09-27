import Google from "next-auth/providers/google";
import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe Auth.js configuration.
 *
 * This module must not import Prisma, argon2, or anything else with a Node-only
 * dependency: `middleware.ts` imports it, and middleware runs on the edge runtime.
 * The Prisma adapter and the Credentials provider are added in auth.ts, which is only
 * ever imported from Node contexts.
 */

// Read directly from process.env rather than through @/lib/env, which is server-only.
const googleId = process.env.AUTH_GOOGLE_ID?.trim();
const googleSecret = process.env.AUTH_GOOGLE_SECRET?.trim();

export const googleConfigured = Boolean(googleId && googleSecret);

/**
 * The Arena live preview serves the app inside an iframe hosted on a different origin,
 * so every request a student makes from it is a cross-site request. Browsers withhold
 * `SameSite=Lax` cookies from cross-site iframes, so the session token never reaches
 * the server: pages that only read the session still render from a cached document,
 * but the moment a form or server action runs it is treated as signed out and bounced
 * straight back to the page it came from. The symptom is being stuck on a step of
 * onboarding no matter how many times you press Continue.
 *
 * `SameSite=None` is the only value that survives an embedded context, and browsers
 * ignore it unless `Secure` is set too — the preview proxy terminates TLS, so the
 * browser does see HTTPS even though the server itself speaks plain HTTP.
 *
 * Deliberately scoped to the sandbox. Production is a first-party, top-level app where
 * `Lax` is the stronger CSRF posture and must remain the default.
 */
const embeddedPreview = process.env.E2B_SANDBOX === "true";

/** `SameSite=None` is meaningless to a browser without `Secure`. */
const crossSiteOptions = { httpOnly: true, sameSite: "none", path: "/", secure: true } as const;

const embeddedPreviewCookies: NextAuthConfig["cookies"] = {
  sessionToken: { name: "authjs.session-token", options: crossSiteOptions },
  callbackUrl: { name: "authjs.callback-url", options: crossSiteOptions },
  csrfToken: { name: "authjs.csrf-token", options: crossSiteOptions },
  // OAuth round-trip cookies, so "Continue with Google" also survives the iframe.
  pkceCodeVerifier: {
    name: "authjs.pkce.code_verifier",
    options: { ...crossSiteOptions, maxAge: 900 },
  },
  state: { name: "authjs.state", options: { ...crossSiteOptions, maxAge: 900 } },
  nonce: { name: "authjs.nonce", options: crossSiteOptions },
};

export const authConfig = {
  // The preview and production deployments sit behind proxies that rewrite Host.
  trustHost: true,

  ...(embeddedPreview ? { cookies: embeddedPreviewCookies } : {}),

  pages: {
    signIn: "/login",
    error: "/login",
  },

  session: {
    // Required: the Credentials provider cannot use database sessions.
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60,
  },

  providers: googleConfigured
    ? [
        Google({
          clientId: googleId,
          clientSecret: googleSecret,
          // Google verifies email ownership, so linking a Google login to an existing
          // account with the same address is safe — and it is what a student expects
          // when they sign up with a password and later click "Continue with Google".
          allowDangerousEmailAccountLinking: true,
        }),
      ]
    : [],

  callbacks: {
    jwt({ token, user }) {
      // `user` is only present on initial sign-in.
      if (user) {
        token.sub = user.id ?? token.sub;
        token.role = "role" in user ? (user.role as string) : "STUDENT";
      }
      return token;
    },

    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = (token.role as "STUDENT" | "ADMIN" | undefined) ?? "STUDENT";
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
