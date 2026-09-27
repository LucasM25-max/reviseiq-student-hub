"use client";

import type { RagValue } from "@/generated/prisma/enums";
import { RAG_CLASSES, RAG_META, RAG_ORDER } from "@/lib/rag";
import { cn } from "@/lib/utils";

/**
 * A four-way RAG control rendered as a radio group.
 *
 * Colour never carries the meaning on its own: each option has a visible text label, and
 * the selected one is marked with a border and a filled dot as well as a tint.
 */
export function RagSelector({
  name,
  value,
  onChange,
  label,
  compact = false,
}: {
  name: string;
  value: RagValue | null;
  onChange: (value: RagValue) => void;
  /** Accessible name for the group — usually the topic title. */
  label: string;
  compact?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={`Rating for ${label}`}
      className="flex flex-wrap gap-1.5"
    >
      {RAG_ORDER.map((option) => {
        const meta = RAG_META[option];
        const selected = value === option;
        const classes = RAG_CLASSES[option];

        return (
          <label
            key={option}
            className={cn(
              "inline-flex cursor-pointer items-center gap-1.5 rounded-md border text-xs font-medium transition-colors",
              compact ? "px-2 py-1" : "px-2.5 py-1.5",
              selected ? classes.selected : classes.idle,
            )}
            title={meta.consequence}
          >
            <input
              type="radio"
              name={name}
              value={option}
              checked={selected}
              onChange={() => onChange(option)}
              className="sr-only"
            />
            <span
              aria-hidden="true"
              className={cn("size-2 rounded-full", selected ? classes.dot : "bg-border")}
            />
            {meta.label}
          </label>
        );
      })}
    </div>
  );
}

export function RagBadge({ value, className }: { value: RagValue; className?: string }) {
  const meta = RAG_META[value];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        RAG_CLASSES[value].badge,
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn("size-1.5 rounded-full", RAG_CLASSES[value].dot)}
      />
      {meta.label}
    </span>
  );
}
