import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DateOfBirthForm } from "@/components/onboarding/date-of-birth-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireOnboardingUser, routeForStep } from "@/lib/auth/session";
import { MINIMUM_AGE } from "@/lib/auth/age";

export const metadata: Metadata = {
  title: "One more thing",
  robots: { index: false, follow: false },
};

export default async function DateOfBirthPage() {
  const user = await requireOnboardingUser();

  // Only Google sign-ups land here; everyone else gave a date of birth at sign-up.
  if (!user.needsDateOfBirth) redirect(routeForStep(user.onboardingStep));

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>One more thing</CardTitle>
          <CardDescription>
            Google didn&apos;t tell us your date of birth, and we need it before you carry on.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-muted-foreground">
            ReviseIQ is for students aged {MINIMUM_AGE} and over. We use this once, for that
            check — it isn&apos;t shown on your profile or shared with anyone.
          </p>
          <DateOfBirthForm />
        </CardContent>
      </Card>
    </div>
  );
}
