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

export const authConfig = {
  // The preview and production deployments sit behind proxies that rewrite Host.
  trustHost: true,

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
