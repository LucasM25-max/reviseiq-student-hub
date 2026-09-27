"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { Field, FieldHint, Input, Label } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { idleFormState } from "@/lib/forms";
import { updateAccountAction, updatePreferencesAction } from "@/lib/settings/actions";

export function AccountForm({ name }: { name: string }) {
  const [state, action] = useActionState(updateAccountAction, idleFormState);

  return (
    <form action={action} className="space-y-4">
      {state.message ? (
        <Alert variant={state.ok ? "success" : "error"}>{state.message}</Alert>
      ) : null}

      <Field>
        <Label htmlFor="name">Your name</Label>
        <Input
          id="name"
          name="name"
          defaultValue={name}
          maxLength={80}
          autoComplete="given-name"
        />
        <FieldHint>Only used to say hello on Today.</FieldHint>
      </Field>

      <SubmitButton variant="outline" pendingLabel="Saving…">
        Save
      </SubmitButton>
    </form>
  );
}

export function PreferencesForm({ reduceMotion }: { reduceMotion: boolean }) {
  const [state, action] = useActionState(updatePreferencesAction, idleFormState);

  return (
    <form action={action} className="space-y-4">
      {state.message ? (
        <Alert variant={state.ok ? "success" : "error"}>{state.message}</Alert>
      ) : null}

      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          name="reduceMotion"
          defaultChecked={reduceMotion}
          className="mt-0.5 size-4 rounded border-input accent-primary"
        />
        <span>
          <span className="block text-sm font-medium text-foreground">Reduce motion</span>
          <span className="block text-xs text-muted-foreground">
            Turns off transitions and animation. Your device setting is already respected — this
            forces it on regardless.
          </span>
        </span>
      </label>

      <SubmitButton variant="outline" pendingLabel="Saving…">
        Save
      </SubmitButton>
    </form>
  );
}
