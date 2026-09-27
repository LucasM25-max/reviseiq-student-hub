/**
 * Shared chrome for every widget engine.
 *
 * Widgets all want the same furniture — a label saying this bit is interactive, an
 * instruction, a place for controls, a place for a score — and having each engine invent
 * its own would make four things that look like four different products.
 *
 * The `answers` slot is the progressive-enhancement escape hatch. Everything below is a
 * client component, so with JavaScript off the controls render but do nothing; the
 * disclosure keeps the material reachable anyway. It disappears the moment the student
 * checks their work, because at that point the feedback is better than the answer key.
 */
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function WidgetShell({
  title,
  instruction,
  eyebrow = "Interactive",
  children,
  controls,
  status,
  answers,
}: {
  title: string;
  instruction?: string;
  eyebrow?: string;
  children: ReactNode;
  controls?: ReactNode;
  status?: ReactNode;
  answers?: ReactNode;
}) {
  return (
    <section className="my-6 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-4">
      <p className="text-xs font-semibold tracking-wide text-[var(--muted-foreground)] uppercase">
        {eyebrow}
      </p>
      <h2 className="mt-1 text-base font-semibold">{title}</h2>
      {instruction ? (
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">{instruction}</p>
      ) : null}

      <div className="mt-4">{children}</div>

      {controls ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">{controls}</div>
      ) : null}
      {status ? <div className="mt-3">{status}</div> : null}
      {answers ? <div className="mt-3">{answers}</div> : null}
    </section>
  );
}

/** The score line. A live region, so the result is announced and not only coloured. */
export function WidgetStatus({
  tone,
  children,
}: {
  tone: "success" | "warning" | "neutral";
  children: ReactNode;
}) {
  return (
    <p
      role="status"
      className={cn(
        "rounded-md px-3 py-2 text-sm",
        tone === "success" && "bg-[var(--success-surface)] text-[var(--success)]",
        tone === "warning" && "bg-[var(--warning-surface)] text-[var(--warning)]",
        tone === "neutral" && "bg-[var(--muted)]/60 text-[var(--muted-foreground)]",
      )}
    >
      {children}
    </p>
  );
}

/** A widget's own button. Never `type="submit"` — a widget is not a form. */
export function WidgetButton({
  children,
  onClick,
  variant = "primary",
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  variant?: "primary" | "ghost";
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        "focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" &&
          "bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90",
        variant === "ghost" &&
          "border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)]/60",
      )}
    >
      {children}
    </button>
  );
}

/**
 * The no-JavaScript answer key.
 *
 * Rendered by the server on first paint and dropped once the student has checked their
 * work, so it is there for anyone whose JavaScript never arrives and out of the way for
 * everyone else.
 */
export function WidgetAnswerKey({ children }: { children: ReactNode }) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-[var(--muted-foreground)]">
        Show the answers
      </summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}
