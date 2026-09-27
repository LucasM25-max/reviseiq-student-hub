"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import type {
  RagValue,
  ReminderChannel,
  TierChoice,
  YearGroup,
} from "@/generated/prisma/enums";
import { signOut } from "@/lib/auth/auth";
import { getCurrentUser } from "@/lib/auth/session";
import { estimatedExamDates } from "@/lib/curriculum/exam-dates";
import { prisma } from "@/lib/db/prisma";
import { formError, text, textList, type FormState } from "@/lib/forms";
import { furthestOf } from "@/lib/onboarding/steps";
import { safeRedirectPath } from "@/lib/url";

/**
 * Onboarding writes.
 *
 * Every step is idempotent and re-runnable: a student who goes back and changes an
 * answer gets their previous choice replaced, not duplicated, and never loses progress
 * they had already made further along.
 *
 * Each action honours an optional `returnTo` field, which is what lets Settings reuse
 * the onboarding forms verbatim instead of maintaining a second copy of each one.
 */

/**
 * A session that expires mid-onboarding should not strand the student behind a message
 * they can do nothing with. Send them to log in, then straight back to the step they
 * were on with their answers still on screen.
 *
 * The token is discarded on the way out. Sessions are stateless JWTs, so one can keep
 * decoding long after the account it names has gone — deleted, or lost with a rebuilt
 * database. Every layer that only reads the cookie then insists the student is signed
 * in while every layer that checks the database disagrees, and they bounce between the
 * two with nothing they can do about it. Clearing it makes the next login a clean one.
 *
 * A server action is one of the few places this is possible at all: server components
 * cannot write cookies, and the proxy has no database to know it should.
 */
async function signInAgain(step: string): Promise<never> {
  try {
    await signOut({ redirect: false });
  } catch (error) {
    // Best effort. Never let tidying up stop the student reaching the login page.
    console.error("[onboarding] could not clear a stale session", error);
  }

  redirect(`/login?next=${encodeURIComponent(step)}`);
}

/**
 * Turns an unexpected database failure into something the student can act on.
 *
 * Without this an infrastructure hiccup surfaces as an opaque "an error occurred" with
 * no indication of whether their work was saved. The underlying error is still logged
 * for us; the student gets a sentence and a way forward.
 */
function saveFailed(step: string, error: unknown): FormState {
  console.error(`[onboarding] ${step} failed to save`, error);
  return formError("We couldn't save that just now. Check your connection and try again.");
}

// ---------------------------------------------------------------------------
// Step 1 — subjects
// ---------------------------------------------------------------------------

export async function saveSubjectsAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return signInAgain("/onboarding/subjects");

  // A browser can legitimately submit the same checkbox twice (a duplicated node after
  // a hydration recovery, an autofill extension). Deduplicate rather than reading it as
  // "you picked a subject that doesn't exist".
  const chosen = [...new Set(textList(formData, "subjectId"))];

  if (chosen.length === 0) {
    return formError("Pick at least one subject — you can add the others later.");
  }

  const subjects = await prisma.subject.findMany({
    where: { id: { in: chosen } },
    select: { id: true },
  });

  if (subjects.length !== chosen.length) {
    const missing = chosen.filter((id) => !subjects.some((subject) => subject.id === id));
    return formError(
      `We couldn't find ${missing.length === 1 ? "one of the subjects" : "some of the subjects"} you picked. Reload the page and try again.`,
    );
  }

  try {
    await prisma.$transaction([
      // Deselecting is a soft deactivation: ratings, attempts and history survive in
      // case the student changes their mind or picks the subject back up next term.
      prisma.subjectEnrolment.updateMany({
        where: { userId: user.id, subjectId: { notIn: chosen } },
        data: { active: false },
      }),
      ...subjects.map((subject) =>
        prisma.subjectEnrolment.upsert({
          where: { userId_subjectId: { userId: user.id, subjectId: subject.id } },
          create: { userId: user.id, subjectId: subject.id, active: true },
          update: { active: true },
        }),
      ),
      // upsert, not update: a profile can be missing if the row was never created,
      // and losing onboarding to a foreign-key error helps nobody.
      prisma.studentProfile.upsert({
        where: { userId: user.id },
        create: { userId: user.id, onboardingStep: furthestOf(user.onboardingStep, "SETUP") },
        update: { onboardingStep: furthestOf(user.onboardingStep, "SETUP") },
      }),
    ]);
  } catch (error) {
    return saveFailed("subjects", error);
  }

  redirect(safeRedirectPath(text(formData, "returnTo"), "/onboarding/setup"));
}

// ---------------------------------------------------------------------------
// Step 2 — year group, tier, exam series
// ---------------------------------------------------------------------------

const YEAR_GROUPS: YearGroup[] = ["YEAR_10", "YEAR_11", "OTHER"];
const TIERS: TierChoice[] = ["FOUNDATION", "HIGHER", "UNSURE"];

const setupSchema = z.object({
  yearGroup: z.enum(YEAR_GROUPS as [YearGroup, ...YearGroup[]]),
  examYear: z.coerce.number().int().min(2024).max(2040),
});

