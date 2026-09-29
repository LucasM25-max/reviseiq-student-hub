"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/ui/submit-button";
import { idleFormState } from "@/lib/forms";
import { submitBlurtAction } from "@/lib/flashcards/actions";

/**
 * A thin wrapper around the blurt action.
 *
 * The prompt, the coverage bar and the idea list are all server-rendered; this adds
 * the textarea, a submit button that disables itself, and somewhere for a failure to
 * be shown. The action is passed straight through — no closure — so the form still
 * works before JavaScript arrives.
 */
export function BlurtForm({ promptId, startedAt }: { promptId: string; startedAt: string }) {
  const [state, action] = useActionState(submitBlurtAction, idleFormState);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="promptId" value={promptId} />
      <input type="hidden" name="startedAt" value={startedAt} />

      <label htmlFor="blurt-text" className="sr-only">
        Everything you can remember
      </label>
      <textarea
        id="blurt-text"
        name="text"
        rows={10}
        maxLength={8000}
        className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
        placeholder="Start anywhere. Bullet points are fine."
      />

      {state.message ? (
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
      ) : null}

      <SubmitButton pendingLabel="Checking…">See what came back</SubmitButton>
    </form>
  );
}
