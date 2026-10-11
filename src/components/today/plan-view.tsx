"use client";

import { useActionState } from "react";
import Link from "next/link";

import { SubmitButton } from "@/components/ui/submit-button";
import { idleFormState } from "@/lib/forms";
import { completeTaskAction, quickSessionAction, swapTaskAction } from "@/lib/today/actions";

/**
 * Thin client wrappers for Today.
 *
 * The plan itself is server-rendered; these add the forms. Each action is passed
 * straight through, so the whole page still works before JavaScript arrives.
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

export function TaskActions({
  taskId,
  href,
  done,
  startedAt,
}: {
  taskId: string;
  href: string;
  done: boolean;
  startedAt: string;
}) {
  const [completeState, complete] = useActionState(completeTaskAction, idleFormState);
  const [swapState, swap] = useActionState(swapTaskAction, idleFormState);

  if (done) {
    return (
      <p className="text-sm text-muted-foreground" aria-label="Completed">
        ✓ Done
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={href}
        className="rounded-md bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-[var(--primary-foreground)]"
      >
        Start
      </Link>

      <form action={complete}>
        <input type="hidden" name="taskId" value={taskId} />
        <input type="hidden" name="startedAt" value={startedAt} />
        <SubmitButton size="sm" variant="secondary" pendingLabel="Saving…">
          Mark done
        </SubmitButton>
      </form>

      <form action={swap}>
        <input type="hidden" name="taskId" value={taskId} />
        <SubmitButton size="sm" variant="ghost" pendingLabel="Swapping…">
          Not today
        </SubmitButton>
      </form>

      <Message state={completeState.ok ? idleFormState : completeState} />
      <Message state={swapState.ok ? idleFormState : swapState} />
    </div>
  );
}

/** "I've only got N minutes" (D10). */
export function QuickSessionForm({ current }: { current: number }) {
  const [state, action] = useActionState(quickSessionAction, idleFormState);

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <div>
        <label htmlFor="quick-minutes" className="block text-sm font-medium">
          Only got a bit of time?
        </label>
        <input
          id="quick-minutes"
          name="minutes"
          type="number"
          min={5}
          max={600}
          step={5}
          defaultValue={current}
          className="mt-1 w-24 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
        />
      </div>
      <SubmitButton size="sm" variant="secondary" pendingLabel="Re-planning…">
        Re-plan
      </SubmitButton>
      <Message state={state} />
    </form>
  );
}
