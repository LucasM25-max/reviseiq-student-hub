import Link from "next/link";
import { MailWarning } from "lucide-react";

/**
 * Shown until the email is confirmed. Deliberately not a blocking modal: a student can
 * use the whole app unverified. What verification gates is anything that would send
 * mail to an address nobody has proved they own.
 */
export function VerifyBanner({ email }: { email: string }) {
  return (
    <div className="border-b border-warning-border bg-warning-surface">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5 text-sm sm:px-8">
        <MailWarning className="size-4 shrink-0 text-warning" aria-hidden="true" />
        <p className="text-foreground">
          Confirm your email{" "}
          <span className="text-muted-foreground">
            — we sent a link to {email}. Reminders and password resets need it.
          </span>
        </p>
        <Link
          href="/verify-email"
          className="rounded font-medium text-primary underline underline-offset-2"
        >
          Sort it out
        </Link>
      </div>
    </div>
  );
}
