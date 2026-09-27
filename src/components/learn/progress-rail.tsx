/**
 * The thin progress rail at the top of a lesson (doc 01 §3).
 *
 * Deliberately a server component with no state: it renders what the page already knows.
 * The segments are steps, not blocks — a student wants to know how much lesson is left,
 * and "block 14 of 21" is not that, because blocks are not the same size.
 *
 * The rail is `aria-hidden` and paired with a sentence, rather than being given a
 * progressbar role. A progressbar announces a percentage, which is the least useful way
 * to say "two parts to go".
 */
import { cn } from "@/lib/utils";

export function ProgressRail({
  total,
  current,
  completed,
}: {
  total: number;
  /** 0-based index of the step being shown. */
  current: number;
  completed: boolean;
}) {
  const stepsDone = completed ? total : current;

  return (
    <div className="space-y-1.5">
      <div aria-hidden="true" className="flex gap-1">
        {Array.from({ length: total }, (_, index) => (
          <span
            key={index}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              index < stepsDone && "bg-[var(--primary)]",
              index === stepsDone && !completed && "bg-[var(--primary)]/40",
              index > stepsDone && "bg-[var(--border)]",
            )}
          />
        ))}
      </div>
      <p className="text-xs text-[var(--muted-foreground)]">
        {completed
          ? `Finished · ${total} part${total === 1 ? "" : "s"}`
          : `Part ${Math.min(current + 1, total)} of ${total}`}
      </p>
    </div>
  );
}
