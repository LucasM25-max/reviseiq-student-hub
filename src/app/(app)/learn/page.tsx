import type { Metadata } from "next";
import Link from "next/link";

import { ComingSoon } from "@/components/app/coming-soon";
import { RagBadge } from "@/components/rag/rag-selector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOnboardedUser } from "@/lib/auth/session";
import { codeToSlug, getSubTopicsWithContent, subjectSlugFromId } from "@/lib/content/queries";
import { getEnrolments, getTopicRatings } from "@/lib/onboarding/queries";
import { subjectClasses } from "@/lib/rag";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Learn",
  robots: { index: false, follow: false },
};

export default async function LearnPage() {
  const user = await requireOnboardedUser();
  const [enrolments, ratings] = await Promise.all([
    getEnrolments(user.id),
    getTopicRatings(user.id),
  ]);

  // Sub-topics that have seeded lessons, keyed by their parent topic, so the syllabus
  // list below can link the rows that are actually written instead of every row.
  const withContent = await Promise.all(
    enrolments.map((enrolment) => getSubTopicsWithContent(enrolment.subject.id)),
  );
  const contentByTopic = new Map<string, Awaited<ReturnType<typeof getSubTopicsWithContent>>>();
  for (const subTopics of withContent) {
    for (const subTopic of subTopics) {
      const list = contentByTopic.get(subTopic.topicId) ?? [];
      list.push(subTopic);
      contentByTopic.set(subTopic.topicId, list);
    }
  }
  const availableLessons = withContent.reduce(
    (total, subTopics) =>
      total + subTopics.reduce((sum, subTopic) => sum + subTopic._count.lessons, 0),
    0,
  );

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Learn</h1>
        <p className="mt-1 text-muted-foreground">
          Interactive lessons covering the whole specification, taught properly rather than
          summarised.
        </p>
      </header>

      <ComingSoon
        phase="Phase 4"
        title={
          availableLessons > 0
            ? `${availableLessons} lessons are ready — the rest are being written`
            : "Lessons are being written"
        }
        summary="Your syllabus is already here. Topics with lessons written are linked below; the rest follow as each one is authored and reviewed."
        bullets={[
          "Stepped lesson blocks with inline checks, so you can't drift through a page",
          "Hand-built diagrams rather than screenshots, and proper maths typesetting",
          "Interactive widgets and the required practical simulations",
          "An AI tutor you can ask when a step doesn't land",
        ]}
      />

      <section aria-labelledby="your-syllabus" className="space-y-4">
        <h2 id="your-syllabus" className="text-lg font-semibold tracking-tight">
          Your syllabus
        </h2>

        {enrolments.map((enrolment) => {
          const accent = subjectClasses(enrolment.subject.accent);
          const papers = [
            ...new Set(enrolment.subject.topics.map((topic) => topic.paper)),
          ].sort();

          return (
            <Card key={enrolment.id}>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <CardTitle className={cn("text-base", accent.text)}>
                    {enrolment.subject.name}
                  </CardTitle>
                  <span className="text-xs text-muted-foreground">
                    {enrolment.subject.examBoard} {enrolment.subject.qualCode} ·{" "}
                    {enrolment.tier === "UNSURE"
                      ? "tier not set"
                      : enrolment.tier.toLowerCase()}
                  </span>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {papers.map((paper) => (
                  <div key={paper}>
                    <p className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      Paper {paper}
                    </p>
                    <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                      {enrolment.subject.topics
                        .filter((topic) => topic.paper === paper)
                        .map((topic) => {
                          const rating = ratings.get(topic.id);
                          const lessons = contentByTopic.get(topic.id) ?? [];
                          return (
                            <li key={topic.id} className="px-3 py-2.5">
                              <div className="flex items-center justify-between gap-3">
                                <p className="min-w-0 truncate text-sm text-foreground">
                                  <span className="mr-2 font-mono text-xs text-muted-foreground">
                                    {topic.code}
                                  </span>
                                  {topic.title}
                                </p>
                                {rating ? <RagBadge value={rating} /> : null}
                              </div>
                              {lessons.length > 0 ? (
                                <ul className="mt-1.5 space-y-1">
                                  {lessons.map((subTopic) => (
                                    <li key={subTopic.id} className="text-sm">
                                      <Link
                                        href={`/learn/${subjectSlugFromId(enrolment.subject.id)}/${codeToSlug(subTopic.code)}`}
                                        className="text-[var(--primary)] hover:underline"
                                      >
                                        {subTopic.code} {subTopic.title}
                                      </Link>
                                      <span className="ml-2 text-xs text-muted-foreground">
                                        {subTopic._count.lessons} lessons ·{" "}
                                        {subTopic._count.questions} questions
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                            </li>
                          );
                        })}
                    </ul>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </section>
    </div>
  );
}
