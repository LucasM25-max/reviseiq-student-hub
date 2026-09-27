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

  /**
   * Sending a signed-in student away from /login and /signup is deliberately *not*
   * done here.
   *
   * A decodable cookie is not the same thing as a real account. The token is a
   * stateless JWT, so it stays valid after the account behind it is gone — deleted,
   * soft-deleted, or wiped with a rebuilt database. Bouncing on that alone creates a
   * loop with no exit: /login sees a token and forwards to /today, /today looks the
   * user up, finds nothing and forwards back to /login. The student is locked out of
   * the one page that could fix it.
   *
   * The pages make that call instead, where Prisma can confirm the account exists.
   */
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
