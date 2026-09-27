import type { Metadata } from "next";
import Link from "next/link";

import { ResendVerification } from "@/components/auth/resend-verification";
import { Wordmark } from "@/components/brand/logo";
import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { getCurrentUser } from "@/lib/auth/session";
import { consumeEmailVerificationToken } from "@/lib/auth/tokens";

export const metadata: Metadata = {
  title: "Confirm your email",
  robots: { index: false, follow: false },
};

const FAILURE_COPY: Record<string, string> = {
  expired: "That confirmation link has expired.",
  used: "That confirmation link has already been used.",
  invalid: "That confirmation link isn't valid.",
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = Array.isArray(params.token) ? params.token[0] : params.token;

  const user = await getCurrentUser();

  // Consuming on GET is deliberate here: if a corporate mail scanner follows the link
  // first, the account still ends up verified, which is the outcome we want. (The
  // password-reset link, where that would be harmful, is handled the other way.)
  const result = token ? await consumeEmailVerificationToken(token) : null;

  const verified = result?.ok === true || (result === null && user?.isEmailVerified === true);

  return (
    <div className="flex min-h-dvh flex-col bg-muted/40">
      <header className="flex items-center justify-between px-5 py-4 sm:px-8">
        <Link href="/" className="rounded-md" aria-label="ReviseIQ home">
          <Wordmark />
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-start justify-center px-5 pt-4 pb-16 sm:items-center sm:pt-0">
        <div className="w-full max-w-[26rem]">
          {verified ? (
            <Card>
              <CardHeader>
                <CardTitle>Email confirmed</CardTitle>
                <CardDescription>That&apos;s everything sorted.</CardDescription>
              </CardHeader>
              <CardContent>
                <Link
                  href={user ? "/today" : "/login"}
                  className={buttonVariants({ full: true, size: "lg" })}
                >
                  {user ? "Go to Today" : "Log in"}
                </Link>
              </CardContent>
            </Card>
          ) : result && !result.ok ? (
            <Card>
              <CardHeader>
                <CardTitle>That link didn&apos;t work</CardTitle>
                <CardDescription>Links are single-use and last 24 hours.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <Alert variant="warning">{FAILURE_COPY[result.reason]}</Alert>
                {user ? (
                  <ResendVerification label="Send a new link" />
                ) : (
                  <Link href="/login" className={buttonVariants({ full: true, size: "lg" })}>
                    Log in to send a new one
                  </Link>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Check your inbox</CardTitle>
                <CardDescription>
                  {user
                    ? `We've sent a confirmation link to ${user.email}.`
                    : "We've sent you a confirmation link."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <p className="text-sm text-muted-foreground">
                  Click it and you&apos;re done. If it hasn&apos;t arrived in a couple of
                  minutes, have a look in your spam folder.
                </p>
                {user ? <ResendVerification /> : null}
                <Link
                  href={user ? "/today" : "/login"}
                  className={buttonVariants({ variant: "ghost", full: true })}
                >
                  {user ? "Carry on without confirming" : "Back to log in"}
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
