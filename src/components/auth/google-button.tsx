import { signInWithGoogleAction } from "@/lib/auth/actions";
import { isGoogleEnabled } from "@/lib/env";
import { SubmitButton } from "@/components/ui/submit-button";

/** Google's mark, inlined so the button doesn't depend on a remote asset. */
function GoogleGlyph() {
  return (
    <svg viewBox="0 0 18 18" className="size-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

export function GoogleButton({ next, label }: { next?: string; label: string }) {
  if (!isGoogleEnabled) {
    // Rendering a dead button would be worse than explaining why it isn't there.
    return (
      <div className="rounded-md border border-dashed border-border bg-muted/50 px-3 py-2.5 text-center text-xs text-muted-foreground">
        Google sign-in isn&apos;t configured on this deployment. Use your email and password.
      </div>
    );
  }

  return (
    <form action={signInWithGoogleAction}>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <SubmitButton variant="outline" full pendingLabel="Redirecting…">
        <GoogleGlyph />
        {label}
      </SubmitButton>
    </form>
  );
}

export function AuthDivider() {
  return (
    <div className="flex items-center gap-3" aria-hidden="true">
      <span className="h-px flex-1 bg-border" />
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        or
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
