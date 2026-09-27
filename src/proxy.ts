import NextAuth from "next-auth";
import { NextResponse, type NextRequest } from "next/server";

import { authConfig } from "@/lib/auth/auth.config";
import { publicOrigin } from "@/lib/http/forwarded";

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

/**
 * Builds a redirect target on the origin the browser actually used.
 *
 * Next's middleware resolves the Location header as an absolute URL, so a relative
 * one is not an option here — the origin has to be reconstructed from proxy headers.
 * `publicOrigin` is shared with the server-side URL helpers so the two cannot
 * disagree about the scheme; getting that wrong sends an HTTPS page to an `http://`
 * URL, which the browser blocks as mixed content.
 */
function publicUrl(request: NextRequest, path: string): URL {
  const origin = publicOrigin(
    request.headers.get("x-forwarded-host"),
    request.headers.get("host"),
    request.headers.get("x-forwarded-proto"),
  );

  return new URL(path, origin ?? request.nextUrl.origin);
}

const proxy = auth((request) => {
  const { pathname, search } = request.nextUrl;
  const signedIn = Boolean(request.auth?.user);

  const isGuestOnly = GUEST_ONLY.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const isProtected = PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  /**
   * A server action is a `fetch`, not a navigation, and it expects a React Flight
   * response. Answering one with a redirect to the login *page* gives the client HTML
   * it cannot parse, and the redirect is followed opaquely, so the student sees a
   * dead button rather than a login screen. The actions all re-check the session
   * themselves and reply with a redirect the client understands, so let them answer.
   */
  const isServerAction = request.method === "POST" && request.headers.has("next-action");

  if (isProtected && !signedIn && !isServerAction) {
    const url = publicUrl(request, "/login");
    // Preserve where they were heading so the deep links in Today survive a login.
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  if (isGuestOnly && signedIn && !isServerAction) {
    return NextResponse.redirect(publicUrl(request, "/today"));
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
