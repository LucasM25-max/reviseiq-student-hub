import Link from "next/link";

/**
 * Development affordance: with no email provider configured, the link that would have
 * been emailed is shown in the page instead. The server only ever populates this in
 * non-production builds without a RESEND_API_KEY (see mailer.ts), so it cannot leak.
 */
export function DevLink({ href, label }: { href?: string; label: string }) {
  if (!href) return null;

  return (
    <div className="rounded-lg border border-dashed border-warning-border bg-warning-surface p-3 text-xs">
      <p className="font-medium text-foreground">Development mode — no email provider</p>
      <p className="mt-0.5 text-muted-foreground">
        The email was written to the console and <code className="font-mono">./.mail</code>{" "}
        instead of being sent.
      </p>
      <Link
        href={href}
        className="mt-2 inline-block rounded font-medium text-primary underline underline-offset-2"
      >
        {label} →
      </Link>
    </div>
  );
}
