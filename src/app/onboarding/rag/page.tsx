import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { RagForm } from "@/components/onboarding/rag-form";
import { Stepper } from "@/components/onboarding/stepper";
import { requireOnboardingUser } from "@/lib/auth/session";
import { getEnrolments, getTopicRatings } from "@/lib/onboarding/queries";

export const metadata: Metadata = {
  title: "Rate your topics",
  robots: { index: false, follow: false },
};

export default async function RagStepPage() {
  const user = await requireOnboardingUser();
  if (user.needsDateOfBirth) redirect("/onboarding/date-of-birth");

  const [enrolments, ratings] = await Promise.all([
    getEnrolments(user.id),
    getTopicRatings(user.id),
  ]);

  if (enrolments.length === 0) redirect("/onboarding/subjects");

  return (
    <>
      <Stepper current="RAG" furthest={user.onboardingStep} />

      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Where are you up to?
        </h1>
        <p className="mt-2 text-muted-foreground">
          Rate each topic honestly — nobody sees this but you, and everything ReviseIQ plans
          depends on it. If your class hasn&apos;t covered something yet, that&apos;s &ldquo;not
          learnt&rdquo;, not red.
        </p>
      </header>

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
      />
    </>
  );
}
