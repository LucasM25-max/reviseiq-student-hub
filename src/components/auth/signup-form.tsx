"use client";

import { Check, X } from "lucide-react";
import { useActionState, useId, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Field, FieldError, FieldHint, Input, Label } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { signUpAction } from "@/lib/auth/actions";
import { checkPasswordStrength, PASSWORD_MIN_LENGTH } from "@/lib/auth/password-policy";
import { MINIMUM_AGE } from "@/lib/auth/age";
import { idleFormState } from "@/lib/forms";
import { cn } from "@/lib/utils";

/** The oldest date the picker will accept — someone turning 13 today. */
function maxDateOfBirth(): string {
  const now = new Date();
  const cutoff = new Date(
    Date.UTC(now.getUTCFullYear() - MINIMUM_AGE, now.getUTCMonth(), now.getUTCDate()),
  );
  return cutoff.toISOString().slice(0, 10);
}

export function SignupForm() {
  const [state, action] = useActionState(signUpAction, idleFormState);
  const [password, setPassword] = useState("");
  const hintId = useId();

  // Exactly the rules the server will apply, so the form never says "looks good" and
  // then gets rejected.
  const problem = password.length > 0 ? checkPasswordStrength(password) : null;
  const looksGood = password.length > 0 && problem === null;

  return (
    <form action={action} className="space-y-4" noValidate>
      {state.message ? <Alert variant="error">{state.message}</Alert> : null}

      <Field>
        <Label htmlFor="name">First name</Label>
        <Input
          id="name"
          name="name"
          autoComplete="given-name"
          placeholder="Optional"
          maxLength={80}
          invalid={Boolean(state.fieldErrors?.name)}
        />
        <FieldError id="name-error">{state.fieldErrors?.name}</FieldError>
      </Field>

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

      <Field>
        <Label htmlFor="password">Password</Label>
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
          {password.length === 0 ? (
            <FieldHint>
              At least {PASSWORD_MIN_LENGTH} characters. Longer beats complicated.
            </FieldHint>
          ) : (
            <p
              className={cn(
                "flex items-start gap-1.5 text-xs",
                looksGood ? "text-success" : "text-muted-foreground",
              )}
            >
              {looksGood ? (
                <Check className="mt-px size-3.5 shrink-0" aria-hidden="true" />
              ) : (
                <X className="mt-px size-3.5 shrink-0" aria-hidden="true" />
              )}
              <span>{looksGood ? "That'll do nicely." : problem}</span>
            </p>
          )}
        </div>
        <FieldError id="password-error">{state.fieldErrors?.password}</FieldError>
      </Field>

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
          aria-describedby="dob-hint"
        />
        <FieldHint id="dob-hint">
          We ask because ReviseIQ is for students aged {MINIMUM_AGE} and over. It isn&apos;t
          shown anywhere.
        </FieldHint>
        <FieldError id="dob-error">{state.fieldErrors?.dateOfBirth}</FieldError>
      </Field>

      <SubmitButton full size="lg" pendingLabel="Creating your account…">
        Create account
      </SubmitButton>
    </form>
  );
}
