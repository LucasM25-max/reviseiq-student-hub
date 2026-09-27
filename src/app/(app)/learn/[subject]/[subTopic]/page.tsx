import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOnboardedUser } from "@/lib/auth/session";
import { codeToSlug, getLessonsForSubTopic, getSubTopicBySlug } from "@/lib/content/queries";

type Params = Promise<{ subject: string; subTopic: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { subject, subTopic: slug } = await params;
  const subTopic = await getSubTopicBySlug(subject, slug);
  return {
    title: subTopic ? subTopic.title : "Lessons",
    robots: { index: false, follow: false },
  };
}

export default async function SubTopicPage({ params }: { params: Params }) {
  await requireOnboardedUser();

  const { subject, subTopic: slug } = await params;
  const subTopic = await getSubTopicBySlug(subject, slug);
  if (!subTopic) notFound();

  const lessons = await getLessonsForSubTopic(subTopic.id);
  if (lessons.length === 0) notFound();

  const base = `/learn/${subject}/${codeToSlug(subTopic.code)}`;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href="/learn" className="hover:text-foreground">
          Learn
        </Link>
        <span aria-hidden="true"> / </span>
        <span>{subTopic.topic.title}</span>
      </nav>

      <header>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {subTopic.topic.subject.name} · {subTopic.code}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          {subTopic.title}
        </h1>
      </header>

      <ol className="space-y-3">
        {lessons.map((lesson, index) => (
          <li key={lesson.id}>
            <Card className="transition-colors hover:border-[var(--primary)]">
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <CardTitle className="text-base">
                    <Link href={`${base}/${lesson.slug}`} className="hover:underline">
                      <span className="mr-2 text-muted-foreground">{index + 1}.</span>
                      {lesson.title}
                    </Link>
                  </CardTitle>
                  <span className="text-xs text-muted-foreground">
                    about {lesson.estMinutes} min
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{lesson.summary}</p>
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>

      <p className="border-t border-border pt-5 text-sm text-muted-foreground">
        Already know this?{" "}
        <Link
          href={`/revise/${subject}/notes/${codeToSlug(subTopic.code)}`}
          className="text-[var(--primary)] hover:underline"
        >
          Go straight to the revision notes
        </Link>
        .
      </p>
    </div>
  );
}
