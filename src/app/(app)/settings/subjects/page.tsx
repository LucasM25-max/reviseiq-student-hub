import type { Metadata } from "next";

import { SubjectsForm } from "@/components/onboarding/subjects-form";
import { SettingsHeader } from "@/components/settings/settings-header";
import { Alert } from "@/components/ui/alert";
import { requireOnboardedUser } from "@/lib/auth/session";
import { getCatalogue, getEnrolments } from "@/lib/onboarding/queries";

export const metadata: Metadata = {
  title: "Subjects",
  robots: { index: false, follow: false },
};

export default async function SettingsSubjectsPage() {
  const user = await requireOnboardedUser();
  const [subjects, enrolments] = await Promise.all([getCatalogue(), getEnrolments(user.id)]);

  return (
    <div className="mx-auto max-w-3xl">
      <SettingsHeader title="Subjects" blurb="Add a science, or drop one you're not taking." />

      <div className="mb-5">
        <Alert variant="info">
          Dropping a subject hides it from Today and the other pages. Nothing is deleted — your
          ratings and history are still there if you pick it back up.
        </Alert>
      </div>

      <SubjectsForm
        subjects={subjects.map((subject) => ({
          id: subject.id,
          name: subject.name,
          accent: subject.accent,
          qualCode: subject.qualCode,
          examBoard: subject.examBoard,
          topicCount: subject.topics.length,
        }))}
        initialSelected={enrolments.map((enrolment) => enrolment.subjectId)}
        returnTo="/settings"
        submitLabel="Save subjects"
      />
    </div>
  );
}
