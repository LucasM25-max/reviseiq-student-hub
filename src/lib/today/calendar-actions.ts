"use server";

/**
 * School tests (D25) and the school calendar (D24).
 *
 * Both are student-owned facts the scheduler consumes, so both regenerate today's
 * plan the moment they change: the student has just told us something important and
 * should see it reflected at once, not tomorrow morning.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireOnboardedUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { formError, formSuccess, text, textList, type FormState } from "@/lib/forms";
import { academicYearOf, defaultEnglandYear } from "@/lib/today/calendar";
import { ensurePlanFor } from "@/lib/today/materialise";
import { LEARNING_NOW_DAYS } from "@/lib/today/weights";

const DAY_MS = 24 * 60 * 60 * 1000;

const idSchema = z.string().min(1).max(100);
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .transform((value) => new Date(`${value}T00:00:00.000Z`))
  .refine((date) => !Number.isNaN(date.getTime()), "That date doesn't look right.");

const kindSchema = z.enum(["CLASS_TEST", "END_OF_TOPIC", "SCHOOL_MOCK"]);

/** Re-plans today, because the inputs the plan was built from have changed. */
async function replan(userId: string): Promise<void> {
  await ensurePlanFor(userId, new Date(), { regenerate: true });
  revalidatePath("/today");
  revalidatePath("/settings/tests");
}

export async function saveSchoolTestAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireOnboardedUser();

  const subjectId = idSchema.safeParse(text(formData, "subjectId"));
  const date = dateSchema.safeParse(text(formData, "date") ?? "");
  const kind = kindSchema.safeParse(text(formData, "kind") ?? "CLASS_TEST");

  if (!subjectId.success) return formError("Pick a subject.");
  if (!date.success) return formError("Pick a date for the test.");
  if (!kind.success) return formError("Pick what kind of test it is.");

  // A test in the past is a typo, not a plan.
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  if (date.data.getTime() < today.getTime()) {
    return formError("That date has already gone — pick one in the future.");
  }

  const enrolled = await prisma.subjectEnrolment.findFirst({
    where: { userId: user.id, subjectId: subjectId.data, active: true },
    select: { id: true },
  });
  if (!enrolled) return formError("You're not taking that subject.");

  const subTopicIds = [...new Set(textList(formData, "subTopicId"))];
  if (subTopicIds.length === 0) {
    return formError("Pick at least one topic the test covers.");
  }

  const valid = await prisma.subTopic.findMany({
    where: { id: { in: subTopicIds }, topic: { subjectId: subjectId.data } },
    select: { id: true },
  });
  if (valid.length === 0) return formError("Those topics don't belong to that subject.");

  const existingId = text(formData, "testId");
  const label = (text(formData, "label") ?? "").slice(0, 100).trim() || null;

  const data = {
    subjectId: subjectId.data,
    date: date.data,
    kind: kind.data,
    label,
    subTopicIds: valid.map((row) => row.id),
  };

  if (existingId) {
    const owned = await prisma.schoolTest.findFirst({
      where: { id: existingId, userId: user.id },
      select: { id: true },
    });
    if (!owned) return formError("That test isn't yours.");
    await prisma.schoolTest.update({ where: { id: owned.id }, data });
  } else {
    await prisma.schoolTest.create({ data: { ...data, userId: user.id } });
  }

  /*
   * The gate opens automatically for anything the test covers (doc 05 §5a).
   * Blocking a student from the lesson on something they are tested on in four days
   * would be indefensible, so the flag is created rather than waiting to be asked.
   */
  const expiresAt = new Date(Date.now() + LEARNING_NOW_DAYS * DAY_MS);
  for (const subTopic of valid) {
    await prisma.learningNowFlag.upsert({
      where: { userId_subTopicId: { userId: user.id, subTopicId: subTopic.id } },
      create: { userId: user.id, subTopicId: subTopic.id, expiresAt, auto: true },
      update: { expiresAt },
    });
  }

  await replan(user.id);

  return formSuccess(existingId ? "Test updated." : "Added — today's plan already knows.");
}

