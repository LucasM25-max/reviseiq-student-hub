"use client";

import { useActionState } from "react";
import type { ReactNode } from "react";

import { SubmitButton } from "@/components/ui/submit-button";
import { idleFormState } from "@/lib/forms";
import {
  selfMarkAction,
  startMasteryAction,
  submitMasteryAction,
} from "@/lib/learn/mastery-actions";

/**
 * Three thin client wrappers around the mastery actions.
 *
 * Thin is the point. Everything inside them — question stems, diagrams, mark schemes —
 * is rendered on the server and arrives as `children`, so `react-markdown`, KaTeX and
 * three SVG diagrams stay out of the browser bundle. All these components add is the
 * `<form>`, a submit button that disables itself, and somewhere for a failed save to be
 * reported.
 *
 * Each imports its action directly and passes it straight to `useActionState`. No
 * closures: React only emits the hidden action fields for a true server reference, and
 * wrapping one breaks every form for every student whose JavaScript has not arrived.
 */

function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="mb-3 rounded-md border border-[var(--destructive-border)] bg-[var(--destructive-surface)] px-3 py-2 text-sm text-[var(--destructive)]"
    >
      {message}
    </p>
  );
}

export function MasteryStartForm({
  lessonId,
  path,
  label,
}: {
  lessonId: string;
  path: string;
  label: string;
}) {
  const [state, action] = useActionState(startMasteryAction, idleFormState);

  return (
    <form action={action}>
      <input type="hidden" name="lessonId" value={lessonId} />
      <input type="hidden" name="path" value={path} />
      <FormError message={state.ok ? undefined : state.message} />
      <SubmitButton size="lg" pendingLabel="Setting up…">
        {label}
      </SubmitButton>
    </form>
  );
}

export function MasteryAnswerForm({
  setId,
  path,
  startedAt,
  children,
}: {
  setId: string;
  path: string;
  startedAt: string;
  children: ReactNode;
}) {
  const [state, action] = useActionState(submitMasteryAction, idleFormState);

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="setId" value={setId} />
      <input type="hidden" name="path" value={path} />
      <input type="hidden" name="startedAt" value={startedAt} />
      {children}
      <div className="border-t border-[var(--border)] pt-5">
        <FormError message={state.ok ? undefined : state.message} />
        <SubmitButton size="lg" pendingLabel="Submitting…">
          Submit my answers
        </SubmitButton>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          You will see the mark scheme for every question straight afterwards.
        </p>
      </div>
    </form>
  );
}

export function MasteryMarkForm({
  setId,
  path,
  children,
}: {
  setId: string;
  path: string;
  children: ReactNode;
}) {
  const [state, action] = useActionState(selfMarkAction, idleFormState);

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="setId" value={setId} />
      <input type="hidden" name="path" value={path} />
      {children}
      <div className="border-t border-[var(--border)] pt-5">
        <FormError message={state.ok ? undefined : state.message} />
        <SubmitButton size="lg" pendingLabel="Saving…">
          Save my marks
        </SubmitButton>
      </div>
    </form>
  );
}
