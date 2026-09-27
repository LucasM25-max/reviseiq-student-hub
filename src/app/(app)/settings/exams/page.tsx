import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SetupForm } from "@/components/onboarding/setup-form";
import { SettingsHeader } from "@/components/settings/settings-header";
import { requireOnboardedUser } from "@/lib/auth/session";
import { estimatedExamDates, examSeriesOptions } from "@/lib/curriculum/exam-dates";
import { getEnrolments } from "@/lib/onboarding/queries";

export const metadata: Metadata = {
  title: "Tier and exam dates",
  robots: { index: false, follow: false },
};

export default async function SettingsExamsPage() {
  const user = await requireOnboardedUser();
  const enrolments = await getEnrolments(user.id);
  if (enrolments.length === 0) redirect("/settings/subjects");

  const years = examSeriesOptions();
  const existingYear = enrolments
    .flatMap((enrolment) => enrolment.examDates)
    .map((examDate) => examDate.date.getUTCFullYear())
    .find((year) => years.includes(year));

  return (
    <div className="mx-auto max-w-3xl">
      <SettingsHeader
        title="Tier and exam dates"
        blurb="Today counts down from these, so it's worth keeping them right."
      />

      <SetupForm
        yearGroup={user.profile?.yearGroup ?? "YEAR_11"}
        years={years}
        defaultYear={existingYear ?? years[0]}
        subjects={enrolments.map((enrolment) => ({
          subjectId: enrolment.subjectId,
          name: enrolment.subject.name,
          accent: enrolment.subject.accent,
          tier: enrolment.tier,
        }))}
        previewDates={years.map((year) => ({
          year,
          papers: enrolments.flatMap((enrolment) =>
            estimatedExamDates(enrolment.subject.code, year).map((estimate) => ({
              label: `${enrolment.subject.name} Paper ${estimate.paper}`,
              iso: estimate.date.toISOString(),
            })),
          ),
        }))}
        returnTo="/settings"
        submitLabel="Save"
      />
    </div>
  );
}
