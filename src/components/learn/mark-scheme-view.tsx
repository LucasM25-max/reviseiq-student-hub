/**
 * A mark scheme, plus the control a student uses to award themselves marks against it.
 *
 * Shown only after the answer has been submitted. The model answer is displayed here and
 * is never sent to a marker (doc 04) — in Phase 4 there is no marker to send it to, but
 * keeping it in the same component as the "after marking" view is what stops it leaking
 * into the "before marking" one later.
 *
 * Self-marking is explicit about being self-marking. A student who awards themselves
 * three out of three for an answer that misses the point is only cheating themselves, and
 * the honest framing — here is each mark point, did you say this — is the framing that
 * makes the exercise worth doing at all.
 */
import { Markdown } from "@/components/content/markdown";
import type { MasteryQuestion } from "@/lib/learn/mastery-queries";
import type { NumericVerdict } from "@/lib/marking/numeric";
import { cn } from "@/lib/utils";

export function MarkSchemeView({
  question,
  numeric,
}: {
  question: MasteryQuestion;
  numeric?: NumericVerdict;
}) {
  const scheme = question.markScheme;
  if (!scheme) {
    return (
      <p className="text-sm text-[var(--muted-foreground)]">
        No mark scheme is available for this question.
      </p>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      {numeric ? (
        <p
          className={cn(
            "rounded-md px-3 py-2",
            numeric.inRange && numeric.unitOk !== false
              ? "bg-[var(--success-surface)] text-[var(--success)]"
              : "bg-[var(--warning-surface)] text-[var(--warning)]",
          )}
        >
          <span className="font-semibold">Your value: </span>
          {numeric.summary}
        </p>
      ) : null}

      <div>
        <p className="font-semibold">Mark scheme</p>
        <ul className="mt-1 space-y-1.5">
          {scheme.points.map((point) => (
            <li key={point.id} className="flex gap-2">
              <span className="shrink-0 font-medium text-[var(--muted-foreground)]">
                {point.marks} mark{point.marks === 1 ? "" : "s"}
              </span>
              <span>
                {point.text}
                {point.alternatives.length > 0 ? (
                  <span className="block text-[var(--muted-foreground)]">
                    Allow: {point.alternatives.join(" · ")}
                  </span>
                ) : null}
                {point.reject.length > 0 ? (
                  <span className="block text-[var(--muted-foreground)]">
                    Reject: {point.reject.join(" · ")}
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {scheme.guidance ? (
        <p className="text-[var(--muted-foreground)]">
          <span className="font-medium">Guidance: </span>
          {scheme.guidance}
        </p>
      ) : null}
      {scheme.ecfRules ? (
        <p className="text-[var(--muted-foreground)]">
          <span className="font-medium">Error carried forward: </span>
          {scheme.ecfRules}
        </p>
      ) : null}

      {scheme.modelAnswer ? (
        <details>
          <summary className="cursor-pointer text-[var(--muted-foreground)]">
            Show a full-mark answer
          </summary>
          <div className="mt-1">
            <Markdown className="[&>p:first-child]:mt-0 [&>p:last-child]:mb-0">
              {scheme.modelAnswer}
            </Markdown>
          </div>
        </details>
      ) : null}
    </div>
  );
}

/** The number input a student awards themselves marks with. */
export function SelfMarkInput({
  questionId,
  maxMarks,
  defaultValue,
}: {
  questionId: string;
  maxMarks: number;
  defaultValue?: number;
}) {
  const inputId = `mark-${questionId}`;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-3">
      <label htmlFor={inputId} className="text-sm font-medium">
        Marks you would award yourself
      </label>
      <input
        id={inputId}
        name={inputId}
        type="number"
        min={0}
        max={maxMarks}
        step={1}
        required
        defaultValue={defaultValue ?? 0}
        className="w-20 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm"
      />
      <span className="text-sm text-[var(--muted-foreground)]">out of {maxMarks}</span>
    </div>
  );
}
