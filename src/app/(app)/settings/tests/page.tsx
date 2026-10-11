import type { Metadata } from "next";
import Link from "next/link";

import { SchoolTestForm } from "@/components/settings/calendar-forms";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireOnboardedUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { deleteSchoolTestFormAction } from "@/lib/today/calendar-actions";

export const metadata: Metadata = {
  title: "School tests",
  robots: { index: false, follow: false },
};

const KIND_LABEL: Record<string, string> = {
  CLASS_TEST: "Class test",
  END_OF_TOPIC: "End of topic",
  SCHOOL_MOCK: "School mock",
};

const asDate = (date: Date) => date.toISOString().slice(0, 10);

/**
 * School tests (D25).
 *
 * A GCSE in June is abstract; a Biology test on Friday is not. This is where a
 * student tells us about the deadlines they actually have, and the plan reflects it
 * immediately rather than overnight.
 */
export default async function SchoolTestsPage() {
  const user = await requireOnboardedUser();

  const [enrolments, tests] = await Promise.all([
    prisma.subjectEnrolment.findMany({
      where: { userId: user.id, active: true },
      select: {
        subjectId: true,
        subject: {
          select: {
            name: true,
            topics: {
              select: { subTopics: { select: { id: true, code: true, title: true } } },
              orderBy: { order: "asc" },
            },
          },
        },
      },
    }),
    prisma.schoolTest.findMany({
      where: { userId: user.id },
      orderBy: { date: "asc" },
      select: {
        id: true,
        date: true,
        kind: true,
        label: true,
        subTopicIds: true,
        subject: { select: { name: true } },
      },
    }),
  ]);

  const subTopics = enrolments.flatMap((enrolment) =>
    enrolment.subject.topics.flatMap((topic) =>
      topic.subTopics.map((subTopic) => ({
        ...subTopic,
        subjectId: enrolment.subjectId,
        subjectName: enrolment.subject.name,
      })),
    ),
  );

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">School tests</h1>
          <p className="mt-1 text-muted-foreground">
            A test on Friday matters more than an exam in June. Tell us about it and Today will
            work towards it.
          </p>
        </div>
        <Link href="/settings" className="rounded text-sm underline hover:no-underline">
          Back to settings
        </Link>
      </header>

      {tests.length > 0 ? (
        <section aria-labelledby="upcoming">
          <h2 id="upcoming" className="mb-3 text-lg font-semibold">
            Coming up
          </h2>
          <ul className="space-y-2">
            {tests.map((test) => {
              const covered = subTopics.filter((subTopic) =>
                test.subTopicIds.includes(subTopic.id),
              );
              const past = test.date.getTime() < today.getTime();

              return (
                <li
                  key={test.id}
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] p-4 ${
                    past ? "opacity-60" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      {test.subject.name} · {KIND_LABEL[test.kind] ?? test.kind}
                      {test.label ? ` · ${test.label}` : ""}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {test.date.toLocaleDateString("en-GB", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        timeZone: "UTC",
                      })}
                      {covered.length > 0
                        ? ` · ${covered.map((subTopic) => subTopic.code).join(", ")}`
                        : ""}
                    </p>
                  </div>
                  <form action={deleteSchoolTestFormAction}>
                    <input type="hidden" name="testId" value={test.id} />
                    <SubmitButton size="sm" variant="ghost" pendingLabel="Removing…">
                      Remove
                    </SubmitButton>
                  </form>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section
        aria-labelledby="add"
        className="rounded-lg border border-[var(--border)] p-4 sm:p-5"
      >
        <h2 id="add" className="mb-3 text-lg font-semibold">
          Add a test
        </h2>

        {subTopics.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Pick your subjects first and the topics will appear here.
          </p>
        ) : (
          <SchoolTestForm label="Add test">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor="test-subject" className="block text-sm font-medium">
                  Subject
                </label>
                <select
                  id="test-subject"
                  name="subjectId"
                  className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
                >
                  {enrolments.map((enrolment) => (
                    <option key={enrolment.subjectId} value={enrolment.subjectId}>
                      {enrolment.subject.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="test-date" className="block text-sm font-medium">
                  Date
                </label>
                <input
                  id="test-date"
                  name="date"
                  type="date"
                  required
                  min={asDate(today)}
                  className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
                />
              </div>

              <div>
                <label htmlFor="test-kind" className="block text-sm font-medium">
                  Kind
                </label>
                <select
                  id="test-kind"
                  name="kind"
                  className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
                >
                  <option value="CLASS_TEST">Class test</option>
                  <option value="END_OF_TOPIC">End of topic</option>
                  <option value="SCHOOL_MOCK">School mock</option>
                </select>
              </div>
            </div>

            <fieldset className="mt-2">
              <legend className="text-sm font-medium">What does it cover?</legend>
              <p className="mb-2 text-sm text-muted-foreground">
                We&rsquo;ll unlock the lessons for anything you haven&rsquo;t learnt yet.
              </p>
              <div className="grid gap-1 sm:grid-cols-2">
                {subTopics.map((subTopic) => (
                  <label key={subTopic.id} className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="subTopicId"
                      value={subTopic.id}
                      className="mt-1"
                    />
                    <span>
                      {subTopic.code} {subTopic.title}
                      <span className="text-muted-foreground"> · {subTopic.subjectName}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          </SchoolTestForm>
        )}
      </section>
    </div>
  );
}
