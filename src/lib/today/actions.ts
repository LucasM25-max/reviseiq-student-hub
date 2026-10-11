"use server";

/**
 * Today's writes: finish a task, resize the day, swap something out.
 *
 * Each re-checks the session and ownership — the task id in a form is whatever the
 * caller sent.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { startOfUtcDay } from "@/lib/ai/usage";
import { requireOnboardedUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { formError, formSuccess, text, type FormState } from "@/lib/forms";
import { reactionTo, surpriseFrom } from "@/lib/today/adapt";
import { ensurePlanFor } from "@/lib/today/materialise";

const idSchema = z.string().min(1).max(100);

/**
 * Marks a task done and records how long it actually took.
 *
 * `actualMinutes` is what feeds duration personalisation, so a student who reads
 * slowly stops being handed plans they can never finish.
 */
export async function completeTaskAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireOnboardedUser();

  const taskId = idSchema.safeParse(text(formData, "taskId"));
  if (!taskId.success) return formError("Something went wrong — try again.");

  const task = await prisma.planTask.findFirst({
    where: { id: taskId.data, plan: { userId: user.id } },
    select: { id: true, startedAt: true, status: true },
  });
  if (!task) return formError("That task isn't yours.");
  if (task.status === "DONE") return formSuccess("Already ticked off.");

  const started = Date.parse(text(formData, "startedAt") ?? "");
  const minutes =
    Number.isFinite(started) && started > 0
      ? Math.min(Math.max(Math.round((Date.now() - started) / 60_000), 0), 240)
      : null;

  await prisma.planTask.update({
    where: { id: task.id },
    data: { status: "DONE", completedAt: new Date(), actualMinutes: minutes },
  });

  revalidatePath("/today");
  return formSuccess("Nice — ticked off.");
}

/**
 * "I've only got N minutes" (D10).
 *
 * Re-packs the same day into the time that is actually available. Completed tasks
 * are preserved by the supersede-rather-than-edit model: the old plan keeps its
 * history and the new one is sized honestly.
 */
export async function quickSessionAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireOnboardedUser();

  const raw = Number.parseInt(text(formData, "minutes") ?? "", 10);
  if (!Number.isFinite(raw) || raw < 5 || raw > 600) {
    return formError("Pick somewhere between 5 and 600 minutes.");
  }

  await ensurePlanFor(user.id, new Date(), { override: raw, regenerate: true });

  revalidatePath("/today");
  return formSuccess(`Re-planned for ${raw} minutes.`);
}

/** Rebuilds today from scratch — used after anything that changes the inputs. */
export async function regeneratePlanAction(
  _prev: FormState,
  _formData: FormData,
): Promise<FormState> {
  const user = await requireOnboardedUser();
  await ensurePlanFor(user.id, new Date(), { regenerate: true });

  revalidatePath("/today");
  return formSuccess("Fresh plan.");
}

/**
 * Swaps a task out.
 *
 * Marked `SWAPPED` rather than deleted, which is what lets the scoring apply a swap
 * penalty for a week: a student who rejects a task should not be handed it again
 * tomorrow.
 */
export async function swapTaskAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireOnboardedUser();

  const taskId = idSchema.safeParse(text(formData, "taskId"));
  if (!taskId.success) return formError("Something went wrong — try again.");

  const task = await prisma.planTask.findFirst({
    where: { id: taskId.data, plan: { userId: user.id } },
    select: { id: true, status: true },
  });
  if (!task) return formError("That task isn't yours.");
  if (task.status === "DONE") return formError("That one's already done.");

  await prisma.planTask.update({
    where: { id: task.id },
    data: { status: "SWAPPED" },
  });

  revalidatePath("/today");
  return formSuccess("Swapped out. It won't come back for a few days.");
}

/** Plain-signature variants, for forms in server components. */
export async function completeTaskFormAction(formData: FormData): Promise<void> {
  await completeTaskAction({ ok: true }, formData);
}

export async function swapTaskFormAction(formData: FormData): Promise<void> {
  await swapTaskAction({ ok: true }, formData);
}

export async function regeneratePlanFormAction(formData: FormData): Promise<void> {
  await regeneratePlanAction({ ok: true }, formData);
}

/**
 * Called from a deep-linked page when the work itself is finished.
 *
 * This is the `?task=` round trip: the student clicks into exactly the described
 * work, finishes it there, and comes back to Today with it ticked.
 */
export async function markTaskDoneById(userId: string, taskId: string): Promise<void> {
  const task = await prisma.planTask.findFirst({
    where: { id: taskId, plan: { userId } },
    select: { id: true, status: true, startedAt: true },
  });
  if (!task || task.status === "DONE") return;

  const minutes = task.startedAt
    ? Math.min(Math.max(Math.round((Date.now() - task.startedAt.getTime()) / 60_000), 0), 240)
    : null;

  await prisma.planTask.update({
    where: { id: task.id },
    data: { status: "DONE", completedAt: new Date(), actualMinutes: minutes },
  });

  revalidatePath("/today");
}

/**
 * Re-ranks what is left of the day after a surprising result (doc 05 §8).
 *
 * Only ever *removes* work on the sub-topic that surprised us, and only when the
 * result was far from what the plan assumed. It never adds, never reorders, and
 * never touches anything already done — a plan that rearranges itself while a
 * student is working through it is worse than one that is slightly wrong.
 */
export async function adaptPlanAfterAttempt(
  userId: string,
  input: { subTopicId: string | null; awardedMarks: number; maxMarks: number },
): Promise<string | null> {
  if (!input.subTopicId) return null;

  const reaction = reactionTo(surpriseFrom(input.awardedMarks, input.maxMarks));
  if (!reaction) return null;

  const planDate = startOfUtcDay(new Date());

  const plan = await prisma.dayPlan.findFirst({
    where: { userId, planDate, supersededAt: null },
    select: { id: true },
  });
  if (!plan) return null;

  const dropped = await prisma.planTask.updateMany({
    where: {
      planId: plan.id,
      status: "PENDING",
      subTopicId: input.subTopicId,
      type: { in: reaction.drop },
    },
    data: { status: "SKIPPED" },
  });

  if (dropped.count === 0) return null;

  revalidatePath("/today");
  return reaction.message;
}

/** Records that a student has opened a task, so `actualMinutes` means something. */
export async function markTaskStarted(userId: string, taskId: string): Promise<void> {
  await prisma.planTask.updateMany({
    where: { id: taskId, plan: { userId }, startedAt: null },
    data: { startedAt: new Date() },
  });
}

export { startOfUtcDay };
