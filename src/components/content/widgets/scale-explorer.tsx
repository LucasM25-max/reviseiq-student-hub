"use client";

import { useState } from "react";
import type { ReactNode } from "react";

import type { ScaleExplorerConfig } from "@/lib/widgets/schemas";
import { cn } from "@/lib/utils";

import { WidgetButton, WidgetShell } from "./widget-shell";

/**
 * Step inwards through a containment ladder: cell → nucleus → chromosome → gene.
 *
 * This is the one engine of the four that does not mark anything, and that is
 * deliberate. The difficulty with scale is not recalling a number, it is holding the
 * nesting and the magnitudes in mind at the same time — so the widget shows the whole
 * ladder at once with the current rung picked out, rather than hiding the context to
 * make room for a question.
 *
 * The reference diagram, when a config supplies one, is a logarithmic size strip. Its
 * marks do not have to line up with the levels: a containment ladder and a size axis are
 * two views of the same fact, and seeing both is the point.
 */
export function ScaleExplorerWidget({
  config,
  children,
}: {
  config: ScaleExplorerConfig;
  children?: ReactNode;
}) {
  const [level, setLevel] = useState(0);
  const last = config.levels.length - 1;
  const current = config.levels[level];
  const inside = level < last ? config.levels[level + 1] : undefined;
  const outside = level > 0 ? config.levels[level - 1] : undefined;

  return (
    <WidgetShell
      title="Zoom through the scales"
      instruction={config.instruction}
      controls={
        <>
          <WidgetButton
            variant="ghost"
            onClick={() => setLevel((value) => Math.max(value - 1, 0))}
            disabled={level === 0}
          >
            ← Zoom out
          </WidgetButton>
          <WidgetButton
            onClick={() => setLevel((value) => Math.min(value + 1, last))}
            disabled={level === last}
          >
            Zoom in →
          </WidgetButton>
        </>
      }
    >
      <ol className="space-y-1">
        {config.levels.map((entry, index) => {
          const isCurrent = index === level;
          return (
            <li key={entry.label}>
              <button
                type="button"
                onClick={() => setLevel(index)}
                aria-current={isCurrent ? "step" : undefined}
                className={cn(
                  "flex w-full items-baseline gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none",
                  isCurrent
                    ? "border-[var(--primary)] bg-[var(--secondary)]"
                    : "border-[var(--border)] hover:bg-[var(--muted)]/50",
                )}
                // Each level is one step further in, so indenting makes the containment
                // visible without a single word of explanation.
                style={{ marginInlineStart: `${index * 0.85}rem` }}
              >
                <span className="font-medium">{entry.label}</span>
                <span className="text-[var(--muted-foreground)]">{entry.size}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="mt-3 rounded-md bg-[var(--muted)]/50 px-3 py-2 text-sm" role="status">
        <p>
          <span className="font-medium">{current.label}</span>{" "}
          <span className="text-[var(--muted-foreground)]">— {current.size}</span>
        </p>
        {current.note ? (
          <p className="mt-1 text-[var(--muted-foreground)]">{current.note}</p>
        ) : null}
        <p className="mt-1 text-[var(--muted-foreground)]">
          {outside ? `Sits inside the ${outside.label.toLowerCase()}.` : "The outermost level."}
          {inside
            ? ` Contains the ${inside.label.toLowerCase()}.`
            : " Nothing further in here."}
        </p>
      </div>

      {children ? <div className="mt-4">{children}</div> : null}
    </WidgetShell>
  );
}
