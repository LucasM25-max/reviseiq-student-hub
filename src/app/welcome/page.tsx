import type { Metadata } from "next";
import { CalendarCheck, Check } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Wordmark } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUser, routeForStep } from "@/lib/auth/session";
import { getAvailability, getEnrolments, getTopicRatings } from "@/lib/onboarding/queries";

export const metadata: Metadata = {
  title: "You're all set",
  robots: { index: false, follow: false },
};

export default async function WelcomePage() {
  const user = await requireUser();

  // Reaching this page without finishing means something went sideways — send them back.
  if (!user.isOnboarded) redirect(routeForStep(user.onboardingStep));

  const [enrolments, ratings, availability] = await Promise.all([
    getEnrolments(user.id),
    getTopicRatings(user.id),
    getAvailability(user.id),
  ]);

  const weeklyHours = availability.reduce((sum, slot) => sum + slot.minutes, 0) / 60;
  const firstName = user.name?.split(" ")[0];

  const lines = [
    `${enrolments.length} subject${enrolments.length === 1 ? "" : "s"}: ${enrolments
      .map((enrolment) => enrolment.subject.name)
      .join(", ")}`,
    `${ratings.size} topics rated`,
    `${weeklyHours.toFixed(1)} hours a week to work with`,
    `A ${user.profile?.dailyGoalMinutes ?? 30}-minute daily goal`,
  ];

  return (
    <div className="flex min-h-dvh flex-col bg-muted/40">
      <header className="px-5 py-4 sm:px-8">
        <Wordmark />
      </header>

      <main className="flex flex-1 items-start justify-center px-5 pt-4 pb-16 sm:items-center sm:pt-0">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle className="text-xl">
              That&apos;s you set up{firstName ? `, ${firstName}` : ""}
            </CardTitle>
            <CardDescription>
              Everything from here is built on what you just told us.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <ul className="space-y-2">
              {lines.map((line) => (
                <li key={line} className="flex items-start gap-2.5 text-sm text-foreground">
                  <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                  {line}
                </li>
              ))}
            </ul>

            <div className="rounded-lg border border-dashed border-border bg-muted/50 p-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">What happens next</p>
              <p className="mt-0.5">
                Today is the page you&apos;ll live on. The lessons, notes and questions it links
                to are still being written — you can see the shape of it now, and it fills in as
                each part ships.
              </p>
            </div>

            <Link href="/today" className={buttonVariants({ size: "lg", full: true })}>
              <CalendarCheck aria-hidden="true" />
              Go to Today
            </Link>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
