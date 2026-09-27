import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Markdown } from "@/components/content/markdown";
import { requireOnboardedUser } from "@/lib/auth/session";
import { codeToSlug, getNoteSections, getSubTopicBySlug } from "@/lib/content/queries";

type Params = Promise<{ subject: string; subTopic: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { subject, subTopic: slug } = await params;
  const subTopic = await getSubTopicBySlug(subject, slug);
  return {
    title: subTopic ? `${subTopic.title} — notes` : "Revision notes",
    robots: { index: false, follow: false },
  };
}

export default async function NotesPage({ params }: { params: Params }) {
  await requireOnboardedUser();

  const { subject, subTopic: slug } = await params;
  const subTopic = await getSubTopicBySlug(subject, slug);
  if (!subTopic) notFound();

  const sections = await getNoteSections(subTopic.id);
  if (sections.length === 0) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href="/revise" className="hover:text-foreground">
          Revise
        </Link>
        <span aria-hidden="true"> / </span>
        <span>{subTopic.topic.subject.name}</span>
      </nav>

      <header>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Revision notes · {subTopic.code}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          {subTopic.title}
        </h1>
      </header>

      {/* Today deep-links to the section anchors below, so this index is the same set of
          targets rather than a separate hand-maintained list. */}
      <nav
        aria-label="On this page"
        className="rounded-lg border border-border bg-card px-4 py-3"
      >
        <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          On this page
        </p>
        <ul className="space-y-1 text-sm">
          {sections.map((section) => (
            <li key={section.id}>
              <Link href={`#${section.slug}`} className="text-[var(--primary)] hover:underline">
                {section.title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {sections.map((section) => (
        <section key={section.id} id={section.slug} className="scroll-mt-20">
          <h2 className="mt-8 mb-2 border-b border-border pb-2 text-xl font-semibold tracking-tight">
            {section.title}
          </h2>
          <Markdown>{section.body}</Markdown>
        </section>
      ))}

      <p className="border-t border-border pt-5 text-sm text-muted-foreground">
        Want to work through this properly?{" "}
        <Link
          href={`/learn/${subject}/${codeToSlug(subTopic.code)}`}
          className="text-[var(--primary)] hover:underline"
        >
          The lessons for {subTopic.title}
        </Link>{" "}
        teach it from the beginning.
      </p>
    </div>
  );
}
