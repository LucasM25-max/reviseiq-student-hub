import NextAuth from "next-auth";
import { NextResponse, type NextRequest } from "next/server";

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

/**
 * Builds a redirect target on the origin the browser actually used.
 *
 * `request.nextUrl.origin` is the origin the server is bound to, which behind any
 * reverse proxy — preview sandboxes, tunnels, a load balancer — is not the origin the
 * browser is talking to. Redirecting there sends the student to `localhost` on their
 * own machine. `x-forwarded-host` is the proxy's statement of the public host, so
 * prefer it, then the Host header, and only then fall back.
 */
function publicUrl(request: NextRequest, path: string): URL {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost ?? request.headers.get("host");
  if (!host) return new URL(path, request.nextUrl.origin);

  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ??
    request.nextUrl.protocol.replace(":", "");

  return new URL(path, `${proto}://${host}`);
}

const proxy = auth((request) => {
  const { pathname, search } = request.nextUrl;
  const signedIn = Boolean(request.auth?.user);

  const isGuestOnly = GUEST_ONLY.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const isProtected = PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (isProtected && !signedIn) {
    const url = publicUrl(request, "/login");
    // Preserve where they were heading so the deep links in Today survive a login.
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  if (isGuestOnly && signedIn) {
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
