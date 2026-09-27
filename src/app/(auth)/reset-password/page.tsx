import type { Metadata } from "next";
import Link from "next/link";

import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { peekPasswordResetToken } from "@/lib/auth/tokens";

export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false, follow: false },
};

const REASONS: Record<string, string> = {
  expired: "That link has expired — they only last an hour.",
  used: "That link has already been used.",
  invalid: "That link isn't valid.",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = Array.isArray(params.token) ? params.token[0] : params.token;

  // Validated but *not* consumed: email scanners follow links, and burning the token on
  // a GET would lock out the student who asked for it.
  const result = token
    ? await peekPasswordResetToken(token)
    : ({ ok: false, reason: "invalid" } as const);

  if (!result.ok) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>This link won&apos;t work</CardTitle>
          <CardDescription>Nothing has changed on your account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Alert variant="warning">{REASONS[result.reason]}</Alert>
          <Link href="/forgot-password" className={buttonVariants({ full: true, size: "lg" })}>
            Send a new link
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Choose a new password</CardTitle>
        <CardDescription>
          You&apos;ll be signed out everywhere else once you save it.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResetPasswordForm token={token as string} />
      </CardContent>
    </Card>
  );
}
