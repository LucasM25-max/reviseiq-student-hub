"use client";

import { useActionState } from "react";
import type { ReactNode } from "react";

import { SubmitButton } from "@/components/ui/submit-button";
import { idleFormState } from "@/lib/forms";
import { disputeMarkAction, startPracticeAction, submitAnswerAction } from "@/lib/test/actions";

/**
 * Thin client wrappers around the practice actions.
 *
 * Everything inside them — question stems, diagrams, mark schemes — is rendered on the
 * server and arrives as `children`, so markdown, KaTeX and the diagram components stay
 * out of the browser bundle. All these add is the form, a submit button that disables
 * itself, and somewhere for a failure to be reported.
 *
 * Each imports its action directly and passes it straight to `action=`. No closures:
 * React only emits the hidden action fields for a true server reference, and wrapping
 * one breaks the form for every student whose JavaScript has not arrived yet.
 */

function FormMessage({ state }: { state: { ok: boolean; message?: string } }) {
  if (!state.message) return null;

  return (
    <p
      role={state.ok ? "status" : "alert"}
      className={
        state.ok
          ? "mb-3 rounded-md border border-[var(--border)] bg-[var(--muted)] px-3 py-2 text-sm"
          : "mb-3 rounded-md border border-[var(--destructive-border)] bg-[var(--destructive-surface)] px-3 py-2 text-sm text-[var(--destructive)]"
      }
    >
      {state.message}
    </p>
  );
}

export function StartPracticeForm({
  subTopicId,
  label,
}: {
  subTopicId: string;
  label: string;
}) {
  const [state, action] = useActionState(startPracticeAction, idleFormState);

  return (
    <form action={action}>
      <input type="hidden" name="subTopicId" value={subTopicId} />
      <FormMessage state={state} />
      <SubmitButton size="sm" pendingLabel="Setting up…">
        {label}
      </SubmitButton>
    </form>
  );
}

export function AnswerForm({
  setId,
  questionId,
  startedAt,
  children,
}: {
  setId: string;
  questionId: string;
  startedAt: string;
  children: ReactNode;
}) {
  const [state, action] = useActionState(submitAnswerAction, idleFormState);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="setId" value={setId} />
      <input type="hidden" name="questionId" value={questionId} />
      <input type="hidden" name="startedAt" value={startedAt} />
      {children}
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Marking…">Submit for marking</SubmitButton>
    </form>
  );
}

/**
 * "I think this mark is wrong."
 *
 * Deliberately prominent rather than tucked away. An AI mark that is wrong and
 * unchallengeable loses a student for good, so the way to challenge it is always on
 * screen next to the mark itself.
 */
export function DisputeForm({ attemptId, disputed }: { attemptId: string; disputed: boolean }) {
  const [state, action] = useActionState(disputeMarkAction, idleFormState);

  if (disputed || state.ok) {
    return (
      <p className="rounded-md border border-[var(--border)] bg-[var(--muted)] px-3 py-2 text-sm">
        {state.message ?? "Flagged for review. Your mark hasn't changed."}
      </p>
    );
  }

  return (
    <details className="rounded-md border border-[var(--border)]">
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
        I think this mark is wrong
      </summary>
      <form action={action} className="space-y-3 border-t border-[var(--border)] p-3">
        <input type="hidden" name="attemptId" value={attemptId} />
        <label htmlFor={`reason-${attemptId}`} className="block text-sm">
          What do you think it got wrong? (optional)
        </label>
        <textarea
          id={`reason-${attemptId}`}
          name="reason"
          rows={3}
          maxLength={1000}
          className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          placeholder="I said the same thing as mark point 2, just in different words."
        />
        <FormMessage state={state} />
        <SubmitButton variant="secondary" size="sm" pendingLabel="Sending…">
          Flag this mark
        </SubmitButton>
      </form>
    </details>
  );
}
