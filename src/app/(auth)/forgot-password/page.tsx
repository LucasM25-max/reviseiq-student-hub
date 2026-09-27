import type { Metadata } from "next";
import Link from "next/link";

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Forgotten password",
  description: "Send yourself a link to choose a new ReviseIQ password.",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Forgotten your password?</CardTitle>
        <CardDescription>
          Enter your email and we&apos;ll send you a link to choose a new one.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <ForgotPasswordForm />

        <p className="text-center text-sm text-muted-foreground">
          Remembered it?{" "}
          <Link href="/login" className="rounded font-medium text-primary hover:underline">
            Back to log in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
