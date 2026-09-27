import type { Metadata } from "next";

import { ComingSoon } from "@/components/app/coming-soon";
import { RagBadge } from "@/components/rag/rag-selector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOnboardedUser } from "@/lib/auth/session";
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
        title="Lessons are being written"
        summary="Your syllabus is already here — the teaching that goes under each topic is what comes next."
        bullets={[
          "Stepped lesson blocks with inline checks, so you can't drift through a page",
          "Hand-built diagrams rather than screenshots, and proper maths typesetting",
          "An AI tutor you can ask when a step doesn't land",
          "Content written from your source material and reviewed by a human before it ships",
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
                          return (
                            <li
                              key={topic.id}
                              className="flex items-center justify-between gap-3 px-3 py-2.5"
                            >
                              <p className="min-w-0 truncate text-sm text-foreground">
                                <span className="mr-2 font-mono text-xs text-muted-foreground">
                                  {topic.code}
                                </span>
                                {topic.title}
                              </p>
                              {rating ? <RagBadge value={rating} /> : null}
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
