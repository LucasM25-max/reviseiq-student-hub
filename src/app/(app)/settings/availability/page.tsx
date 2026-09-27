import type { Metadata } from "next";

import { AvailabilityForm } from "@/components/onboarding/availability-form";
import { SettingsHeader } from "@/components/settings/settings-header";
import { requireOnboardedUser } from "@/lib/auth/session";
import { getAvailability } from "@/lib/onboarding/queries";

export const metadata: Metadata = {
  title: "Your week",
  robots: { index: false, follow: false },
};

export default async function SettingsAvailabilityPage() {
  const user = await requireOnboardedUser();
  const slots = await getAvailability(user.id);

  return (
    <div className="mx-auto max-w-3xl">
      <SettingsHeader
        title="Your week"
        blurb="How much time you have, what counts as a day done, and whether we nudge you."
      />

      <AvailabilityForm
        initialMinutes={Object.fromEntries(slots.map((slot) => [slot.weekday, slot.minutes]))}
        dailyGoal={user.profile?.dailyGoalMinutes ?? 30}
        holidayGoal={user.profile?.holidayGoalMinutes ?? 60}
        reminderChannel={user.profile?.reminderChannel ?? "NONE"}
        reminderTime={user.profile?.reminderTimes?.[0] ?? "18:30"}
        returnTo="/settings"
        submitLabel="Save"
      />
    </div>
  );
}
