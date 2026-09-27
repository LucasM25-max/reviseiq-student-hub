/**
 * An exam question, as a student sees it.
 *
 * A server component, so the stem's markdown and any diagram are rendered here rather
 * than in the browser. The inputs it emits are ordinary uncontrolled HTML — a radio
 * group or a textarea — which is all a question needs: the form around it is a client
 * component only so that a failed save has somewhere to be shown.
 *
 * The mark scheme is a separate component further down, because a question and its mark
 * scheme must never be able to render at the same time by accident.
 */
import { Diagram } from "@/components/content/diagram";
import { Markdown } from "@/components/content/markdown";
import type { MasteryQuestion } from "@/lib/learn/mastery-queries";
import { cn } from "@/lib/utils";

function DataTable({ table }: { table: { headers: string[]; rows: string[][] } }) {
  return (
    <div className="my-3 overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {table.headers.map((header) => (
              <th
                key={header}
                scope="col"
                className="border border-[var(--border)] px-2 py-1.5 text-left font-medium"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="border border-[var(--border)] px-2 py-1.5">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function QuestionAssets({ question }: { question: MasteryQuestion }) {
  const assets = question.assets;
  if (!assets) return null;

  return (
    <>
      {assets.diagramId ? (
        <Diagram
          diagramId={assets.diagramId}
          // Lettered structures show their letter *instead of* their name (D52), which
          // is the whole reason "name the structure labelled B" can use the same diagram
          // the lesson taught from without handing over the answer.
          labels="none"
          letters={assets.diagramLetters}
          caption={assets.figureCaption}
        />
      ) : null}
      {assets.dataTable ? <DataTable table={assets.dataTable} /> : null}
    </>
  );
}

export function QuestionView({
  question,
  number,
  total,
  defaultAnswerKey,
  defaultAnswerText,
  readOnly = false,
}: {
  question: MasteryQuestion;
  number: number;
  total: number;
  defaultAnswerKey?: string | null;
  defaultAnswerText?: string | null;
  readOnly?: boolean;
}) {
  const isObjective = question.options !== null && question.options.length > 0;

  return (
    <section
      id={`question-${question.id}`}
      className="scroll-mt-20 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-4"
      aria-labelledby={`${question.id}-stem`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-semibold tracking-wide text-[var(--muted-foreground)] uppercase">
          Question {number} of {total} · {question.commandWord}
        </p>
        <p className="text-xs text-[var(--muted-foreground)]">
          [{question.marks} mark{question.marks === 1 ? "" : "s"}]
        </p>
      </div>

      <div id={`${question.id}-stem`} className="mt-2">
        <Markdown className="[&>p:first-child]:mt-0 [&>p:last-child]:mb-0">
          {question.stem}
        </Markdown>
      </div>

      <QuestionAssets question={question} />

      {isObjective ? (
        <fieldset className="mt-3 space-y-2" disabled={readOnly}>
          <legend className="sr-only">Choose one answer</legend>
          {question.options?.map((option) => (
            <label
              key={option.key}
              className={cn(
                "flex items-start gap-3 rounded-md border border-[var(--border)] px-3 py-2 text-sm",
                readOnly ? "opacity-80" : "cursor-pointer hover:bg-[var(--muted)]/50",
              )}
            >
              <input
                type="radio"
                name={`key-${question.id}`}
                value={option.key}
                defaultChecked={defaultAnswerKey === option.key}
                className="mt-0.5 accent-[var(--primary)]"
              />
              <span>
                <span className="mr-1.5 font-semibold">{option.key}</span>
                {option.text}
              </span>
            </label>
          ))}
        </fieldset>
      ) : (
        <div className="mt-3">
          <label htmlFor={`text-${question.id}`} className="sr-only">
            Your answer to question {number}
          </label>
          <textarea
            id={`text-${question.id}`}
            name={`text-${question.id}`}
            defaultValue={defaultAnswerText ?? ""}
            readOnly={readOnly}
            // Roughly a line per mark, which is the space the real paper gives and
            // therefore the length signal a student should be reading.
            rows={Math.min(Math.max(question.marks + 1, 3), 8)}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm read-only:opacity-80"
            placeholder="Write your answer here. Show your working for calculations."
          />
        </div>
      )}
    </section>
  );
}
