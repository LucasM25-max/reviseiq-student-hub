"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { Field, FieldError, Input, Label } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { signInAction } from "@/lib/auth/actions";
import { idleFormState } from "@/lib/forms";

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(signInAction, idleFormState);

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />

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

      <Field>
        <div className="flex items-baseline justify-between gap-3">
          <Label htmlFor="password">Password</Label>
          <Link
            href="/forgot-password"
            className="rounded text-xs font-medium text-primary hover:underline"
          >
            Forgotten it?
          </Link>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          invalid={Boolean(state.fieldErrors?.password)}
          aria-describedby={state.fieldErrors?.password ? "password-error" : undefined}
        />
        <FieldError id="password-error">{state.fieldErrors?.password}</FieldError>
      </Field>

      <SubmitButton full size="lg" pendingLabel="Signing in…">
        Log in
      </SubmitButton>
    </form>
  );
}
