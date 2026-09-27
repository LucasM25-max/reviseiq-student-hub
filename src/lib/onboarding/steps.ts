import type { OnboardingStep } from "@/generated/prisma/enums";

/**
 * Onboarding is a linear, resumable wizard. The student's furthest step is stored on
 * their profile, so closing the tab and coming back tomorrow — or following an emailed
 * link from a different device — lands them exactly where they stopped.
 */

export const ONBOARDING_STEPS = ["SUBJECTS", "SETUP", "RAG", "AVAILABILITY"] as const;

export type WizardStep = (typeof ONBOARDING_STEPS)[number];

export const STEP_META: Record<WizardStep, { title: string; href: string; blurb: string }> = {
  SUBJECTS: {
    title: "Subjects",
    href: "/onboarding/subjects",
    blurb: "Which sciences are you taking?",
  },
  SETUP: {
    title: "Exams",
    href: "/onboarding/setup",
    blurb: "Tier and when you sit them.",
  },
  RAG: {
    title: "What you know",
    href: "/onboarding/rag",
    blurb: "Rate each topic honestly.",
  },
  AVAILABILITY: {
    title: "Your week",
    href: "/onboarding/availability",
    blurb: "When can you revise?",
  },
};

const ORDER: Record<OnboardingStep, number> = {
  SUBJECTS: 0,
  SETUP: 1,
  RAG: 2,
  AVAILABILITY: 3,
  DONE: 4,
};

export function stepIndex(step: OnboardingStep): number {
  return ORDER[step];
}

/** True when `target` is somewhere the student has already reached (or is at now). */
export function canVisit(target: WizardStep, furthest: OnboardingStep): boolean {
  return ORDER[target] <= ORDER[furthest];
}

/** The step that follows `step`, or DONE at the end. */
export function nextStep(step: WizardStep): OnboardingStep {
  const index = ONBOARDING_STEPS.indexOf(step);
  return ONBOARDING_STEPS[index + 1] ?? "DONE";
}

/**
 * Advancing never rewinds: a student editing an earlier answer keeps the progress they
 * already made rather than being walked through the whole wizard again.
 */
export function furthestOf(current: OnboardingStep, candidate: OnboardingStep): OnboardingStep {
  return ORDER[candidate] > ORDER[current] ? candidate : current;
}
