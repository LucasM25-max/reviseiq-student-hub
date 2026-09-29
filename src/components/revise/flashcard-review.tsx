"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { gradeCardAction, suspendCardAction, undoReviewAction } from "@/lib/flashcards/actions";

/**
 * The review session (doc 07 §3).
 *
 * Keyboard-first: Space flips, 1–4 grade, U undoes, S suspends. The UI advances
 * optimistically and the write is fired without waiting, because a card that takes
 * 300ms to turn over makes a forty-card session feel like work.
 *
 * The whole queue is sent from the server in one go and held here, so grading never
 * blocks on a round trip. Cards already carry the interval each button would produce,
 * computed server-side by the same FSRS wrapper that will do the real scheduling.
 */

export type ReviewCardView = {
  id: string;
  front: string;
  back: string;
  hint: string | null;
  lapses: number;
  createdAt: string;
  intervals: Record<string, string>;
};

const RATINGS = [
  { key: "1", rating: "AGAIN", label: "Again", hint: "Didn't know it" },
  { key: "2", rating: "HARD", label: "Hard", hint: "A struggle" },
  { key: "3", rating: "GOOD", label: "Good", hint: "Recalled it" },
  { key: "4", rating: "EASY", label: "Easy", hint: "Instant" },
] as const;

export function FlashcardReview({ cards }: { cards: ReviewCardView[] }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [shownAt, setShownAt] = useState(() => Date.now());
  const [done, setDone] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const card = cards[index];
  const remaining = cards.length - index;

  const grade = useCallback(
    (rating: string) => {
      if (!card) return;

      // Fire and forget: the student moves on immediately.
      void gradeCardAction(
        { ok: true },
        (() => {
          const data = new FormData();
          data.append("cardId", card.id);
          data.append("rating", rating);
          data.append("durationMs", String(Date.now() - shownAt));
          return data;
        })(),
      );

      setDone((previous) => [...previous, card.id]);
      setIndex((previous) => previous + 1);
      setFlipped(false);
      setShownAt(Date.now());
      setMessage(null);
    },
    [card, shownAt],
  );

  const undo = useCallback(() => {
    const last = done.at(-1);
    if (!last) return;

    void undoReviewAction(
      { ok: true },
      (() => {
        const data = new FormData();
        data.append("cardId", last);
        return data;
      })(),
    );

    setDone((previous) => previous.slice(0, -1));
    setIndex((previous) => Math.max(0, previous - 1));
    setFlipped(true);
    setMessage("Undone.");
  }, [done]);

  const suspend = useCallback(() => {
    if (!card) return;

    void suspendCardAction(
      { ok: true },
      (() => {
        const data = new FormData();
        data.append("cardId", card.id);
        return data;
      })(),
    );

    setDone((previous) => [...previous, card.id]);
    setIndex((previous) => previous + 1);
    setFlipped(false);
    setMessage("Paused. You can bring it back from your deck.");
  }, [card]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // Never steal keys from a text field.
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        setFlipped((previous) => !previous);
        return;
      }
      if (event.key.toLowerCase() === "u") {
        event.preventDefault();
        undo();
        return;
      }
      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        suspend();
        return;
      }

      const rating = RATINGS.find((option) => option.key === event.key);
      // Grading before seeing the answer is how a session becomes meaningless.
      if (rating && flipped) {
        event.preventDefault();
        grade(rating.rating);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [flipped, grade, undo, suspend]);

  if (!card) {
    return (
      <div className="rounded-lg border border-[var(--border)] p-6 text-center">
        <p className="text-lg font-medium">Deck cleared.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {cards.length} card{cards.length === 1 ? "" : "s"} reviewed. Come back tomorrow — that
          is the point of spacing them.
        </p>
        {done.length > 0 ? (
          <Button variant="secondary" size="sm" className="mt-4" onClick={undo}>
            Undo the last one
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <p>
          {remaining} card{remaining === 1 ? "" : "s"} left
        </p>
        <p>You can stop any time — progress is saved as you go.</p>
      </div>

      <div
        className="rounded-lg border border-[var(--border)] p-6"
        aria-live="polite"
        aria-atomic="true"
      >
        <p className="text-xs tracking-wide text-muted-foreground uppercase">
          {flipped ? "Answer" : "Question"}
        </p>
        <p className="mt-2 text-lg">{flipped ? card.back : card.front}</p>

        {!flipped && card.hint ? (
          <p className="mt-3 text-sm text-muted-foreground">Hint: {card.hint}</p>
        ) : null}

        {flipped ? (
          <p className="mt-4 text-xs text-muted-foreground">
            From a question you got wrong on{" "}
            {new Date(card.createdAt).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
            })}
            {card.lapses > 0
              ? ` · forgotten ${card.lapses} time${card.lapses === 1 ? "" : "s"}`
              : ""}
          </p>
        ) : null}
      </div>

      {message ? (
        <p role="status" className="text-sm text-muted-foreground">
          {message}
        </p>
      ) : null}

      {flipped ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {RATINGS.map((option) => (
            <Button
              key={option.rating}
              variant={option.rating === "GOOD" ? "primary" : "secondary"}
              onClick={() => grade(option.rating)}
            >
              <span className="flex flex-col items-center leading-tight">
                <span>
                  {option.label}{" "}
                  <span aria-hidden="true" className="opacity-60">
                    {option.key}
                  </span>
                </span>
                <span className="text-xs opacity-70">{card.intervals[option.rating]}</span>
              </span>
            </Button>
          ))}
        </div>
      ) : (
        <Button onClick={() => setFlipped(true)} className="w-full">
          Show the answer <span className="ml-2 opacity-60">Space</span>
        </Button>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" size="sm" onClick={undo} disabled={done.length === 0}>
          Undo <span className="ml-1 opacity-60">U</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={suspend}>
          Pause this card <span className="ml-1 opacity-60">S</span>
        </Button>
      </div>
    </div>
  );
}
