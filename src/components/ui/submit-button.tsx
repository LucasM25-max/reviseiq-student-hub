"use client";

import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";

import { Button, type ButtonProps } from "@/components/ui/button";

export type SubmitButtonProps = Omit<ButtonProps, "type"> & {
  /** Shown while the action is in flight; falls back to the normal label. */
  pendingLabel?: string;
};

/**
 * A submit button that disables itself and announces progress while its form's action
 * is running. Prevents the double-submit that would otherwise create two accounts or
 * send two verification emails.
 */
export function SubmitButton({
  children,
  pendingLabel,
  disabled,
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button {...props} type="submit" disabled={pending || disabled} aria-busy={pending}>
      {pending ? (
        <>
          <Loader2 className="animate-spin" aria-hidden="true" />
          {pendingLabel ?? children}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