export async function saveSetupAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return signInAgain("/onboarding/setup");

  const parsed = setupSchema.safeParse({
    yearGroup: text(formData, "yearGroup"),
    examYear: text(formData, "examYear"),
  });

  if (!parsed.success) {
    return formError("Choose your year group and when you'll sit your exams.");
  }

  const enrolments = await prisma.subjectEnrolment.findMany({
    where: { userId: user.id, active: true },
    include: { subject: { select: { code: true } } },
  });

  if (enrolments.length === 0) redirect("/onboarding/subjects");

  const { yearGroup, examYear } = parsed.data;

  await prisma.$transaction(async (tx) => {
    await tx.studentProfile.update({
      where: { userId: user.id },
      data: {
        yearGroup,
        onboardingStep: furthestOf(user.onboardingStep, "RAG"),
      },
    });

    for (const enrolment of enrolments) {
      const raw = text(formData, `tier:${enrolment.subjectId}`);
      const tier: TierChoice = TIERS.includes(raw as TierChoice)
        ? (raw as TierChoice)
        : "UNSURE";

      await tx.subjectEnrolment.update({
        where: { id: enrolment.id },
        data: { tier },
      });

      for (const estimate of estimatedExamDates(enrolment.subject.code, examYear)) {
        await tx.examDate.upsert({
          where: { enrolmentId_paper: { enrolmentId: enrolment.id, paper: estimate.paper } },
          create: {
            enrolmentId: enrolment.id,
            paper: estimate.paper,
            date: estimate.date,
            confirmed: false,
          },
          // A date the student has since confirmed by hand is never overwritten by an estimate.
          update: { date: estimate.date, confirmed: false },
        });
      }
    }
  });

  redirect(safeRedirectPath(text(formData, "returnTo"), "/onboarding/rag"));
}

// ---------------------------------------------------------------------------
// Step 3 — RAG ratings
// ---------------------------------------------------------------------------

const RAG_VALUES: RagValue[] = ["NOT_LEARNT", "RED", "AMBER", "GREEN"];

function isRagValue(value: string | undefined): value is RagValue {
  return value !== undefined && RAG_VALUES.includes(value as RagValue);
}

export async function saveRagAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return signInAgain("/onboarding/rag");

  const topics = await prisma.topic.findMany({
    where: { subject: { enrolments: { some: { userId: user.id, active: true } } } },
    select: { id: true },
  });

  if (topics.length === 0) redirect("/onboarding/subjects");

  const ratings: { topicId: string; value: RagValue }[] = [];
  const missing: string[] = [];

  for (const topic of topics) {
    const raw = text(formData, `rag:${topic.id}`);
    if (isRagValue(raw)) {
      ratings.push({ topicId: topic.id, value: raw });
    } else {
      missing.push(topic.id);
    }
  }

  if (missing.length > 0) {
    return formError(
      missing.length === 1
        ? "One topic still needs a rating."
        : `${missing.length} topics still need a rating.`,
    );
  }

  await prisma.$transaction([
    ...ratings.map((rating) =>
      prisma.ragRating.upsert({
        where: { userId_topicId: { userId: user.id, topicId: rating.topicId } },
        create: {
          userId: user.id,
          scope: "TOPIC",
          topicId: rating.topicId,
          value: rating.value,
          source: "USER",
        },
        update: { value: rating.value, source: "USER" },
      }),
    ),
    prisma.studentProfile.update({
      where: { userId: user.id },
      data: { onboardingStep: furthestOf(user.onboardingStep, "AVAILABILITY") },
    }),
  ]);

  redirect(safeRedirectPath(text(formData, "returnTo"), "/onboarding/availability"));
}

// ---------------------------------------------------------------------------
// Step 4 — weekly availability
// ---------------------------------------------------------------------------

const MAX_MINUTES_PER_DAY = 480;

export async function saveAvailabilityAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return signInAgain("/onboarding/availability");

  const slots: { weekday: number; minutes: number }[] = [];

  for (let weekday = 0; weekday < 7; weekday += 1) {
    const raw = Number(text(formData, `minutes:${weekday}`) ?? "0");
    const minutes = Number.isFinite(raw)
      ? Math.min(Math.max(Math.round(raw), 0), MAX_MINUTES_PER_DAY)
      : 0;
    slots.push({ weekday, minutes });
  }

  const weeklyTotal = slots.reduce((sum, slot) => sum + slot.minutes, 0);

  if (weeklyTotal === 0) {
    return formError(
      "Give yourself at least one slot in the week — even 15 minutes is enough to start.",
    );
  }

  const dailyGoal = clampGoal(text(formData, "dailyGoalMinutes"), 30);
  const holidayGoal = clampGoal(text(formData, "holidayGoalMinutes"), 60);

  // Push notifications arrive with the habit layer in Phase 9; only NONE and EMAIL are
  // offered today, and anything else is treated as "no reminders".
  const rawChannel = text(formData, "reminderChannel");
  const reminderChannel: ReminderChannel = rawChannel === "EMAIL" ? "EMAIL" : "NONE";

  const reminderTime = text(formData, "reminderTime");
  const reminderTimes =
    reminderChannel === "EMAIL" && reminderTime && /^\d{2}:\d{2}$/.test(reminderTime)
      ? [reminderTime]
      : [];

  await prisma.$transaction([
    ...slots.map((slot) =>
      prisma.availabilitySlot.upsert({
        where: { userId_weekday: { userId: user.id, weekday: slot.weekday } },
        create: { userId: user.id, weekday: slot.weekday, minutes: slot.minutes },
        update: { minutes: slot.minutes },
      }),
    ),
    prisma.studentProfile.update({
      where: { userId: user.id },
      data: {
        dailyGoalMinutes: dailyGoal,
        holidayGoalMinutes: holidayGoal,
        reminderChannel,
        reminderTimes,
        onboardingStep: "DONE",
        // Re-running the last step shouldn't reset the completion date.
        onboardingCompletedAt: user.profile?.onboardingCompletedAt ?? new Date(),
      },
    }),
  ]);

  redirect(safeRedirectPath(text(formData, "returnTo"), "/welcome"));
}

function clampGoal(raw: string | undefined, fallback: number): number {
  const value = Number(raw ?? fallback);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.round(value), 5), MAX_MINUTES_PER_DAY);
}
