import { Check } from "lucide-react";
import Link from "next/link";

import type { OnboardingStep } from "@/generated/prisma/enums";
import {
  canVisit,
  ONBOARDING_STEPS,
  STEP_META,
  stepIndex,
  type WizardStep,
} from "@/lib/onboarding/steps";
import { cn } from "@/lib/utils";

/**
 * Four numbered steps. Completed ones are links, so going back to change an answer is a
 * click rather than a restart; steps not yet reached are inert.
 */
export function Stepper({
  current,
  furthest,
}: {
  current: WizardStep;
  furthest: OnboardingStep;
}) {
  const currentIndex = stepIndex(current);

  return (
    <nav aria-label="Onboarding progress" className="mb-8">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-3 text-sm">
        {ONBOARDING_STEPS.map((step, index) => {
          const meta = STEP_META[step];
          const isCurrent = step === current;
          const isDone = index < currentIndex && canVisit(step, furthest);
          const reachable = canVisit(step, furthest) && !isCurrent;

          const content = (
            <span
              className={cn(
                "inline-flex items-center gap-2 rounded-md px-2 py-1 transition-colors",
                isCurrent && "bg-secondary font-semibold text-foreground",
                !isCurrent && reachable && "text-muted-foreground hover:text-foreground",
                !isCurrent && !reachable && "text-muted-foreground/60",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "inline-flex size-5 shrink-0 items-center justify-center rounded-full border text-[0.6875rem] font-semibold",
                  isDone && "border-primary bg-primary text-primary-foreground",
                  isCurrent && "border-primary text-primary",
                  !isDone && !isCurrent && "border-border",
                )}
              >
                {isDone ? <Check className="size-3" /> : index + 1}
              </span>
              {meta.title}
            </span>
          );

          return (
            <li key={step} className="flex items-center gap-2">
              {reachable ? (
                <Link href={meta.href} className="rounded-md">
                  {content}
                </Link>
              ) : (
                <span aria-current={isCurrent ? "step" : undefined}>{content}</span>
              )}
              {index < ONBOARDING_STEPS.length - 1 ? (
                <span aria-hidden="true" className="h-px w-4 bg-border sm:w-6" />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
