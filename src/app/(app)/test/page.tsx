import type { Metadata } from "next";
import Link from "next/link";

import { StartPracticeForm } from "@/components/test/practice-forms";
import { requireOnboardedUser } from "@/lib/auth/session";
import { masteryBand } from "@/lib/marking/mastery";
import { practiceTopicsFor, PRACTICE_SIZE } from "@/lib/test/queries";
import { prisma } from "@/lib/db/prisma";

export const metadata: Metadata = {
  title: "Test",
  robots: { index: false, follow: false },
};

const BAND_LABEL = { RED: "Needs work", AMBER: "Getting there", GREEN: "Solid" } as const;

export default async function TestPage() {
  const user = await requireOnboardedUser();

  const [topics, runs] = await Promise.all([
    practiceTopicsFor(user.id),
    prisma.questionSet.findMany({
      where: { userId: user.id, reason: "practice" },
      select: { id: true, createdAt: true, completedAt: true, questionIds: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const unfinished = runs.filter((run) => run.completedAt === null);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Test</h1>
        <p className="mt-1 text-muted-foreground">
          Exam questions on every topic. Written answers are marked against the mark scheme,
          point by point.
        </p>
      </header>

      {unfinished.length > 0 ? (
        <section aria-labelledby="unfinished">
          <h2 id="unfinished" className="mb-3 text-lg font-semibold">
            Pick up where you left off
          </h2>
          <ul className="space-y-2">
            {unfinished.map((run) => (
              <li key={run.id}>
                <Link
                  href={`/test/practice/${run.id}`}
                  className="flex items-center justify-between rounded-lg border border-[var(--border)] px-4 py-3 text-sm hover:bg-[var(--muted)]"
                >
                  <span>{run.questionIds.length} questions</span>
                  <span className="text-muted-foreground">Continue</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="topics">
        <h2 id="topics" className="mb-3 text-lg font-semibold">
          Practise a topic
        </h2>

        {topics.length === 0 ? (
          <p className="rounded-lg border border-[var(--border)] p-4 text-sm text-muted-foreground">
            There are no questions for your subjects yet. They arrive with the content for each
            topic.
          </p>
        ) : (
          <ul className="space-y-3">
            {topics.map((topic) => {
              const band = topic.mastery === null ? null : masteryBand(topic.mastery);
              return (
                <li
                  key={topic.subTopicId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] p-4"
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      {topic.code} {topic.title}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {topic.subjectName} · {topic.questionCount} question
                      {topic.questionCount === 1 ? "" : "s"} · {topic.marksAvailable} marks
                      {band ? ` · ${BAND_LABEL[band]}` : " · not started"}
                    </p>
                  </div>
                  <StartPracticeForm
                    subTopicId={topic.subTopicId}
                    label={`Practise ${Math.min(PRACTICE_SIZE, topic.questionCount)} questions`}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
