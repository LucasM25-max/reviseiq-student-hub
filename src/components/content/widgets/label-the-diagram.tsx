"use client";

import { useId, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { gradeAssignment, letterFor, scoreSentence } from "@/lib/widgets/grading";
import { seededShuffle } from "@/lib/widgets/shuffle";
import type { LabelTheDiagramConfig } from "@/lib/widgets/schemas";
import { cn } from "@/lib/utils";

import { WidgetAnswerKey, WidgetButton, WidgetShell, WidgetStatus } from "./widget-shell";

export type LabelSlot = { key: string; label: string };

/**
 * Name the lettered structures on a diagram.
 *
 * The diagram arrives as `children` already rendered by the server, with `labels="none"`
 * and `letters` set, so the SVG stays out of the client bundle and — more importantly —
 * the letters-replace-names rule from D52 keeps applying. If the diagram drew both, the
 * widget would be showing the student the answer it is asking them for.
 *
 * `recall-first` mode exists because retrieval before instruction is worth more than
 * recognition after it. The two modes differ only in the framing, but the framing is the
 * intervention: "you are not expected to know these yet" is what makes a student try
 * rather than scroll past.
 */
export function LabelTheDiagramWidget({
  config,
  slots,
  seed,
  children,
}: {
  config: LabelTheDiagramConfig;
  slots: LabelSlot[];
  seed: string;
  children: ReactNode;
}) {
  const fieldId = useId();
  const recallFirst = config.mode === "recall-first";

  const options = useMemo(
    () =>
      seededShuffle(
        slots.map((slot) => slot.label),
        `${seed}:label-the-diagram`,
      ),
    [slots, seed],
  );

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);

  const grade = useMemo(
    () =>
      gradeAssignment(
        slots.map((slot) => ({ key: slot.key, expected: slot.label })),
        answers,
      ),
    [slots, answers],
  );

  const reset = () => {
    setAnswers({});
    setChecked(false);
  };

  return (
    <WidgetShell
      title={recallFirst ? "Label it from memory first" : "Label the diagram"}
      instruction={
        config.prompt ??
        (recallFirst
          ? "Have a go before you read on. Getting it wrong now is the cheapest it will ever be."
          : "Name each lettered structure.")
      }
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
              ? "Every label is right."
              : recallFirst
                ? "That is exactly what the rest of this lesson is for."
                : "Check the ones marked wrong against the diagram."}
          </WidgetStatus>
        ) : null
      }
      answers={
        checked ? null : (
          <WidgetAnswerKey>
            <ul className="space-y-1">
              {slots.map((slot, index) => (
                <li key={slot.key}>
                  <span className="font-medium">{letterFor(index)}</span> — {slot.label}
                </li>
              ))}
            </ul>
          </WidgetAnswerKey>
        )
      }
    >
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
        <div className="min-w-0">{children}</div>

        <ul className="space-y-2">
          {slots.map((slot, index) => {
            const result = grade.results[index];
            const showResult = checked && result.chosen !== null;
            const selectId = `${fieldId}-${slot.key}`;

            return (
              <li
                key={slot.key}
                className={cn(
                  "flex items-center gap-2 rounded-md border px-2 py-1.5",
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
                  className="w-5 shrink-0 text-sm font-semibold"
                  aria-label={`Structure ${letterFor(index)}`}
                >
                  {letterFor(index)}
                </label>
                <div className="min-w-0 flex-1">
                  <select
                    id={selectId}
                    value={answers[slot.key] ?? ""}
                    onChange={(event) =>
                      setAnswers((previous) => ({
                        ...previous,
                        [slot.key]: event.target.value,
                      }))
                    }
                    className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm"
                  >
                    <option value="">Choose…</option>
                    {options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  {checked && !result.correct ? (
                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                      {result.expected}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </WidgetShell>
  );
}