export async function deleteSchoolTestAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireOnboardedUser();

  const testId = idSchema.safeParse(text(formData, "testId"));
  if (!testId.success) return formError("Something went wrong — try again.");

  const deleted = await prisma.schoolTest.deleteMany({
    where: { id: testId.data, userId: user.id },
  });
  if (deleted.count === 0) return formError("That test isn't yours.");

  await replan(user.id);
  return formSuccess("Removed.");
}

/**
 * "How did the Biology test go?" (doc 05 §5a).
 *
 * The cheapest high-quality signal the app will ever get: a real assessment, marked
 * by a real teacher, on known content. It becomes a *suggestion* — never an
 * automatic change, because the student owns their ratings.
 */
export async function recordTestOutcomeAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireOnboardedUser();

  const testId = idSchema.safeParse(text(formData, "testId"));
  const outcome = z.enum(["WELL", "MIXED", "BADLY"]).safeParse(text(formData, "outcome"));

  if (!testId.success || !outcome.success)
    return formError("Something went wrong — try again.");

  const test = await prisma.schoolTest.findFirst({
    where: { id: testId.data, userId: user.id },
    select: { id: true, subTopicIds: true },
  });
  if (!test) return formError("That test isn't yours.");

  await prisma.schoolTest.update({
    where: { id: test.id },
    data: { outcome: outcome.data, outcomeAskedAt: new Date() },
  });

  const suggested =
    outcome.data === "WELL" ? "GREEN" : outcome.data === "MIXED" ? "AMBER" : "RED";
  const reason =
    outcome.data === "WELL"
      ? "You said your test on this went well."
      : outcome.data === "MIXED"
        ? "You said your test on this was mixed."
        : "You said your test on this went badly.";

  for (const subTopicId of test.subTopicIds) {
    await prisma.ragSuggestion.upsert({
      where: {
        userId_subTopicId_source: {
          userId: user.id,
          subTopicId,
          source: "SCHOOL_TEST",
        },
      },
      create: {
        userId: user.id,
        subTopicId,
        suggested,
        reason,
        source: "SCHOOL_TEST",
        schoolTestId: test.id,
      },
      update: { suggested, reason, schoolTestId: test.id, acceptedAt: null, dismissedAt: null },
    });
  }

  revalidatePath("/today");
  return formSuccess("Thanks — that helps a lot.");
}

/** Accepts a suggested rating, or dismisses it. The student decides, always. */
export async function resolveSuggestionAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireOnboardedUser();

  const suggestionId = idSchema.safeParse(text(formData, "suggestionId"));
  const accept = text(formData, "accept") === "1";
  if (!suggestionId.success) return formError("Something went wrong — try again.");

  const suggestion = await prisma.ragSuggestion.findFirst({
    where: { id: suggestionId.data, userId: user.id },
    select: { id: true, subTopicId: true, suggested: true },
  });
  if (!suggestion) return formError("That suggestion isn't yours.");

  if (!accept) {
    await prisma.ragSuggestion.update({
      where: { id: suggestion.id },
      data: { dismissedAt: new Date() },
    });
    revalidatePath("/today");
    return formSuccess("Left as it was.");
  }

  await prisma.ragRating.upsert({
    where: {
      userId_subTopicId: { userId: user.id, subTopicId: suggestion.subTopicId },
    },
    create: {
      userId: user.id,
      scope: "SUBTOPIC",
      subTopicId: suggestion.subTopicId,
      value: suggestion.suggested,
      source: "SUGGESTED_ACCEPTED",
    },
    update: { value: suggestion.suggested, source: "SUGGESTED_ACCEPTED" },
  });

  await prisma.ragSuggestion.update({
    where: { id: suggestion.id },
    data: { acceptedAt: new Date() },
  });

  await replan(user.id);
  return formSuccess("Updated — your plan has changed to match.");
}

