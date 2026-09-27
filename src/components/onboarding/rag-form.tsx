"use client";

import { useActionState, useMemo, useState } from "react";

import type { RagValue } from "@/generated/prisma/enums";
import { RagSelector } from "@/components/rag/rag-selector";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { idleFormState } from "@/lib/forms";
import { saveRagAction } from "@/lib/onboarding/actions";
import { RAG_CLASSES, RAG_META, RAG_ORDER, subjectClasses } from "@/lib/rag";
import { cn } from "@/lib/utils";

type TopicRow = {
  id: string;
  code: string;
  title: string;
  paper: number;
  initial: RagValue | null;
};

type SubjectGroup = {
  id: string;
  name: string;
  accent: string;
  topics: TopicRow[];
};

export function RagForm({
  subjects,
  returnTo,
  submitLabel = "Continue",
  sticky = true,
}: {
  subjects: SubjectGroup[];
  returnTo?: string;
  submitLabel?: string;
  /** Onboarding pins the footer; Settings lets it sit in the flow of the page. */
  sticky?: boolean;
}) {
  const [state, action] = useActionState(saveRagAction, idleFormState);

  const [ratings, setRatings] = useState<Record<string, RagValue | null>>(() =>
    Object.fromEntries(
      subjects.flatMap((subject) => subject.topics.map((topic) => [topic.id, topic.initial])),
    ),
  );

  const total = useMemo(
    () => subjects.reduce((sum, subject) => sum + subject.topics.length, 0),
    [subjects],
  );
  const rated = Object.values(ratings).filter(Boolean).length;
  const complete = rated === total;

  function set(topicId: string, value: RagValue) {
    setRatings((previous) => ({ ...previous, [topicId]: value }));
  }

  function setAll(subject: SubjectGroup, value: RagValue) {
    setRatings((previous) => {
      const next = { ...previous };
      for (const topic of subject.topics) next[topic.id] = value;
      return next;
    });
  }

  return (
    <form action={action} className={sticky ? "pb-24" : undefined}>
      {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
      <Legend />

      {state.message ? (
        <div className="mt-6">
          <Alert variant="error">{state.message}</Alert>
        </div>
      ) : null}

      <div className="mt-6 space-y-8">
        {subjects.map((subject) => {
          const accent = subjectClasses(subject.accent);
          const papers = [...new Set(subject.topics.map((topic) => topic.paper))].sort();

          return (
            <section key={subject.id} aria-labelledby={`subject-${subject.id}`}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2
                  id={`subject-${subject.id}`}
                  className={cn("text-lg font-semibold tracking-tight", accent.text)}
                >
                  {subject.name}
                </h2>

                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Set all to</span>
                  {RAG_ORDER.map((value) => (
                    <Button
                      key={value}
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setAll(subject, value)}
                    >
                      <span
                        aria-hidden="true"
                        className={cn("mr-1 size-1.5 rounded-full", RAG_CLASSES[value].dot)}
                      />
                      {RAG_META[value].label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-border bg-card">
                {papers.map((paper) => (
                  <div key={paper}>
                    <p className="border-b border-border bg-muted/60 px-4 py-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      Paper {paper}
                    </p>
                    {subject.topics
                      .filter((topic) => topic.paper === paper)
                      .map((topic) => (
                        <div
                          key={topic.id}
                          className="flex flex-col gap-2 border-b border-border px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">
                              <span className="mr-2 font-mono text-xs text-muted-foreground">
                                {topic.code}
                              </span>
                              {topic.title}
                            </p>
                          </div>
                          <RagSelector
                            name={`rag:${topic.id}`}
                            value={ratings[topic.id] ?? null}
                            onChange={(value) => set(topic.id, value)}
                            label={topic.title}
                            compact
                          />
                        </div>
                      ))}
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <div
        className={cn(
          "border-border bg-card/95",
          sticky
            ? "fixed inset-x-0 bottom-0 z-10 border-t backdrop-blur"
            : "mt-6 rounded-xl border",
        )}
      >
        <div
          className={cn(
            "flex w-full items-center justify-between gap-4",
            sticky ? "mx-auto max-w-3xl px-5 py-3 sm:px-8" : "px-4 py-3",
          )}
        >
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground" aria-live="polite">
              {rated} of {total} rated
            </p>
            <div
              className="mt-1 h-1.5 w-32 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={rated}
              aria-label="Topics rated"
            >
              <div
                className="h-full rounded-full bg-primary transition-[width]"
                style={{ width: `${total === 0 ? 0 : (rated / total) * 100}%` }}
              />
            </div>
          </div>

          {/* Shows what's left, but never blocks the submit: if the counter and the
              form ever disagree, the server decides and says which topics are missing. */}
          <SubmitButton size="lg" pendingLabel="Saving…">
            {complete ? submitLabel : `${total - rated} left`}
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}

function Legend() {
  return (
    <div className="grid gap-2 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
      {RAG_ORDER.map((value) => {
        const meta = RAG_META[value];
        return (
          <div key={value} className="flex items-start gap-2.5">
            <span
              aria-hidden="true"
              className={cn("mt-1.5 size-2 shrink-0 rounded-full", RAG_CLASSES[value].dot)}
            />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{meta.label}</p>
              <p className="text-xs text-muted-foreground">{meta.consequence}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
