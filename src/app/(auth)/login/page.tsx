import type { Metadata } from "next";
import Link from "next/link";

import { AuthDivider, GoogleButton } from "@/components/auth/google-button";
import { LoginForm } from "@/components/auth/login-form";
import { Alert } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { safeRedirectPath } from "@/lib/url";

export const metadata: Metadata = {
  title: "Log in",
  description: "Log in to ReviseIQ to pick up your revision where you left off.",
};

/** Auth.js appends ?error=… when an OAuth round trip fails. */
const OAUTH_ERRORS: Record<string, string> = {
  OAuthAccountNotLinked:
    "That email is already registered with a password. Log in with your password, then link Google from Settings.",
  OAuthCallbackError: "Google sign-in didn't complete. Try again.",
  AccessDenied: "Google sign-in was cancelled.",
  Configuration: "Google sign-in isn't set up correctly on this deployment.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const first = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const next = safeRedirectPath(first("next"), "/today");
  const error = first("error");
  const justCreated = first("created") === "1";
  const justReset = first("reset") === "1";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Welcome back</CardTitle>
        <CardDescription>Log in to pick up where you left off.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {error ? (
          <Alert variant="error">
            {OAUTH_ERRORS[error] ?? "Something went wrong signing in."}
          </Alert>
        ) : null}

        {justCreated ? (
          <Alert variant="success" title="Account created">
            Log in to get started.
          </Alert>
        ) : null}

        {justReset ? (
          <Alert variant="success" title="Password changed">
            Use your new password to log in.
          </Alert>
        ) : null}

        <GoogleButton next={next} label="Continue with Google" />
        <AuthDivider />
        <LoginForm next={next} />

        <p className="text-center text-sm text-muted-foreground">
          New here?{" "}
          <Link href="/signup" className="rounded font-medium text-primary hover:underline">
            Create an account
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
