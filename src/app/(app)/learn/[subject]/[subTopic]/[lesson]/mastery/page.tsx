import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MarkSchemeView, SelfMarkInput } from "@/components/learn/mark-scheme-view";
import {
  MasteryAnswerForm,
  MasteryMarkForm,
  MasteryStartForm,
} from "@/components/learn/mastery-forms";
import { QuestionView } from "@/components/learn/question-view";
import { requireOnboardedUser } from "@/lib/auth/session";
import { codeToSlug, getLesson, getSubTopicBySlug } from "@/lib/content/queries";
import { lessonSpecPoints, selectMasteryQuestions } from "@/lib/learn/mastery";
import {
  getLatestCompletedRun,
  getMasteryCandidates,
  getOpenRun,
  getQuestionsByIds,
  getRun,
  type MasteryQuestion,
} from "@/lib/learn/mastery-queries";
import { percentage } from "@/lib/marking/auto";
import type { NumericVerdict } from "@/lib/marking/numeric";
import { cn } from "@/lib/utils";

type Params = Promise<{ subject: string; subTopic: string; lesson: string }>;
type Search = Promise<{ run?: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { subject, subTopic: subTopicSlug, lesson: lessonSlug } = await params;
  const subTopic = await getSubTopicBySlug(subject, subTopicSlug);
  if (!subTopic) return { title: "Mastery check", robots: { index: false, follow: false } };
  const lesson = await getLesson(subTopic.id, lessonSlug);
  return {
    title: lesson ? `Mastery check · ${lesson.title}` : "Mastery check",
    robots: { index: false, follow: false },
  };
}

/** Pulls the numeric verdict back out of the JSON stored on the attempt. */
function numericFrom(markDetail: unknown): NumericVerdict | undefined {
  if (!markDetail || typeof markDetail !== "object") return undefined;
  const detail = markDetail as { kind?: unknown; numeric?: unknown };
  if (detail.kind !== "numeric-verdict") return undefined;
  return (detail.numeric as NumericVerdict) ?? undefined;
}

function objectiveFrom(markDetail: unknown): {
  correctKey?: string;
  chosenKey?: string | null;
} {
  if (!markDetail || typeof markDetail !== "object") return {};
  const detail = markDetail as { kind?: unknown; correctKey?: unknown; chosenKey?: unknown };
  if (detail.kind !== "objective") return {};
  return {
    correctKey: typeof detail.correctKey === "string" ? detail.correctKey : undefined,
    chosenKey: typeof detail.chosenKey === "string" ? detail.chosenKey : null,
  };
}

/**
 * The end-of-lesson mastery check.
 *
 * One route, four states, driven entirely by what is in the database rather than by a
 * wizard step in the URL: no run yet, a run being answered, a run waiting to be marked,
 * a run that is finished. That is what makes the page resumable — a student who closes
 * the tab halfway through comes back to exactly the state they left, and the browser
 * back button cannot desynchronise anything because there is nothing to desynchronise.
 *
 * Marking in this phase is deliberately split. Multiple choice is marked by the machine
 * because it can be; everything else is marked by the student against the real mark
 * scheme, labelled as such. Phase 5 swaps the second half for the AI marker without
 * changing a single column.
 */
