import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BlurtForm } from "@/components/revise/blurt-form";
import { requireOnboardedUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { subjectSlugFromId } from "@/lib/content/queries";
import type { BlurtResult, ExpectedPoint } from "@/lib/ai/blurt";

export const metadata: Metadata = {
  title: "Blurt it",
  robots: { index: false, follow: false },
};

/**
 * Semi-blurting (D15).
 *
 * Write everything you can remember, then see which ideas came back. Deliberately
 * not marked like an exam answer: the coverage list links straight into the notes
 * for whatever was missed, which is the whole loop.
 */
export default async function BlurtPage({ params }: { params: Promise<{ promptId: string }> }) {
  const user = await requireOnboardedUser();
  const { promptId } = await params;

  const prompt = await prisma.blurtPrompt.findUnique({
    where: { id: promptId },
    select: {
      id: true,
      prompt: true,
      expectedPoints: true,
      estMinutes: true,
      subTopic: {
        select: { id: true, code: true, title: true, topic: { select: { subjectId: true } } },
      },
    },
  });

  if (!prompt) notFound();

  const latest = await prisma.blurtAttempt.findFirst({
    where: { userId: user.id, promptId: prompt.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, coveragePct: true, detail: true, createdAt: true },
  });

  const expected = (
    Array.isArray(prompt.expectedPoints) ? prompt.expectedPoints : []
  ) as ExpectedPoint[];

  const result = (latest?.detail as unknown as BlurtResult | null) ?? null;
  const byPoint = new Map((result?.coverage ?? []).map((entry) => [entry.pointId, entry]));

  const notesHref = `/revise/${subjectSlugFromId(prompt.subTopic.topic.subjectId)}/notes/${prompt.subTopic.code.replaceAll(".", "-")}`;
  const startedAt = new Date().toISOString();

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Blurt it</h1>
          <p className="mt-1 text-muted-foreground">
            {prompt.subTopic.code} {prompt.subTopic.title} · about {prompt.estMinutes} minutes
          </p>
        </div>
        <Link href={notesHref} className="rounded text-sm underline hover:no-underline">
          Open the notes
        </Link>
      </header>

      <section className="rounded-lg border border-[var(--border)] p-4 sm:p-5">
        <h2 className="font-medium">{prompt.prompt}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Write everything you can remember, in any order. Notes and fragments are fine — this
          is not marked like an exam answer.
        </p>

        <div className="mt-4">
          <BlurtForm promptId={prompt.id} startedAt={startedAt} />
        </div>
      </section>

      {result ? (
        <section className="space-y-4" aria-label="What you remembered">
          <div className="rounded-lg border border-[var(--border)] p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold">{result.coveragePct}% of the ideas</h2>
              <p className="text-sm text-muted-foreground">
                {result.coverage.filter((entry) => entry.present).length} of{" "}
                {result.coverage.length} recalled
              </p>
            </div>

            <div
              className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[var(--muted)]"
              role="img"
              aria-label={`${result.coveragePct} per cent of the ideas recalled`}
            >
              <div
                className="h-full rounded-full bg-[var(--primary)]"
                style={{ width: `${result.coveragePct}%` }}
              />
            </div>

            {result.encouragement ? (
              <p className="mt-3 text-sm text-muted-foreground">{result.encouragement}</p>
            ) : null}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold">Idea by idea</h3>
            <ul className="space-y-2">
              {expected.map((point) => {
                const entry = byPoint.get(point.id);
                const present = entry?.present ?? false;
                return (
                  <li key={point.id} className="flex gap-3 text-sm">
                    <span aria-hidden="true" className="shrink-0">
                      {present ? "✓" : "—"}
                    </span>
                    <div>
                      <p className={present ? "" : "font-medium"}>
                        {point.idea}
                        <span className="sr-only">
                          {present ? " — you mentioned this" : " — you didn't mention this"}
                        </span>
                      </p>
                      {entry?.evidence ? (
                        <p className="text-muted-foreground">
                          You wrote: &ldquo;{entry.evidence}&rdquo;
                        </p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {result.extrasCorrect.length > 0 ? (
            <div>
              <h3 className="mb-1 text-sm font-semibold">
                Also right, and we didn&rsquo;t ask
              </h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {result.extrasCorrect.map((extra) => (
                  <li key={extra}>{extra}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {result.extrasWrong.length > 0 ? (
            <div>
              <h3 className="mb-1 text-sm font-semibold">Worth checking</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {result.extrasWrong.map((extra) => (
                  <li key={extra}>{extra}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="text-sm">
            <Link href={notesHref} className="underline hover:no-underline">
              Read the notes on what you missed
            </Link>
          </p>
        </section>
      ) : null}
    </div>
  );
}
