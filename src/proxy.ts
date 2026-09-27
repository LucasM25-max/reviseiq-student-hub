import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "@/lib/auth/auth.config";

/**
 * Coarse route protection.
 *
 * Next 16 renamed the `middleware` convention to `proxy`; the behaviour is unchanged.
 * It runs on the edge runtime, so it can only read the session cookie — it cannot reach
 * the database. It answers exactly one question: "is this person signed in?".
 *
 * Everything finer (email verified, onboarding finished, does this record belong to
 * you) is enforced in server components and server actions, where Prisma is available.
 * See src/lib/auth/session.ts.
 */

const { auth } = NextAuth(authConfig);

/**
 * Routes that only make sense when signed out. `/reset-password` is deliberately absent:
 * a reset link has to work even if the browser still holds a stale session.
 */
const GUEST_ONLY = ["/login", "/signup", "/forgot-password"];

/** Everything under these prefixes requires a session. */
const PROTECTED = [
  "/today",
  "/learn",
  "/revise",
  "/test",
  "/onboarding",
  "/settings",
  "/welcome",
];

const proxy = auth((request) => {
  const { pathname, search } = request.nextUrl;
  const signedIn = Boolean(request.auth?.user);

  const isGuestOnly = GUEST_ONLY.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const isProtected = PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (isProtected && !signedIn) {
    const url = new URL("/login", request.nextUrl.origin);
    // Preserve where they were heading so the deep links in Today survive a login.
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  if (isGuestOnly && signedIn) {
    return NextResponse.redirect(new URL("/today", request.nextUrl.origin));
  }

  return NextResponse.next();
});

export default proxy;

export const config = {
  matcher: [
    /*
     * Everything except Next internals, the auth API, and static files.
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
