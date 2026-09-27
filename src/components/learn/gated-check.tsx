"use client";

import { useActionState, useId } from "react";

import { Markdown } from "@/components/content/markdown";
import { SubmitButton } from "@/components/ui/submit-button";
import { answerCheckAction } from "@/lib/learn/actions";
import { idleFormState } from "@/lib/forms";
import { cn } from "@/lib/utils";

export type RecordedCheck = { chosenKey: string; correct: boolean };

/**
 * An inline check inside the lesson runner, as a real form.
 *
 * The self-check version of this block (`components/content/check-block.tsx`) keeps its
 * answer in React state and forgets it on reload, which is right for a block that gates
 * nothing. Here the answer gates the rest of the lesson, so it has to survive a reload —
 * a student who answers a check and closes the laptop must not come back to a locked
 * gate. That means a server round trip, which means a form.
 *
 * `answerCheckAction` is imported and passed straight to `action`, never wrapped: React
 * only emits the hidden action fields for a true server reference, and a wrapper would
 * break this form for every student without JavaScript.
 */
export function GatedCheck({
  lessonId,
  path,
  blockIndex,
  prompt,
  options,
  correctKey,
  explanation,
  recorded,
  stepStartedAt,
}: {
  lessonId: string;
  path: string;
  blockIndex: number;
  prompt: string;
  options: { key: string; text: string }[];
  correctKey: string;
  explanation: string;
  /** A previous answer, if this check has already been answered. */
  recorded?: RecordedCheck;
  stepStartedAt: string;
}) {
  const [state, action] = useActionState(answerCheckAction, idleFormState);
  const groupName = useId();
  const answered = recorded !== undefined;

  return (
    <section
      id={`check-${blockIndex}`}
      className="my-6 scroll-mt-20 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-4"
      aria-labelledby={`${groupName}-prompt`}
    >
      <p className="mb-1 text-xs font-semibold tracking-wide text-[var(--muted-foreground)] uppercase">
        Check yourself
      </p>
      <div id={`${groupName}-prompt`} className="mb-3">
        <Markdown className="[&>p:first-child]:mt-0 [&>p:last-child]:mb-0">{prompt}</Markdown>
      </div>

      <form action={action}>
        <input type="hidden" name="lessonId" value={lessonId} />
        <input type="hidden" name="path" value={path} />
        <input type="hidden" name="blockIndex" value={blockIndex} />
        <input type="hidden" name="stepStartedAt" value={stepStartedAt} />

        <fieldset className="space-y-2" disabled={answered}>
          <legend className="sr-only">Choose one answer</legend>
          {options.map((option) => {
            const isChosen = recorded?.chosenKey === option.key;
            const isCorrect = option.key === correctKey;
            return (
              <label
                key={option.key}
                className={cn(
                  "flex items-start gap-3 rounded-md border px-3 py-2 text-sm transition-colors",
                  !answered &&
                    "cursor-pointer border-[var(--border)] hover:bg-[var(--muted)]/50",
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
                  name="answer"
                  value={option.key}
                  defaultChecked={isChosen}
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

        {state.fieldErrors?.answer ? (
          <p className="mt-2 text-sm text-[var(--destructive)]">{state.fieldErrors.answer}</p>
        ) : null}
        {state.message && !state.ok ? (
          <p className="mt-2 text-sm text-[var(--destructive)]">{state.message}</p>
        ) : null}

        {answered ? null : (
          <div className="mt-3">
            <SubmitButton>Check my answer</SubmitButton>
          </div>
        )}
      </form>

      {recorded ? (
        <div
          role="status"
          className={cn(
            "mt-3 rounded-md px-3 py-2 text-sm",
            recorded.correct
              ? "bg-[var(--success-surface)] text-[var(--success)]"
              : "bg-[var(--destructive-surface)] text-[var(--destructive)]",
          )}
        >
          <p className="font-semibold">
            {recorded.correct ? "Correct." : `Not quite — the answer is ${correctKey}.`}
          </p>
          <div className="mt-1 text-[var(--foreground)]">
            <Markdown className="[&>p:first-child]:mt-0 [&>p:last-child]:mb-0">
              {explanation}
            </Markdown>
          </div>
        </div>
      ) : null}
    </section>
  );
}
