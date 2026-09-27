"use client";

import { useId, useMemo, useState } from "react";

import { gradeAssignment, scoreSentence } from "@/lib/widgets/grading";
import { seededShuffle } from "@/lib/widgets/shuffle";
import type { CardSortConfig } from "@/lib/widgets/schemas";
import { cn } from "@/lib/utils";

import { WidgetAnswerKey, WidgetButton, WidgetShell, WidgetStatus } from "./widget-shell";

/**
 * Match each card on the left to its partner on the right.
 *
 * Drag and drop is the obvious implementation and the wrong one: it is hostile to
 * keyboards, hostile to touch at this density, and — decisively here — impossible to
 * test without a browser, which this project does not have. A select per row is plainly
 * duller and is better in every way that matters. The marking lives in
 * `gradeAssignment`, which is pure and covered.
 */
export function CardSortWidget({ config, seed }: { config: CardSortConfig; seed: string }) {
  const fieldId = useId();

  // Shuffled once, deterministically: the same order on the server and in the browser,
  // and the same order again after a reload, so the cards never move under the student.
  const options = useMemo(
    () =>
      seededShuffle(
        config.pairs.map((pair) => pair.right),
        `${seed}:card-sort`,
      ),
    [config.pairs, seed],
  );

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);

  const grade = useMemo(
    () =>
      gradeAssignment(
        config.pairs.map((pair) => ({ key: pair.left, expected: pair.right })),
        answers,
      ),
    [config.pairs, answers],
  );

  const reset = () => {
    setAnswers({});
    setChecked(false);
  };

  return (
    <WidgetShell
      title="Match the pairs"
      instruction={config.instruction}
      controls={
        <>
          <WidgetButton onClick={() => setChecked(true)} disabled={grade.answered === 0}>
            Check my answers
          </WidgetButton>
          {checked ? (
            <WidgetButton variant="ghost" onClick={reset}>
              Try again
            </WidgetButton>
          ) : null}
        </>
      }
      status={
        checked ? (
          <WidgetStatus tone={grade.allCorrect ? "success" : "warning"}>
            {scoreSentence(grade.correct, grade.total)}{" "}
            {grade.allCorrect
              ? "Every card is in the right place."
              : "The ones marked wrong are highlighted — try them again."}
          </WidgetStatus>
        ) : null
      }
      answers={
        checked ? null : (
          <WidgetAnswerKey>
            <dl className="space-y-1">
              {config.pairs.map((pair) => (
                <div key={pair.left}>
                  <dt className="inline font-medium">{pair.left} — </dt>
                  <dd className="inline text-[var(--muted-foreground)]">{pair.right}</dd>
                </div>
              ))}
            </dl>
          </WidgetAnswerKey>
        )
      }
    >
      <ul className="space-y-2">
        {config.pairs.map((pair, index) => {
          const result = grade.results[index];
          const showResult = checked && result.chosen !== null;
          const selectId = `${fieldId}-${index}`;

          return (
            <li
              key={pair.left}
              className={cn(
                "rounded-md border px-3 py-2 sm:flex sm:items-center sm:gap-3",
                !showResult && "border-[var(--border)]",
                showResult &&
                  result.correct &&
                  "border-[var(--success-border)] bg-[var(--success-surface)]",
                showResult &&
                  !result.correct &&
                  "border-[var(--destructive-border)] bg-[var(--destructive-surface)]",
              )}
            >
              <label
                htmlFor={selectId}
                className="block text-sm font-medium sm:w-44 sm:shrink-0"
              >
                {pair.left}
              </label>
              <div className="mt-1 flex-1 sm:mt-0">
                <select
                  id={selectId}
                  value={answers[pair.left] ?? ""}
                  onChange={(event) =>
                    setAnswers((previous) => ({
                      ...previous,
                      [pair.left]: event.target.value,
                    }))
                  }
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
                >
                  <option value="">Choose the {config.rightHeading.toLowerCase()}…</option>
                  {options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                {checked && !result.correct ? (
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    Correct answer: {result.expected}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </WidgetShell>
  );
}
