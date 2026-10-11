"use client";

import { useActionState } from "react";
import type { ReactNode } from "react";

import { SubmitButton } from "@/components/ui/submit-button";
import { idleFormState } from "@/lib/forms";
import {
  recordTestOutcomeAction,
  resolveSuggestionAction,
  resumeSchedulingAction,
  savePeriodAction,
  saveSchoolTestAction,
} from "@/lib/today/calendar-actions";

/**
 * Thin wrappers for the calendar and school-test forms.
 *
 * The subject and topic lists are server-rendered and arrive as `children`; these
 * add the form, the submit button and somewhere for a failure to appear. Actions
 * are passed straight through so every form works before JavaScript arrives.
 */

function Message({ state }: { state: { ok: boolean; message?: string } }) {
  if (!state.message) return null;
  return (
    <p
      role={state.ok ? "status" : "alert"}
      className={
        state.ok
          ? "text-sm text-muted-foreground"
          : "rounded-md border border-[var(--destructive-border)] bg-[var(--destructive-surface)] px-3 py-2 text-sm text-[var(--destructive)]"
      }
    >
      {state.message}
    </p>
  );
}

export function SchoolTestForm({
  testId,
  children,
  label,
}: {
  testId?: string;
  children: ReactNode;
  label: string;
}) {
  const [state, action] = useActionState(saveSchoolTestAction, idleFormState);

  return (
    <form action={action} className="space-y-3">
      {testId ? <input type="hidden" name="testId" value={testId} /> : null}
      {children}
      <Message state={state} />
      <SubmitButton size="sm" pendingLabel="Saving…">
        {label}
      </SubmitButton>
    </form>
  );
}

export function PeriodForm({
  periodId,
  children,
  label,
}: {
  periodId?: string;
  children: ReactNode;
  label: string;
}) {
  const [state, action] = useActionState(savePeriodAction, idleFormState);

  return (
    <form action={action} className="space-y-3">
      {periodId ? <input type="hidden" name="periodId" value={periodId} /> : null}
      {children}
      <Message state={state} />
      <SubmitButton size="sm" pendingLabel="Saving…">
        {label}
      </SubmitButton>
    </form>
  );
}

/** "How did it go?" — asked once, the day after (doc 05 §5a). */
export function TestOutcomeForm({ testId, subject }: { testId: string; subject: string }) {
  const [state, action] = useActionState(recordTestOutcomeAction, idleFormState);

  if (state.ok && state.message) {
    return <p className="text-sm text-muted-foreground">{state.message}</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-sm">How did the {subject} test go?</p>
      <div className="flex flex-wrap gap-2">
        {[
          { value: "WELL", label: "Went well" },
          { value: "MIXED", label: "Mixed" },
          { value: "BADLY", label: "Badly" },
        ].map((option) => (
          <form key={option.value} action={action}>
            <input type="hidden" name="testId" value={testId} />
            <input type="hidden" name="outcome" value={option.value} />
            <SubmitButton size="sm" variant="secondary" pendingLabel="Saving…">
              {option.label}
            </SubmitButton>
          </form>
        ))}
      </div>
      <Message state={state} />
    </div>
  );
}

/** A suggested rating. Never applied automatically — the student decides. */
export function SuggestionForm({
  suggestionId,
  subTopic,
  suggested,
  reason,
}: {
  suggestionId: string;
  subTopic: string;
  suggested: string;
  reason: string;
}) {
  const [state, action] = useActionState(resolveSuggestionAction, idleFormState);

  if (state.ok && state.message) {
    return <p className="text-sm text-muted-foreground">{state.message}</p>;
  }

  return (
    <div className="space-y-2 rounded-lg border border-[var(--border)] p-4">
      <p className="text-sm">
        <strong>{subTopic}</strong> — shall we mark this {suggested.toLowerCase()}?
      </p>
      <p className="text-sm text-muted-foreground">{reason}</p>
      <div className="flex flex-wrap gap-2">
        <form action={action}>
          <input type="hidden" name="suggestionId" value={suggestionId} />
          <input type="hidden" name="accept" value="1" />
          <SubmitButton size="sm" pendingLabel="Updating…">
            Yes, update it
          </SubmitButton>
        </form>
        <form action={action}>
          <input type="hidden" name="suggestionId" value={suggestionId} />
          <input type="hidden" name="accept" value="0" />
          <SubmitButton size="sm" variant="ghost" pendingLabel="Saving…">
            Leave it
          </SubmitButton>
        </form>
      </div>
      <Message state={state} />
    </div>
  );
}

/** The resit hatch (D27). */
export function ResumeSchedulingForm() {
  const [state, action] = useActionState(resumeSchedulingAction, idleFormState);

  return (
    <form action={action} className="space-y-2">
      <SubmitButton size="sm" variant="secondary" pendingLabel="Starting up…">
        Actually, I&rsquo;ve got a resit
      </SubmitButton>
      <Message state={state} />
    </form>
  );
}