/** Lays down England's usual term shape for the student to correct. */
export async function seedCalendarAction(
  _prev: FormState,
  _formData: FormData,
): Promise<FormState> {
  const user = await requireOnboardedUser();

  const existing = await prisma.termPeriod.count({ where: { userId: user.id } });
  if (existing > 0) return formError("You've already got a calendar — edit or clear it first.");

  const year = academicYearOf(new Date());

  await prisma.termPeriod.createMany({
    data: defaultEnglandYear(year).map((period) => ({
      userId: user.id,
      kind: period.kind,
      startDate: period.startDate,
      endDate: period.endDate,
      label: period.label ?? null,
    })),
  });

  await replan(user.id);
  return formSuccess("Added the usual English term dates — correct anything that's wrong.");
}

export async function savePeriodAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireOnboardedUser();

  const periodId = text(formData, "periodId");
  const start = dateSchema.safeParse(text(formData, "startDate") ?? "");
  const end = dateSchema.safeParse(text(formData, "endDate") ?? "");
  const kind = z
    .enum(["TERM", "HALF_TERM", "HOLIDAY", "STUDY_LEAVE", "EXAM_SEASON"])
    .safeParse(text(formData, "kind") ?? "");

  if (!start.success || !end.success) return formError("Pick both dates.");
  if (!kind.success) return formError("Pick what kind of period it is.");
  if (end.data.getTime() < start.data.getTime()) {
    return formError("The end date is before the start date.");
  }

  const minutesRaw = Number.parseInt(text(formData, "minutesPerDay") ?? "", 10);
  const minutesPerDay =
    Number.isFinite(minutesRaw) && minutesRaw > 0 ? Math.min(minutesRaw, 600) : null;

  const data = {
    kind: kind.data,
    startDate: start.data,
    endDate: end.data,
    minutesPerDay,
    label: (text(formData, "label") ?? "").slice(0, 60).trim() || null,
  };

  if (periodId) {
    const owned = await prisma.termPeriod.findFirst({
      where: { id: periodId, userId: user.id },
      select: { id: true },
    });
    if (!owned) return formError("That period isn't yours.");
    await prisma.termPeriod.update({ where: { id: owned.id }, data });
  } else {
    await prisma.termPeriod.create({ data: { ...data, userId: user.id } });
  }

  await replan(user.id);
  revalidatePath("/settings/calendar");
  return formSuccess("Saved.");
}

export async function deletePeriodAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireOnboardedUser();

  const periodId = idSchema.safeParse(text(formData, "periodId"));
  if (!periodId.success) return formError("Something went wrong — try again.");

  const deleted = await prisma.termPeriod.deleteMany({
    where: { id: periodId.data, userId: user.id },
  });
  if (deleted.count === 0) return formError("That period isn't yours.");

  await replan(user.id);
  revalidatePath("/settings/calendar");
  return formSuccess("Removed.");
}

/**
 * The resit hatch (D27).
 *
 * `schedulingEnabled` is a stored flag precisely so this works: a student resitting
 * in November needs the app more than anyone, and a computed "are all exams past"
 * check would lock them out.
 */
export async function resumeSchedulingAction(
  _prev: FormState,
  _formData: FormData,
): Promise<FormState> {
  const user = await requireOnboardedUser();

  await prisma.studentProfile.update({
    where: { userId: user.id },
    // examsCompletedAt is deliberately kept: it is the watermark that stops the
    // nightly check ending the season again before new dates have been added.
    data: { schedulingEnabled: true },
  });

  await replan(user.id);
  return formSuccess("Welcome back — add your resit dates and plans start again.");
}

/** Plain-signature variants for forms in server components. */
export async function deleteSchoolTestFormAction(formData: FormData): Promise<void> {
  await deleteSchoolTestAction({ ok: true }, formData);
}

export async function deletePeriodFormAction(formData: FormData): Promise<void> {
  await deletePeriodAction({ ok: true }, formData);
}

export async function seedCalendarFormAction(formData: FormData): Promise<void> {
  await seedCalendarAction({ ok: true }, formData);
}

export async function resumeSchedulingFormAction(formData: FormData): Promise<void> {
  await resumeSchedulingAction({ ok: true }, formData);
}
