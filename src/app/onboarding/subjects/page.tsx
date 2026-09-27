import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Stepper } from "@/components/onboarding/stepper";
import { SubjectsForm } from "@/components/onboarding/subjects-form";
import { requireOnboardingUser } from "@/lib/auth/session";
import { getCatalogue, getEnrolments } from "@/lib/onboarding/queries";

export const metadata: Metadata = {
  title: "Choose your subjects",
  robots: { index: false, follow: false },
};

export default async function SubjectsStepPage() {
  const user = await requireOnboardingUser();
  if (user.needsDateOfBirth) redirect("/onboarding/date-of-birth");

  const [subjects, enrolments] = await Promise.all([getCatalogue(), getEnrolments(user.id)]);
  const selected = enrolments.map((enrolment) => enrolment.subjectId);

  return (
    <>
      <Stepper current="SUBJECTS" furthest={user.onboardingStep} />

      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Which sciences are you taking?
        </h1>
        <p className="mt-2 text-muted-foreground">
          Pick the ones you sit as separate GCSEs. You can change this later in Settings.
        </p>
      </header>

      <SubjectsForm
        subjects={subjects.map((subject) => ({
          id: subject.id,
          name: subject.name,
          accent: subject.accent,
          qualCode: subject.qualCode,
          examBoard: subject.examBoard,
          topicCount: subject.topics.length,
        }))}
        initialSelected={selected}
      />
    </>
  );
}
