import type { Metadata } from "next";
import Link from "next/link";

import { FlashcardReview } from "@/components/revise/flashcard-review";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireOnboardedUser } from "@/lib/auth/session";
import { gradeCardFormAction, suspendCardFormAction } from "@/lib/flashcards/actions";
import { deckSummaryFor, dueQueueFor } from "@/lib/flashcards/review";
import { formatInterval, RATINGS } from "@/lib/fsrs";

export const metadata: Metadata = {
  title: "Flashcards",
  robots: { index: false, follow: false },
};

const RATING_LABEL: Record<string, string> = {
  AGAIN: "Again",
  HARD: "Hard",
  GOOD: "Good",
  EASY: "Easy",
};

export default async function FlashcardsPage() {
  const user = await requireOnboardedUser();

  const now = new Date();
  const [summary, queue] = await Promise.all([
    deckSummaryFor(user.id, now),
    dueQueueFor(user.id, now),
  ]);

  const first = queue[0];

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Flashcards</h1>
          <p className="mt-1 text-muted-foreground">
            {summary.total === 0
              ? "Your deck builds itself."
              : `${summary.due} due · ${summary.total} in your deck`}
          </p>
        </div>
        <Link href="/revise" className="rounded text-sm underline hover:no-underline">
          Back to Revise
        </Link>
      </header>

      {summary.total === 0 ? (
        /* The cold start is a direct consequence of D11 and is designed for, not
           apologised for (doc 07 §6). */
        <section className="rounded-lg border border-[var(--border)] p-6">
          <h2 className="text-lg font-medium">Your deck builds itself</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Every question you get wrong becomes a card here, scheduled so it comes back just
            before you would have forgotten it. Nothing to write, nothing to set up.
          </p>
          <Link
            href="/test"
            className="mt-4 inline-block rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
          >
            Answer some questions
          </Link>
        </section>
      ) : queue.length === 0 ? (
        <section className="rounded-lg border border-[var(--border)] p-6">
          <h2 className="text-lg font-medium">Nothing due right now</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            That is the system working — spacing them out is what makes them stick. Your next
            card is scheduled automatically.
          </p>
        </section>
      ) : (
        <>
          <FlashcardReview
            cards={queue.map((card) => ({
              id: card.id,
              front: card.front,
              back: card.back,
              hint: card.hint,
              lapses: card.lapses,
              createdAt: card.createdAt.toISOString(),
              intervals: Object.fromEntries(
                RATINGS.map((rating) => [rating, formatInterval(card.intervals[rating], now)]),
              ),
            }))}
          />

          {/*
            Without JavaScript the session above cannot run, so a plain server-rendered
            form grades one card per page load. Slower, but it works — and it is what
            the JS-disabled smoke suite drives.
          */}
          <noscript>
            <section className="space-y-3 rounded-lg border border-[var(--border)] p-4">
              <h2 className="font-medium">{first!.front}</h2>
              <details>
                <summary className="cursor-pointer text-sm">Show the answer</summary>
                <p className="mt-2 text-sm">{first!.back}</p>
              </details>
              <div className="flex flex-wrap gap-2">
                {RATINGS.map((rating) => (
                  <form key={rating} action={gradeCardFormAction}>
                    <input type="hidden" name="cardId" value={first!.id} />
                    <input type="hidden" name="rating" value={rating} />
                    <SubmitButton
                      size="sm"
                      variant={rating === "GOOD" ? "primary" : "secondary"}
                    >
                      {RATING_LABEL[rating]} · {formatInterval(first!.intervals[rating], now)}
                    </SubmitButton>
                  </form>
                ))}
                <form action={suspendCardFormAction}>
                  <input type="hidden" name="cardId" value={first!.id} />
                  <SubmitButton size="sm" variant="ghost">
                    Pause this card
                  </SubmitButton>
                </form>
              </div>
            </section>
          </noscript>
        </>
      )}

      {summary.suspended > 0 || summary.retired > 0 ? (
        <p className="text-sm text-muted-foreground">
          {summary.suspended > 0 ? `${summary.suspended} paused` : null}
          {summary.suspended > 0 && summary.retired > 0 ? " · " : null}
          {summary.retired > 0
            ? `${summary.retired} retired — you proved these in questions`
            : null}
          {summary.leeches > 0 ? ` · ${summary.leeches} needing the notes instead` : null}
        </p>
      ) : null}
    </div>
  );
}
