"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/ui/submit-button";
import { advanceLessonAction } from "@/lib/learn/actions";
import { idleFormState } from "@/lib/forms";

/**
 * The button that reveals the next step, or finishes the lesson.
 *
 * A form rather than a link, because pressing it writes: it saves how long the step took
 * and how far the student has got. Handing `advanceLessonAction` straight to `action`
 * keeps it working with JavaScript off; `useActionState` is only here so that a failure
 * to save has somewhere to be shown instead of vanishing.
 */
export function StepControls({
  lessonId,
  path,
  toStage,
  stepStartedAt,
  finish = false,
  label,
  hint,
}: {
  lessonId: string;
  path: string;
  toStage: number;
  stepStartedAt: string;
  finish?: boolean;
  label: string;
  hint?: string;
}) {
  const [state, action] = useActionState(advanceLessonAction, idleFormState);

  return (
    <form action={action} className="border-t border-[var(--border)] pt-5">
      <input type="hidden" name="lessonId" value={lessonId} />
      <input type="hidden" name="path" value={path} />
      <input type="hidden" name="toStage" value={toStage} />
      <input type="hidden" name="stepStartedAt" value={stepStartedAt} />
      {finish ? <input type="hidden" name="finish" value="1" /> : null}

      {state.message && !state.ok ? (
        <p className="mb-3 text-sm text-[var(--destructive)]">{state.message}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton size="lg" pendingLabel="Saving…">
          {label}
        </SubmitButton>
        {hint ? <p className="text-sm text-[var(--muted-foreground)]">{hint}</p> : null}
      </div>
    </form>
  );
}
