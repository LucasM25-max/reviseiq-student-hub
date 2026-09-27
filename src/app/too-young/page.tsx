import type { Metadata } from "next";
import Link from "next/link";

import { Wordmark } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MINIMUM_AGE } from "@/lib/auth/age";

export const metadata: Metadata = {
  title: "Not quite yet",
  robots: { index: false, follow: false },
};

export default function TooYoungPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-muted/40">
      <header className="px-5 py-4 sm:px-8">
        <Link href="/" className="rounded-md" aria-label="ReviseIQ home">
          <Wordmark />
        </Link>
      </header>

      <main className="flex flex-1 items-start justify-center px-5 pt-4 pb-16 sm:items-center sm:pt-0">
        <Card className="w-full max-w-[26rem]">
          <CardHeader>
            <CardTitle>Not quite yet</CardTitle>
            <CardDescription>
              ReviseIQ is for students aged {MINIMUM_AGE} and over.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-sm text-muted-foreground">
              We haven&apos;t kept any of the details you entered — the account has been
              removed. Come back when you start your GCSEs and everything will be here waiting.
            </p>
            <Link href="/" className={buttonVariants({ variant: "outline", full: true })}>
              Back to the homepage
            </Link>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
