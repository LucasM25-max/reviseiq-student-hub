import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LessonBlocks, type RunnerContext } from "@/components/content/lesson-blocks";
import { ProgressRail } from "@/components/learn/progress-rail";
import { StepControls } from "@/components/learn/step-controls";
import { TutorButton } from "@/components/learn/tutor-button";
import { requireOnboardedUser } from "@/lib/auth/session";
import {
  codeToSlug,
  getLesson,
  getLessonsForSubTopic,
  getSubTopicBySlug,
} from "@/lib/content/queries";
import { getLessonState } from "@/lib/learn/progress";
import { stageView } from "@/lib/learn/stages";
import { formatDuration } from "@/lib/learn/time";

type Params = Promise<{ subject: string; subTopic: string; lesson: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { subject, subTopic: subTopicSlug, lesson: lessonSlug } = await params;
  const subTopic = await getSubTopicBySlug(subject, subTopicSlug);
  if (!subTopic) return { title: "Lesson", robots: { index: false, follow: false } };
  const lesson = await getLesson(subTopic.id, lessonSlug);
  return {
    title: lesson?.title ?? "Lesson",
    robots: { index: false, follow: false },
  };
}

/**
 * The lesson runner.
 *
 * A lesson is revealed a **step** at a time, where a step runs up to and including the
 * next `check` block (src/lib/learn/stages.ts explains why steps and not blocks). The
 * student's position is a single integer in `LessonProgress`, so closing the tab and
 * coming back lands them exactly where they were, and the step boundaries are recomputed
 * from the content every time — re-chunking a lesson can never strand anyone.
 *
 * A finished lesson unlocks completely. The gate exists to pace first contact, not to
 * make a student who is revising click through fourteen blocks they have already read.
 */
export default async function LessonPage({ params }: { params: Params }) {
  const user = await requireOnboardedUser();

  const { subject, subTopic: subTopicSlug, lesson: lessonSlug } = await params;
  const subTopic = await getSubTopicBySlug(subject, subTopicSlug);
  if (!subTopic) notFound();

  const lesson = await getLesson(subTopic.id, lessonSlug);
  if (!lesson) notFound();

  const [siblings, progress] = await Promise.all([
    getLessonsForSubTopic(subTopic.id),
    getLessonState(user.id, lesson.id),
  ]);

  const index = siblings.findIndex((candidate) => candidate.id === lesson.id);
  const previous = index > 0 ? siblings[index - 1] : undefined;
  const next = index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : undefined;
  const base = `/learn/${subject}/${codeToSlug(subTopic.code)}`;
  const path = `${base}/${lesson.slug}`;

  const view = stageView(lesson.blocks, progress.lastBlockIndex, progress.completed);

  // The clock for this step starts when the page renders. It travels in a hidden field
  // rather than being read from the database, so the very first step of a lesson — which
  // has no row yet — is counted like every other one. src/lib/learn/time.ts clamps it.
  const stepStartedAt = new Date().toISOString();

  const runner: RunnerContext = {
    lessonId: lesson.id,
    path,
    stepStartedAt,
    checks: Object.fromEntries(
      [...progress.checks.entries()].map(([blockIndex, check]) => [
        blockIndex,
        { chosenKey: check.chosenKey, correct: check.correct },
      ]),
    ),
  };

  // A step that ends in a check stays shut until that check has been answered. The
  // student reads the explanation, then chooses to move on — answering does not itself
  // advance them, or the gate would be a speed bump rather than a check.
  const gateIndex = view.gateBlockIndex;
  const gateAnswered = gateIndex === null || progress.checks.has(gateIndex);
  const canAdvance = progress.completed || gateAnswered;

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href="/learn" className="hover:text-foreground">
          Learn
        </Link>
        <span aria-hidden="true"> / </span>
        <Link href={base} className="hover:text-foreground">
          {subTopic.code} {subTopic.title}
        </Link>
      </nav>

      <header className="space-y-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Lesson {index + 1} of {siblings.length} · about {lesson.estMinutes} minutes
            {progress.totalSeconds > 0
              ? ` · ${formatDuration(progress.totalSeconds)} so far`
              : null}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            {lesson.title}
          </h1>
          <p className="mt-2 text-muted-foreground">{lesson.summary}</p>
        </div>
        <ProgressRail
          total={view.stages.length}
          current={view.stageIndex}
          completed={progress.completed}
        />
      </header>

      {progress.completed ? (
        <p className="rounded-md border border-[var(--success-border)] bg-[var(--success-surface)] px-3 py-2 text-sm text-[var(--success)]">
          You have finished this lesson, so all of it is open. Read any part of it again.
        </p>
      ) : null}

      <div id={`step-${view.stageIndex}`} className="scroll-mt-20">
        <LessonBlocks blocks={view.visibleBlocks} seed={lesson.id} runner={runner} />
      </div>

      <TutorButton />

      {progress.completed ? null : canAdvance ? (
        <StepControls
          lessonId={lesson.id}
          path={path}
          toStage={view.stageIndex + 1}
          stepStartedAt={stepStartedAt}
          finish={view.isFinalStage}
          label={view.isFinalStage ? "Finish and check what stuck" : "Continue"}
          hint={
            view.isFinalStage
              ? "A few real exam questions on what this lesson covered."
              : `${view.stages.length - view.stageIndex - 1} part${
                  view.stages.length - view.stageIndex - 1 === 1 ? "" : "s"
                } to go`
          }
        />
      ) : (
        <p className="border-t border-[var(--border)] pt-5 text-sm text-muted-foreground">
          Answer the check above to carry on.
        </p>
      )}

      {progress.completed ? (
        <div className="border-t border-[var(--border)] pt-5">
          <Link
            href={`${path}/mastery`}
            className="text-sm font-medium text-[var(--primary)] hover:underline"
          >
            Take the mastery check for this lesson →
          </Link>
        </div>
      ) : null}

      <nav
        aria-label="Lesson navigation"
        className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5"
      >
        {previous ? (
          <Link
            href={`${base}/${previous.slug}`}
            className="text-sm text-[var(--primary)] hover:underline"
          >
            ← {previous.title}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link
            href={`${base}/${next.slug}`}
            className="text-sm text-[var(--primary)] hover:underline"
          >
            {next.title} →
          </Link>
        ) : (
          <Link
            href={`/revise/${subject}/notes/${codeToSlug(subTopic.code)}`}
            className="text-sm text-[var(--primary)] hover:underline"
          >
            Revision notes for this topic →
          </Link>
        )}
      </nav>
    </article>
  );
}
