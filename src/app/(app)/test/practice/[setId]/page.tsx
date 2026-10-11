import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Markdown } from "@/components/content/markdown";
import { MarkBreakdown } from "@/components/test/mark-breakdown";
import { AnswerForm } from "@/components/test/practice-forms";
import { requireOnboardedUser } from "@/lib/auth/session";
import { markTaskDoneById, markTaskStarted } from "@/lib/today/actions";
import { practiceRunFor, reviewMaterialFor } from "@/lib/test/queries";

export const metadata: Metadata = {
  title: "Practice",
  robots: { index: false, follow: false },
};

type Option = { key: string; text: string };

/**
 * One practice run.
 *
 * Every question in the snapshot is on the page: answered ones show their mark and
 * mark scheme, the first unanswered one shows its input. That keeps the whole run
 * reviewable in one place and means a page reload never loses a student's position.
 */
export default async function PracticePage({
  params,
  searchParams,
}: {
  params: Promise<{ setId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireOnboardedUser();
  const { setId } = await params;
  const query = await searchParams;

  const run = await practiceRunFor(user.id, setId);
  if (!run) notFound();

  /*
   * The `?task=` round trip (doc 05 §10). Arriving from Today records that the task
   * was started; finishing the set ticks it off, so the student lands back on a plan
   * with the item already done rather than having to tell us twice.
   */
  const taskId = typeof query.task === "string" ? query.task : null;
  if (taskId) {
    await markTaskStarted(user.id, taskId);
    if (run.completedAt) await markTaskDoneById(user.id, taskId);
  }

  // Only ever loaded for questions that already have an attempt.
  const review = await Promise.all(
    run.questions.map(async (question) =>
      question.attempt ? await reviewMaterialFor(question.id) : null,
    ),
  );

  const firstUnanswered = run.questions.findIndex((question) => question.attempt === null);
  const startedAt = new Date().toISOString();

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Practice</h1>
          <p className="mt-1 text-muted-foreground">
            {run.answered} of {run.questions.length} answered · {run.awarded}/{run.available}{" "}
            marks
          </p>
        </div>
        <Link
          href={taskId ? "/today" : "/test"}
          className="rounded text-sm underline hover:no-underline"
        >
          {taskId ? "Back to Today" : "Back to Test"}
        </Link>
      </header>

      <ol className="space-y-8">
        {run.questions.map((question, index) => {
          const isOpen = index === firstUnanswered;
          const options = Array.isArray(question.options)
            ? (question.options as unknown as Option[])
            : [];

          return (
            <li
              key={question.id}
              className="rounded-lg border border-[var(--border)] p-4 sm:p-5"
              aria-current={isOpen ? "step" : undefined}
            >
              <p className="mb-2 text-sm text-muted-foreground">
                Question {index + 1} of {run.questions.length} · {question.marks} mark
                {question.marks === 1 ? "" : "s"} · {question.commandWord}
              </p>

              <div className="mb-4">
                <Markdown>{question.stem}</Markdown>
              </div>

              {question.attempt ? (
                <MarkBreakdown
                  result={
                    question.attempt.result ?? {
                      awardedMarks: question.attempt.awardedMarks,
                      maxMarks: question.attempt.maxMarks,
                      pointsAwarded: [],
                      missing: [],
                      misconceptions: [],
                      feedback: { whatWentWell: "", evenBetterIf: "" },
                      confidence: 0,
                      provisional: true,
                      notes: [],
                      source: "SELF",
                      degraded: null,
                      promptVersion: "none",
                      model: null,
                    }
                  }
                  attemptId={question.attempt.id}
                  disputed={question.attempt.disputed}
                  markScheme={review[index] ?? null}
                />
              ) : isOpen ? (
                <AnswerForm setId={run.id} questionId={question.id} startedAt={startedAt}>
                  {options.length > 0 ? (
                    <fieldset className="space-y-2">
                      <legend className="sr-only">Choose an answer</legend>
                      {options.map((option) => (
                        <label key={option.key} className="flex items-start gap-2 text-sm">
                          <input
                            type="radio"
                            name="answerKey"
                            value={option.key}
                            className="mt-1"
                          />
                          <span>
                            <strong className="mr-1">{option.key}</strong>
                            {option.text}
                          </span>
                        </label>
                      ))}
                    </fieldset>
                  ) : (
                    <>
                      <label
                        htmlFor={`answer-${question.id}`}
                        className="block text-sm font-medium"
                      >
                        Your answer
                      </label>
                      <textarea
                        id={`answer-${question.id}`}
                        name="answerText"
                        rows={question.marks >= 5 ? 10 : 5}
                        maxLength={5000}
                        className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                        placeholder="Write your answer here."
                      />
                    </>
                  )}
                </AnswerForm>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Answer question {firstUnanswered + 1} first.
                </p>
              )}
            </li>
          );
        })}
      </ol>

      {run.completedAt ? (
        <p className="rounded-lg border border-[var(--border)] bg-[var(--muted)] p-4 text-sm">
          You finished this set — {run.awarded} out of {run.available} marks.{" "}
          <Link href={taskId ? "/today" : "/test"} className="underline hover:no-underline">
            {taskId ? "Back to Today — it's ticked off" : "Practise another topic"}
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}
