"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { Field, FieldError, Input, Label } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { requestPasswordResetAction } from "@/lib/auth/actions";
import { idleFormState } from "@/lib/forms";

import { DevLink } from "./dev-link";

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordResetAction, idleFormState);

  if (state.ok) {
    return (
      <div className="space-y-4">
        <Alert variant="success" title="Check your inbox">
          {state.message}
        </Alert>
        <DevLink href={state.data?.devLink} label="Open the reset link" />
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4" noValidate>
      {state.message ? <Alert variant="error">{state.message}</Alert> : null}

      <Field>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          placeholder="you@school.uk"
          invalid={Boolean(state.fieldErrors?.email)}
          aria-describedby={state.fieldErrors?.email ? "email-error" : undefined}
        />
        <FieldError id="email-error">{state.fieldErrors?.email}</FieldError>
      </Field>

      <SubmitButton full size="lg" pendingLabel="Sending…">
        Send reset link
      </SubmitButton>
    </form>
  );
}
