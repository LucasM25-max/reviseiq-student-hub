/**
 * What a student sees after an answer is marked (doc 06 §1).
 *
 * The order is deliberate and is the whole trust argument: the mark, then the
 * point-by-point breakdown quoting their own words back as evidence, then what was
 * missing, then the full mark scheme and model answer, then a prominent way to say
 * the mark is wrong.
 *
 * A server component. The mark scheme and model answer are rendered here, after
 * marking, and never exist on the page while a question is still open.
 */

import { Markdown } from "@/components/content/markdown";
import { DisputeForm } from "@/components/test/practice-forms";
import type { MarkResult } from "@/lib/ai/types";

const SOURCE_LABEL: Record<string, string> = {
  AI: "Marked by AI against the mark scheme",
  AI_CACHED: "Marked by AI against the mark scheme",
  AI_FALLBACK: "Checked by word matching",
  AUTO: "Marked automatically",
  SELF: "Yours to mark",
};

function Tick({ awarded }: { awarded: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={
        awarded
          ? "bg-[var(--success, #16a34a)] mt-0.5 inline-block size-4 shrink-0 rounded-full"
          : "mt-0.5 inline-block size-4 shrink-0 rounded-full border-2 border-[var(--border)]"
      }
    />
  );
}

export function MarkBreakdown({
  result,
  attemptId,
  disputed,
  markScheme,
}: {
  result: MarkResult;
  attemptId: string;
  disputed: boolean;
  markScheme: {
    points: Array<{ id: string; text: string; marks: number }>;
    guidance: string | null;
    modelAnswer: string | null;
  } | null;
}) {
  const schemeById = new Map((markScheme?.points ?? []).map((point) => [point.id, point]));

  return (
    <section className="space-y-5" aria-label="Your mark">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="text-2xl font-semibold tracking-tight">
          {result.awardedMarks} / {result.maxMarks}
        </p>
        <p className="text-sm text-muted-foreground">
          {SOURCE_LABEL[result.source] ?? "Marked"}
        </p>
        {result.provisional ? (
          <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-xs">
            Provisional — check it yourself
          </span>
        ) : null}
      </header>

      {/* Standing disclaimer (doc 06 §1). Quiet, but always there. */}
      <p className="text-xs text-muted-foreground">
        Marked by AI against our mark scheme. It&rsquo;s usually right, but it&rsquo;s not an
        examiner — always read the mark scheme below.
      </p>

      {result.notes.length > 0 ? (
        <ul className="space-y-1 rounded-md border border-[var(--border)] bg-[var(--muted)] p-3 text-sm">
          {result.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}

      {result.pointsAwarded.length > 0 ? (
        <div>
          <h3 className="mb-2 text-sm font-semibold">Point by point</h3>
          <ul className="space-y-3">
            {result.pointsAwarded.map((point) => {
              const scheme = schemeById.get(point.markPointId);
              return (
                <li key={point.markPointId} className="flex gap-3">
                  <Tick awarded={point.awarded} />
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-medium">
                      {scheme?.text ?? point.markPointId}{" "}
                      <span className="font-normal text-muted-foreground">
                        {point.awarded ? `(+${scheme?.marks ?? 1})` : "(0)"}
                      </span>
                    </p>
                    {point.reason ? (
                      <p className="text-sm text-muted-foreground">{point.reason}</p>
                    ) : null}
                    {point.awarded && point.evidence ? (
                      <blockquote className="border-l-2 border-[var(--border)] pl-3 text-sm italic">
                        &ldquo;{point.evidence}&rdquo;
                      </blockquote>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {result.missing.length > 0 ? (
        <div>
          <h3 className="mb-2 text-sm font-semibold">What was missing</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {result.missing.map((missing) => (
              <li key={missing.markPointId}>{missing.whatWasNeeded}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {result.feedback.whatWentWell || result.feedback.evenBetterIf ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {result.feedback.whatWentWell ? (
            <div className="rounded-md border border-[var(--border)] p-3">
              <h3 className="text-sm font-semibold">What went well</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {result.feedback.whatWentWell}
              </p>
            </div>
          ) : null}
          {result.feedback.evenBetterIf ? (
            <div className="rounded-md border border-[var(--border)] p-3">
              <h3 className="text-sm font-semibold">Even better if</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {result.feedback.evenBetterIf}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {markScheme ? (
        <details className="rounded-md border border-[var(--border)]" open={result.provisional}>
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
            The full mark scheme
          </summary>
          <div className="space-y-3 border-t border-[var(--border)] p-3 text-sm">
            <ul className="list-disc space-y-1 pl-5">
              {markScheme.points.map((point) => (
                <li key={point.id}>
                  {point.text} <span className="text-muted-foreground">({point.marks})</span>
                </li>
              ))}
            </ul>
            {markScheme.guidance ? (
              <p className="text-muted-foreground">{markScheme.guidance}</p>
            ) : null}
            {markScheme.modelAnswer ? (
              <div>
                <h4 className="font-semibold">A model answer</h4>
                <div className="mt-1">
                  <Markdown>{markScheme.modelAnswer}</Markdown>
                </div>
              </div>
            ) : null}
          </div>
        </details>
      ) : null}

      <DisputeForm attemptId={attemptId} disputed={disputed} />
    </section>
  );
}
