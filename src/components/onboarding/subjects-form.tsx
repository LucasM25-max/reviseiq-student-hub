"use client";

import { Check } from "lucide-react";
import { useActionState, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { idleFormState } from "@/lib/forms";
import { saveSubjectsAction } from "@/lib/onboarding/actions";
import { subjectClasses } from "@/lib/rag";
import { cn } from "@/lib/utils";

export type SubjectOption = {
  id: string;
  name: string;
  accent: string;
  qualCode: string;
  examBoard: string;
  topicCount: number;
};

export function SubjectsForm({
  subjects,
  initialSelected,
  returnTo,
  submitLabel = "Continue",
}: {
  subjects: SubjectOption[];
  initialSelected: string[];
  /** Where to go after saving. Omitted during onboarding, set by Settings. */
  returnTo?: string;
  submitLabel?: string;
}) {
  const [state, action] = useActionState(saveSubjectsAction, idleFormState);

  /**
   * The checkboxes are deliberately uncontrolled.
   *
   * What gets submitted is whatever the browser has checked — never a mirror of React
   * state. If hydration is slow, partial or broken, the worst case is that the styling
   * stops updating; the form still submits exactly what the student ticked. A
   * `checked` prop here would let React quietly force boxes back off and send an empty
   * selection, which looks to the student like "I chose three subjects and it says I
   * chose none".
   */
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelected));

  function toggle(id: string, isChecked: boolean) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (isChecked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  return (
    <form action={action} className="space-y-6">
      {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
      {state.message ? <Alert variant="error">{state.message}</Alert> : null}

      <fieldset>
        <legend className="sr-only">Subjects</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {subjects.map((subject) => {
            const isSelected = selected.has(subject.id);
            const accent = subjectClasses(subject.accent);

            return (
              <label
                key={subject.id}
                className={cn(
                  "relative flex cursor-pointer flex-col gap-1 rounded-xl border-2 bg-card p-4 transition-colors",
                  isSelected
                    ? cn(accent.border, accent.surface)
                    : "border-border hover:border-muted-foreground/30",
                )}
              >
                <input
                  type="checkbox"
                  name="subjectId"
                  value={subject.id}
                  defaultChecked={initialSelected.includes(subject.id)}
                  onChange={(event) => toggle(subject.id, event.currentTarget.checked)}
                  className="sr-only"
                />

                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute top-3 right-3 inline-flex size-5 items-center justify-center rounded-full border transition-colors",
                    isSelected
                      ? cn("border-transparent text-card", accent.text)
                      : "border-border",
                  )}
                >
                  {isSelected ? (
                    <Check className={cn("size-5", accent.text)} strokeWidth={3} />
                  ) : null}
                </span>

                <span className={cn("text-base font-semibold", isSelected && accent.text)}>
                  {subject.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {subject.examBoard} {subject.qualCode}
                </span>
                <span className="mt-1 text-xs text-muted-foreground">
                  {subject.topicCount} topics
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {selected.size === 0
            ? "Nothing selected yet"
            : `${selected.size} subject${selected.size === 1 ? "" : "s"} selected`}
        </p>
        {/* Never gated on client state: if the counter is wrong, the student must
            still be able to submit and let the server have the final say. */}
        <SubmitButton size="lg" pendingLabel="Saving…">
          {submitLabel}
        </SubmitButton>
      </div>
    </form>
  );
}
