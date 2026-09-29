import type { Metadata } from "next";

import Link from "next/link";

import { ComingSoon } from "@/components/app/coming-soon";
import { requireOnboardedUser } from "@/lib/auth/session";
import { deckSummaryFor } from "@/lib/flashcards/review";
import { prisma } from "@/lib/db/prisma";

export const metadata: Metadata = {
  title: "Revise",
  robots: { index: false, follow: false },
};

export default async function RevisePage() {
  const user = await requireOnboardedUser();

  const [deck, blurts] = await Promise.all([
    deckSummaryFor(user.id),
    prisma.blurtPrompt.findMany({
      where: {
        subTopic: {
          topic: { subject: { enrolments: { some: { userId: user.id, active: true } } } },
        },
      },
      select: { id: true, prompt: true },
      orderBy: { order: "asc" },
      take: 6,
    }),
  ]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Revise</h1>
        <p className="mt-1 text-muted-foreground">
          Short notes, flashcards and the other things that make revision stick.
        </p>
      </header>

      <section aria-labelledby="tools" className="space-y-3">
        <h2 id="tools" className="text-lg font-semibold">
          Your revision tools
        </h2>

        <Link
          href="/revise/flashcards"
          className="flex items-center justify-between rounded-lg border border-[var(--border)] p-4 hover:bg-[var(--muted)]"
        >
          <span>
            <span className="block font-medium">Flashcards</span>
            <span className="block text-sm text-muted-foreground">
              {deck.total === 0
                ? "Your deck builds itself from questions you get wrong."
                : `${deck.due} due now · ${deck.total} in your deck`}
            </span>
          </span>
          <span aria-hidden="true" className="text-muted-foreground">
            →
          </span>
        </Link>

        {blurts.length > 0 ? (
          <div className="rounded-lg border border-[var(--border)] p-4">
            <p className="font-medium">Blurt it</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Write everything you remember on a topic, then see which ideas came back.
            </p>
            <ul className="mt-3 space-y-1">
              {blurts.map((prompt) => (
                <li key={prompt.id}>
                  <Link
                    href={`/revise/blurt/${prompt.id}`}
                    className="text-sm underline hover:no-underline"
                  >
                    {prompt.prompt}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <ComingSoon
        phase="Phase 7"
        title="Still to come"
        summary="Notes and practical sheets are already under each subject. The rest arrives with Today."
        bullets={[
          "A formula sheet per subject, with the given-in-exam split and a self-test mode",
          "Today deep links that hand you a frozen card list for the session",
        ]}
      />
    </div>
  );
}
