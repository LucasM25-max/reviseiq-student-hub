import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AvailabilityForm } from "@/components/onboarding/availability-form";
import { Stepper } from "@/components/onboarding/stepper";
import { requireOnboardingUser } from "@/lib/auth/session";
import { getAvailability } from "@/lib/onboarding/queries";

export const metadata: Metadata = {
  title: "When can you revise?",
  robots: { index: false, follow: false },
};

export default async function AvailabilityStepPage() {
  const user = await requireOnboardingUser();
  if (user.needsDateOfBirth) redirect("/onboarding/date-of-birth");

  const slots = await getAvailability(user.id);
  const existing = Object.fromEntries(slots.map((slot) => [slot.weekday, slot.minutes]));

  return (
    <>
      <Stepper current="AVAILABILITY" furthest={user.onboardingStep} />

      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          When can you actually revise?
        </h1>
        <p className="mt-2 text-muted-foreground">
          Be realistic rather than ambitious. A plan you can finish beats a plan that makes you
          feel behind by Tuesday.
        </p>
      </header>

      <AvailabilityForm
        initialMinutes={existing}
        dailyGoal={user.profile?.dailyGoalMinutes ?? 30}
        holidayGoal={user.profile?.holidayGoalMinutes ?? 60}
        reminderChannel={user.profile?.reminderChannel ?? "NONE"}
        reminderTime={user.profile?.reminderTimes?.[0] ?? "18:30"}
      />
    </>
  );
}
