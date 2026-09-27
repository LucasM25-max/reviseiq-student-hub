"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { resendVerificationAction } from "@/lib/auth/actions";
import { idleFormState } from "@/lib/forms";

import { DevLink } from "./dev-link";

export function ResendVerification({
  label = "Send it again",
  variant = "outline",
}: {
  label?: string;
  variant?: "outline" | "ghost" | "link";
}) {
  const [state, action] = useActionState(resendVerificationAction, idleFormState);

  return (
    <div className="space-y-3">
      <form action={action}>
        <SubmitButton variant={variant} size="sm" pendingLabel="Sending…">
          {label}
        </SubmitButton>
      </form>

      {state.message ? (
        <Alert variant={state.ok ? "success" : "error"}>{state.message}</Alert>
      ) : null}

      <DevLink href={state.data?.devLink} label="Open the confirmation link" />
    </div>
  );
}
