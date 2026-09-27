import type { Metadata } from "next";
import Link from "next/link";

import { AuthDivider, GoogleButton } from "@/components/auth/google-button";
import { SignupForm } from "@/components/auth/signup-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Create an account",
  description:
    "Create a free ReviseIQ account and get a GCSE science revision plan built around what you actually need to work on.",
};

export default function SignupPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>
          Free. Takes about a minute, and you can change everything later.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <GoogleButton label="Continue with Google" />
        <AuthDivider />
        <SignupForm />

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="rounded font-medium text-primary hover:underline">
            Log in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
