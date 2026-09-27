"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { Field, FieldError, Input, Label } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { setDateOfBirthAction } from "@/lib/auth/actions";
import { MINIMUM_AGE } from "@/lib/auth/age";
import { idleFormState } from "@/lib/forms";

function maxDateOfBirth(): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear() - MINIMUM_AGE, now.getUTCMonth(), now.getUTCDate()),
  )
    .toISOString()
    .slice(0, 10);
}

export function DateOfBirthForm() {
  const [state, action] = useActionState(setDateOfBirthAction, idleFormState);

  return (
    <form action={action} className="space-y-4" noValidate>
      {state.message ? <Alert variant="error">{state.message}</Alert> : null}

      <Field>
        <Label htmlFor="dateOfBirth">Date of birth</Label>
        <Input
          id="dateOfBirth"
          name="dateOfBirth"
          type="date"
          autoComplete="bday"
          required
          max={maxDateOfBirth()}
          invalid={Boolean(state.fieldErrors?.dateOfBirth)}
          aria-describedby={state.fieldErrors?.dateOfBirth ? "dob-error" : undefined}
        />
        <FieldError id="dob-error">{state.fieldErrors?.dateOfBirth}</FieldError>
      </Field>

      <SubmitButton full size="lg" pendingLabel="Saving…">
        Continue
      </SubmitButton>
    </form>
  );
}
