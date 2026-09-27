import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { RagForm } from "@/components/onboarding/rag-form";
import { SettingsHeader } from "@/components/settings/settings-header";
import { requireOnboardedUser } from "@/lib/auth/session";
import { getEnrolments, getTopicRatings } from "@/lib/onboarding/queries";

export const metadata: Metadata = {
  title: "Topic ratings",
  robots: { index: false, follow: false },
};

export default async function SettingsRatingsPage() {
  const user = await requireOnboardedUser();
  const [enrolments, ratings] = await Promise.all([
    getEnrolments(user.id),
    getTopicRatings(user.id),
  ]);

  if (enrolments.length === 0) redirect("/settings/subjects");

  return (
    <div className="mx-auto max-w-3xl">
      <SettingsHeader
        title="Topic ratings"
        blurb="Move something to green once you can answer exam questions on it without looking."
      />

      <RagForm
        subjects={enrolments.map((enrolment) => ({
          id: enrolment.subject.id,
          name: enrolment.subject.name,
          accent: enrolment.subject.accent,
          topics: enrolment.subject.topics.map((topic) => ({
            id: topic.id,
            code: topic.code,
            title: topic.title,
            paper: topic.paper,
            initial: ratings.get(topic.id) ?? null,
          })),
        }))}
        returnTo="/settings"
        submitLabel="Save ratings"
        sticky={false}
      />
    </div>
  );
}
