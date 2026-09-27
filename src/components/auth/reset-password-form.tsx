"use client";

import { useActionState, useId, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Field, FieldError, FieldHint, Input, Label } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { resetPasswordAction } from "@/lib/auth/actions";
import { checkPasswordStrength, PASSWORD_MIN_LENGTH } from "@/lib/auth/password-policy";
import { idleFormState } from "@/lib/forms";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPasswordAction, idleFormState);
  const [password, setPassword] = useState("");
  const hintId = useId();

  const problem = password.length > 0 ? checkPasswordStrength(password) : null;

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="token" value={token} />

      {state.message ? <Alert variant="error">{state.message}</Alert> : null}

      <Field>
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          invalid={Boolean(state.fieldErrors?.password)}
          aria-describedby={hintId}
        />
        <div id={hintId} aria-live="polite">
          <FieldHint>
            {problem ?? `At least ${PASSWORD_MIN_LENGTH} characters. Longer beats complicated.`}
          </FieldHint>
        </div>
        <FieldError id="password-error">{state.fieldErrors?.password}</FieldError>
      </Field>

      <Field>
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          invalid={Boolean(state.fieldErrors?.confirmPassword)}
          aria-describedby={state.fieldErrors?.confirmPassword ? "confirm-error" : undefined}
        />
        <FieldError id="confirm-error">{state.fieldErrors?.confirmPassword}</FieldError>
      </Field>

      <SubmitButton full size="lg" pendingLabel="Saving…">
        Save new password
      </SubmitButton>
    </form>
  );
}
