import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import type { OnboardingStep } from "@/generated/prisma/enums";

/**
 * Fine-grained access control for server components and server actions.
 *
 * Middleware can only tell whether a session cookie exists. Everything that depends on
 * database state — is the email verified, has onboarding finished, does this record
 * belong to this student — is decided here, where Prisma is available.
 *
 * Each helper is wrapped in React's `cache` so a page that calls it from the layout and
 * from three components still issues one query per request.
 */

export const getSession = cache(async () => auth());

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof loadCurrentUser>>>;

const loadCurrentUser = cache(async () => {
  const session = await getSession();
  const id = session?.user?.id;
  if (!id) return null;

  const user = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      role: true,
      emailVerified: true,
      dateOfBirth: true,
      passwordHash: true,
      profile: true,
    },
  });

  if (!user) return null;

  return {
    ...user,
    hasPassword: user.passwordHash !== null,
    isEmailVerified: user.emailVerified !== null,
    // Google sign-ups never supplied one; they are asked before onboarding starts.
    needsDateOfBirth: user.dateOfBirth === null,
    onboardingStep: user.profile?.onboardingStep ?? "SUBJECTS",
    isOnboarded: user.profile?.onboardingCompletedAt != null,
  };
});

/** Returns the signed-in student, or null. Never redirects. */
export async function getCurrentUser() {
  return loadCurrentUser();
}

/**
 * Requires a signed-in student. Redirects to the login page, preserving the intended
 * destination so Today's deep links survive an expired session.
 */
export async function requireUser(next?: string): Promise<CurrentUser> {
  const user = await loadCurrentUser();
  if (user) return user;

  const target = next ? `/login?next=${encodeURIComponent(next)}` : "/login";
  redirect(target);
}

const STEP_ROUTES: Record<OnboardingStep, string> = {
  SUBJECTS: "/onboarding/subjects",
  SETUP: "/onboarding/setup",
  RAG: "/onboarding/rag",
  AVAILABILITY: "/onboarding/availability",
  DONE: "/welcome",
};

export function routeForStep(step: OnboardingStep): string {
  return STEP_ROUTES[step];
}

/**
 * Requires a student who has finished onboarding. Anyone mid-flow is sent back to the
 * step they stopped at, so the flow is resumable from any entry point — including a
 * deep link received by email days later.
 */
export async function requireOnboardedUser(next?: string): Promise<CurrentUser> {
  const user = await requireUser(next);

  if (user.needsDateOfBirth) redirect("/onboarding/date-of-birth");
  if (!user.isOnboarded) redirect(routeForStep(user.onboardingStep));

  return user;
}

/**
 * Requires a student who is *in* onboarding. Anyone already finished is sent to Today,
 * so the browser back button can't drop them into a half-filled wizard.
 */
export async function requireOnboardingUser(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.isOnboarded) redirect("/today");
  return user;
}
