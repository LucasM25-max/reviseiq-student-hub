import { cn } from "@/lib/utils";

/**
 * Hand-built mark (D18 — no icon libraries for brand assets).
 * A revision "tick inside a bracket": the bracket is the syllabus, the tick is the bit
 * you've got. currentColor throughout so it inherits whatever it's placed on.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={cn("size-6", className)}>
      <path
        d="M8.5 3.25H6.75A2.25 2.25 0 0 0 4.5 5.5v13a2.25 2.25 0 0 0 2.25 2.25H8.5M15.5 3.25h1.75a2.25 2.25 0 0 1 2.25 2.25v13a2.25 2.25 0 0 1-2.25 2.25H15.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m8.75 12.25 2.4 2.5 4.1-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className="size-6 text-primary" />
      <span className="text-[1.0625rem] font-semibold tracking-tight text-foreground">
        Revise<span className="text-primary">IQ</span>
      </span>
    </span>
  );
}