export default async function MasteryPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const user = await requireOnboardedUser();

  const { subject, subTopic: subTopicSlug, lesson: lessonSlug } = await params;
  const { run: runId } = await searchParams;

  const subTopic = await getSubTopicBySlug(subject, subTopicSlug);
  if (!subTopic) notFound();

  const lesson = await getLesson(subTopic.id, lessonSlug);
  if (!lesson) notFound();

  const base = `/learn/${subject}/${codeToSlug(subTopic.code)}`;
  const lessonPath = `${base}/${lesson.slug}`;
  const path = `${lessonPath}/mastery`;

  const run = runId ? await getRun(user.id, runId) : await getOpenRun(user.id, lesson.id);

  const header = (
    <header className="space-y-2">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href="/learn" className="hover:text-foreground">
          Learn
        </Link>
        <span aria-hidden="true"> / </span>
        <Link href={lessonPath} className="hover:text-foreground">
          {lesson.title}
        </Link>
      </nav>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Mastery check</h1>
    </header>
  );

  // --- State 1: nothing started -------------------------------------------
  if (!run) {
    const specPoints = lessonSpecPoints(lesson.blocks);
    const candidates = await getMasteryCandidates(subTopic.id, specPoints);
    const selection = selectMasteryQuestions(specPoints, candidates);
    const previous = await getLatestCompletedRun(user.id, lesson.id);

    return (
      <div className="mx-auto max-w-3xl space-y-6">
        {header}

        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-4">
          <p>
            {selection.questionIds.length} question
            {selection.questionIds.length === 1 ? "" : "s"} from the real exam bank, worth{" "}
            {selection.totalMarks} mark{selection.totalMarks === 1 ? "" : "s"} in total — the
            same questions the Test section serves, not practice versions.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Multiple choice is marked for you. Written answers you mark yourself against the
            real mark scheme, which you will see straight after you submit. The AI marker
            arrives in a later release.
          </p>
          {selection.belowTarget ? (
            <p className="mt-2 text-sm text-[var(--warning)]">
              This lesson&rsquo;s spec points only have {selection.questionIds.length} question
              {selection.questionIds.length === 1 ? "" : "s"} in the bank so far, which is fewer
              than we aim for.
            </p>
          ) : null}
          {selection.uncoveredSpecPoints.length > 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Not every spec point in this lesson has a question yet:{" "}
              {selection.uncoveredSpecPoints.join(", ")}.
            </p>
          ) : null}
        </div>

        {previous ? (
          <p className="text-sm text-muted-foreground">
            Last time you scored{" "}
            <span className="font-medium text-[var(--foreground)]">
              {previous.attempts.reduce((sum, attempt) => sum + attempt.awardedMarks, 0)} /{" "}
              {previous.attempts.reduce((sum, attempt) => sum + attempt.maxMarks, 0)}
            </span>
            .
          </p>
        ) : null}

        {selection.questionIds.length > 0 ? (
          <MasteryStartForm
            lessonId={lesson.id}
            path={path}
            label={previous ? "Take it again" : "Start the mastery check"}
          />
        ) : (
          <p className="rounded-md border border-dashed border-[var(--border)] px-4 py-3 text-sm text-muted-foreground">
            There are no questions for this lesson&rsquo;s spec points yet.
          </p>
        )}

        <p className="border-t border-border pt-5 text-sm">
          <Link href={lessonPath} className="text-[var(--primary)] hover:underline">
            ← Back to the lesson
          </Link>
        </p>
      </div>
    );
  }

  const questions = await getQuestionsByIds(run.questionIds);
  const attemptsByQuestion = new Map(
    run.attempts.map((attempt) => [attempt.questionId, attempt]),
  );

  // --- State 2: answering --------------------------------------------------
  if (!run.answeredAt) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        {header}
        <p className="text-muted-foreground">
          {questions.length} question{questions.length === 1 ? "" : "s"} ·{" "}
          {questions.reduce((sum, question) => sum + question.marks, 0)} marks. Answer all of
          them, then submit.
        </p>

        <MasteryAnswerForm setId={run.id} path={path} startedAt={new Date().toISOString()}>
          <div className="space-y-4">
            {questions.map((question, index) => (
              <QuestionView
                key={question.id}
                question={question}
                number={index + 1}
                total={questions.length}
              />
            ))}
          </div>
        </MasteryAnswerForm>
      </div>
    );
  }

  const awarded = run.attempts.reduce((sum, attempt) => sum + attempt.awardedMarks, 0);
  const totalMarks = questions.reduce((sum, question) => sum + question.marks, 0);

  const renderAnswered = (question: MasteryQuestion, index: number, showMarkInput: boolean) => {
    const attempt = attemptsByQuestion.get(question.id);
    const objective = objectiveFrom(attempt?.markDetail);
    const isAuto = attempt?.markedBy === "AUTO";
    const gotItRight = isAuto && attempt.awardedMarks === attempt.maxMarks;

    return (
      <section
        key={question.id}
        id={`question-${question.id}`}
        className={cn(
          "scroll-mt-20 rounded-lg border px-4 py-4",
          isAuto && gotItRight && "border-[var(--success-border)] bg-[var(--success-surface)]",
          isAuto &&
            !gotItRight &&
            "border-[var(--destructive-border)] bg-[var(--destructive-surface)]",
          !isAuto && "border-[var(--border)] bg-[var(--card)]",
        )}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-xs font-semibold tracking-wide text-[var(--muted-foreground)] uppercase">
            Question {index + 1} · {question.commandWord}
          </p>
          <p className="text-xs font-medium">
            {isAuto
              ? `${attempt.awardedMarks} / ${attempt.maxMarks}`
              : `marked by you · ${question.marks} mark${question.marks === 1 ? "" : "s"}`}
          </p>
        </div>

        <div className="mt-2 text-sm">
          <p className="font-medium">{question.stem}</p>
        </div>

        <div className="mt-3 rounded-md bg-[var(--background)]/70 px-3 py-2 text-sm">
          <p className="text-xs font-medium tracking-wide text-[var(--muted-foreground)] uppercase">
            Your answer
          </p>
          <p className="mt-1 whitespace-pre-wrap">
            {attempt?.answerKey
              ? `${attempt.answerKey} — ${
                  question.options?.find((option) => option.key === attempt.answerKey)?.text ??
                  ""
                }`
              : (attempt?.answerText ?? "(blank)")}
          </p>
          {isAuto && objective.correctKey && !gotItRight ? (
            <p className="mt-1 font-medium">The answer is {objective.correctKey}.</p>
          ) : null}
        </div>

        <div className="mt-3">
          <MarkSchemeView question={question} numeric={numericFrom(attempt?.markDetail)} />
        </div>

        {showMarkInput && attempt?.markedBy === "SELF" ? (
          <SelfMarkInput
            questionId={question.id}
            maxMarks={attempt.maxMarks}
            defaultValue={attempt.awardedMarks}
          />
        ) : null}
      </section>
    );
  };

  // --- State 3: answered, waiting to be self-marked ------------------------
  if (!run.completedAt) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        {header}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 px-4 py-3">
          <p className="font-medium">Mark your own answers</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Read each mark point and decide, honestly, whether your answer earned it. Being
            generous with yourself here is the one thing that makes this useless.
          </p>
        </div>

        <MasteryMarkForm setId={run.id} path={path}>
          <div className="space-y-4">
            {questions.map((question, index) => renderAnswered(question, index, true))}
          </div>
        </MasteryMarkForm>
      </div>
    );
  }

  // --- State 4: finished ---------------------------------------------------
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {header}

      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-4">
        <p className="text-3xl font-semibold tracking-tight">
          {awarded} <span className="text-lg text-muted-foreground">/ {totalMarks}</span>
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {percentage(awarded, totalMarks)}% · marked{" "}
          {run.attempts.every((attempt) => attempt.markedBy === "AUTO")
            ? "automatically"
            : "partly by you"}
          .
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Questions you dropped marks on will become flashcards once spaced repetition lands.
          Your answers are saved either way.
        </p>
      </div>

      <div className="space-y-4">
        {questions.map((question, index) => renderAnswered(question, index, false))}
      </div>

      <nav className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5 text-sm">
        <Link href={lessonPath} className="text-[var(--primary)] hover:underline">
          ← Back to the lesson
        </Link>
        <Link href={path} className="text-[var(--primary)] hover:underline">
          Take it again →
        </Link>
      </nav>
    </div>
  );
}
