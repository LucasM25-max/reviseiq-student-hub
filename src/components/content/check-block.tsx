"use client";

import { useId, useState } from "react";

import { Markdown } from "@/components/content/markdown";
import { cn } from "@/lib/utils";

/**
 * An inline comprehension check inside a lesson.
 *
 * Deliberately *not* a form and deliberately not persisted: it is a self-check, not an
 * assessment, so it does not touch mastery, does not create a flashcard and does not
 * need a server round trip. Real assessment happens in Test.
 *
 * Progressive enhancement: with JavaScript off, the radio buttons and the answer are
 * both present — the answer is revealed by a `<details>` element instead of by state —
 * so the block is still usable. (Repo convention: never wrap a server action in a
 * client closure; there is no action here at all, which keeps that rule trivially safe.)
 */
export function CheckBlock({
  prompt,
  options,
  correctKey,
  explanation,
}: {
  prompt: string;
  options: { key: string; text: string }[];
  correctKey: string;
  explanation: string;
}) {
  const groupName = useId();
  const [chosen, setChosen] = useState<string | null>(null);
  const answered = chosen !== null;
  const correct = chosen === correctKey;

  return (
    <section
      className="my-6 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-4"
      aria-labelledby={`${groupName}-prompt`}
    >
      <p className="mb-1 text-xs font-semibold tracking-wide text-[var(--muted-foreground)] uppercase">
        Check yourself
      </p>
      <div id={`${groupName}-prompt`} className="mb-3">
        <Markdown className="[&>p:first-child]:mt-0 [&>p:last-child]:mb-0">{prompt}</Markdown>
      </div>

      <fieldset className="space-y-2">
        <legend className="sr-only">Choose one answer</legend>
        {options.map((option) => {
          const isChosen = chosen === option.key;
          const isCorrect = option.key === correctKey;
          return (
            <label
              key={option.key}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2 text-sm transition-colors",
                !answered && "border-[var(--border)] hover:bg-[var(--muted)]/50",
                answered &&
                  isCorrect &&
                  "border-[var(--success-border)] bg-[var(--success-surface)]",
                answered &&
                  isChosen &&
                  !isCorrect &&
                  "border-[var(--destructive-border)] bg-[var(--destructive-surface)]",
                answered && !isChosen && !isCorrect && "border-[var(--border)] opacity-60",
              )}
            >
              <input
                type="radio"
                name={groupName}
                value={option.key}
                checked={isChosen}
                onChange={() => setChosen(option.key)}
                className="mt-0.5 accent-[var(--primary)]"
              />
              <span>
                <span className="mr-1.5 font-semibold">{option.key}</span>
                {option.text}
              </span>
            </label>
          );
        })}
      </fieldset>

      {answered ? (
        <div
          role="status"
          className={cn(
            "mt-3 rounded-md px-3 py-2 text-sm",
            correct
              ? "bg-[var(--success-surface)] text-[var(--success)]"
              : "bg-[var(--destructive-surface)] text-[var(--destructive)]",
          )}
        >
          <p className="font-semibold">
            {correct ? "Correct." : `Not quite — the answer is ${correctKey}.`}
          </p>
          <div className="mt-1 text-[var(--foreground)]">
            <Markdown className="[&>p:first-child]:mt-0 [&>p:last-child]:mb-0">
              {explanation}
            </Markdown>
          </div>
        </div>
      ) : (
        // The no-JavaScript path: choosing a radio does nothing without React, so the
        // answer stays reachable behind a native disclosure.
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-[var(--muted-foreground)]">
            Show the answer
          </summary>
          <div className="mt-2">
            <p className="font-semibold">The answer is {correctKey}.</p>
            <Markdown className="[&>p:first-child]:mt-0 [&>p:last-child]:mb-0">
              {explanation}
            </Markdown>
          </div>
        </details>
      )}
    </section>
  );
}
