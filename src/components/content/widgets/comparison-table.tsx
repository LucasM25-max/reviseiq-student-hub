"use client";

import { useId, useMemo, useState } from "react";

import { Markdown } from "@/components/content/markdown";
import { gradeComparisonTable, scoreSentence } from "@/lib/widgets/grading";
import type { ComparisonTableConfig } from "@/lib/widgets/schemas";
import { cn } from "@/lib/utils";

import { WidgetAnswerKey, WidgetButton, WidgetShell, WidgetStatus } from "./widget-shell";

/**
 * A tick-or-cross grid comparing two or more things.
 *
 * Each cell is a checkbox meaning "this applies", so an empty grid reads as "none of
 * these apply" rather than as an unstarted one. That is why the score counts *rows* and
 * not cells: every row here has at least one tick in it, so an untouched grid scores
 * zero, which is the honest answer.
 *
 * Rows can carry a `note`, and the notes are where the exam marks actually are —
 * "chloroplasts: plant" is true enough for a grid and false enough to lose a mark, so
 * the hedge the grid cannot express is shown alongside the feedback.
 */
export function ComparisonTableWidget({ config }: { config: ComparisonTableConfig }) {
  const fieldId = useId();

  const expected = useMemo(() => config.rows.map((row) => row.answers), [config.rows]);

  const [ticks, setTicks] = useState<Record<string, boolean>>({});
  const [checked, setChecked] = useState(false);

  const answers = useMemo(
    () =>
      config.rows.map((_, rowIndex) =>
        config.columns.map((__, columnIndex) => ticks[`${rowIndex}:${columnIndex}`] ?? false),
      ),
    [config.rows, config.columns, ticks],
  );

  const grade = useMemo(() => gradeComparisonTable(expected, answers), [expected, answers]);

  const toggle = (rowIndex: number, columnIndex: number) =>
    setTicks((previous) => {
      const key = `${rowIndex}:${columnIndex}`;
      return { ...previous, [key]: !previous[key] };
    });

  const reset = () => {
    setTicks({});
    setChecked(false);
  };

  const anyTicked = Object.values(ticks).some(Boolean);

  return (
    <WidgetShell
      title="Fill in the comparison"
      instruction={config.instruction}
      controls={
        <>
          <WidgetButton onClick={() => setChecked(true)} disabled={!anyTicked}>
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
            {scoreSentence(grade.rowsCorrect, grade.rows)}{" "}
            {grade.allCorrect
              ? "Every row is right."
              : "Rows with a mistake are highlighted below."}
          </WidgetStatus>
        ) : null
      }
      answers={
        checked ? null : (
          <WidgetAnswerKey>
            <ul className="space-y-1">
              {config.rows.map((row) => (
                <li key={row.label}>
                  <span className="font-medium">{row.label}</span>
                  {" — "}
                  <span className="text-[var(--muted-foreground)]">
                    {row.answers.some(Boolean)
                      ? config.columns.filter((_, i) => row.answers[i]).join(", ")
                      : "neither"}
                  </span>
                </li>
              ))}
            </ul>
          </WidgetAnswerKey>
        )
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            {config.rowHeading}, compared across {config.columns.join(" and ")}
          </caption>
          <thead>
            <tr>
              <th scope="col" className="border-b border-[var(--border)] px-2 py-2 text-left">
                {config.rowHeading}
              </th>
              {config.columns.map((column) => (
                <th
                  key={column}
                  scope="col"
                  className="border-b border-[var(--border)] px-2 py-2 text-center font-medium"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {config.rows.map((row, rowIndex) => {
              const rowWrong = checked && grade.wrongRows.includes(rowIndex);
              const rowRight = checked && !grade.wrongRows.includes(rowIndex);

              return (
                <tr
                  key={row.label}
                  className={cn(
                    "border-b border-[var(--border)] last:border-b-0",
                    rowWrong && "bg-[var(--destructive-surface)]",
                    rowRight && "bg-[var(--success-surface)]",
                  )}
                >
                  <th scope="row" className="px-2 py-2 text-left font-normal">
                    {row.label}
                    {checked && row.note ? (
                      <span className="mt-0.5 block text-xs text-[var(--muted-foreground)]">
                        <Markdown className="[&>p]:my-0 [&>p]:text-xs">{row.note}</Markdown>
                      </span>
                    ) : null}
                  </th>
                  {config.columns.map((column, columnIndex) => {
                    const cellId = `${fieldId}-${rowIndex}-${columnIndex}`;
                    const isTicked = ticks[`${rowIndex}:${columnIndex}`] ?? false;
                    const shouldBeTicked = row.answers[columnIndex];

                    return (
                      <td key={column} className="px-2 py-2 text-center">
                        <input
                          id={cellId}
                          type="checkbox"
                          checked={isTicked}
                          onChange={() => toggle(rowIndex, columnIndex)}
                          className="size-4 accent-[var(--primary)]"
                          aria-label={`${row.label} — ${column}`}
                        />
                        {checked && isTicked !== shouldBeTicked ? (
                          <span className="mt-0.5 block text-xs text-[var(--destructive)]">
                            {shouldBeTicked ? "should be ticked" : "should be clear"}
                          </span>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </WidgetShell>
  );
}
