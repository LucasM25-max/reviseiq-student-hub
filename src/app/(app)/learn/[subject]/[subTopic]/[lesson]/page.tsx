import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LessonBlocks } from "@/components/content/lesson-blocks";
import { requireOnboardedUser } from "@/lib/auth/session";
import {
  codeToSlug,
  getLesson,
  getLessonsForSubTopic,
  getSubTopicBySlug,
} from "@/lib/content/queries";

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

export default async function LessonPage({ params }: { params: Params }) {
  await requireOnboardedUser();

  const { subject, subTopic: subTopicSlug, lesson: lessonSlug } = await params;
  const subTopic = await getSubTopicBySlug(subject, subTopicSlug);
  if (!subTopic) notFound();

  const lesson = await getLesson(subTopic.id, lessonSlug);
  if (!lesson) notFound();

  const siblings = await getLessonsForSubTopic(subTopic.id);
  const index = siblings.findIndex((candidate) => candidate.id === lesson.id);
  const previous = index > 0 ? siblings[index - 1] : undefined;
  const next = index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : undefined;
  const base = `/learn/${subject}/${codeToSlug(subTopic.code)}`;

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href="/learn" className="hover:text-foreground">
          Learn
        </Link>
        <span aria-hidden="true"> / </span>
        <span>
          {subTopic.code} {subTopic.title}
        </span>
      </nav>

      <header>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Lesson {index + 1} of {siblings.length} · about {lesson.estMinutes} minutes
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          {lesson.title}
        </h1>
        <p className="mt-2 text-muted-foreground">{lesson.summary}</p>
      </header>

      <LessonBlocks blocks={lesson.blocks} />

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
