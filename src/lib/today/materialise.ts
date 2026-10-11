import "server-only";

/**
 * Turning a computed plan into rows the app can link into (doc 05 §10).
 *
 * The important part is that payloads are **frozen here**, at generation time. A
 * questions task gets a real `QuestionSet` snapshot, so the five questions the
 * rationale promised are the five the student gets — even if the bank changes, or
 * they open the link tomorrow.
 */

import { startOfUtcDay } from "@/lib/ai/usage";
import { prisma } from "@/lib/db/prisma";
import { buildPlan, targetHref } from "@/lib/today/plan";
import { buildSnapshot } from "@/lib/today/snapshot";
import type { Plan, PlannedTask, PlannerInput } from "@/lib/today/types";

export const PLAN_SET_REASON = "today";

export type MaterialisedTask = {
  id: string;
  order: number;
  type: string;
  status: "PENDING" | "DONE" | "SKIPPED" | "SWAPPED";
  title: string;
  rationale: string;
  estMinutes: number;
  targetHref: string;
  subjectId: string | null;
  subTopicId: string | null;
  setId: string | null;
  completedAt: Date | null;
};

export type MaterialisedPlan = {
  id: string;
  planDate: Date;
  mode: string;
  targetMinutes: number;
  gateMessage: string | null;
  suppressedReason: string | null;
  tasks: MaterialisedTask[];
};

/**
 * Writes a plan and its tasks.
 *
 * A questions task needs its `QuestionSet` to exist before the href can point at it,
 * so the set is created first and the task row carries its id — that is why the
 * practice route can be a plain `/test/practice/<setId>`.
 */
export async function materialisePlan(
  userId: string,
  plan: Plan,
  planDate: Date,
): Promise<MaterialisedPlan> {
  const created = await prisma.dayPlan.create({
    data: {
      userId,
      planDate,
      mode: plan.mode,
      targetMinutes: plan.targetMinutes,
      algoVersion: plan.algoVersion,
      gateMessage: plan.gateMessage,
      suppressedReason: plan.suppressed?.reason ?? null,
    },
    select: { id: true, planDate: true },
  });

  const tasks: MaterialisedTask[] = [];

  for (const task of plan.tasks) {
    const setId = await snapshotSetFor(userId, task);

    // Questions deep-link to their frozen set; everything else to its own route.
    const href =
      setId && (task.ref.kind === "QUESTIONS" || task.ref.kind === "DIAGNOSTIC")
        ? `/test/practice/${setId}?task=`
        : null;

    const row = await prisma.planTask.create({
      data: {
        planId: created.id,
        order: task.order,
        type: task.type,
        subjectId: task.subjectId || null,
        subTopicId: task.subTopicId ?? null,
        title: task.title,
        rationale: task.rationale,
        estMinutes: task.estMinutes,
        score: task.score,
        setId,
        payload: task.ref as unknown as object,
        // Patched immediately below: the href needs the task's own id.
        targetHref: "",
      },
      select: { id: true },
    });

    const finalHref = href ? `${href}${row.id}` : targetHref(task, row.id);

    await prisma.planTask.update({
      where: { id: row.id },
      data: { targetHref: finalHref },
    });

    tasks.push({
      id: row.id,
      order: task.order,
      type: task.type,
      status: "PENDING",
      title: task.title,
      rationale: task.rationale,
      estMinutes: task.estMinutes,
      targetHref: finalHref,
      subjectId: task.subjectId || null,
      subTopicId: task.subTopicId ?? null,
      setId,
      completedAt: null,
    });
  }

  return {
    id: created.id,
    planDate: created.planDate,
    mode: plan.mode,
    targetMinutes: plan.targetMinutes,
    gateMessage: plan.gateMessage,
    suppressedReason: plan.suppressed?.reason ?? null,
    tasks,
  };
}

/** Freezes the exact questions a task promised. */
async function snapshotSetFor(userId: string, task: PlannedTask): Promise<string | null> {
  if (task.ref.kind !== "QUESTIONS" && task.ref.kind !== "DIAGNOSTIC") return null;
  if (task.ref.questionIds.length === 0) return null;

  const set = await prisma.questionSet.create({
    data: {
      userId,
      questionIds: task.ref.questionIds,
      reason: PLAN_SET_REASON,
    },
    select: { id: true },
  });

  return set.id;
}

/** The live plan for today, if one has been generated and not superseded. */
export async function livePlanFor(
  userId: string,
  planDate: Date,
): Promise<MaterialisedPlan | null> {
  const plan = await prisma.dayPlan.findFirst({
    where: { userId, planDate, supersededAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      planDate: true,
      mode: true,
      targetMinutes: true,
      gateMessage: true,
      suppressedReason: true,
      tasks: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          order: true,
          type: true,
          status: true,
          title: true,
          rationale: true,
          estMinutes: true,
          targetHref: true,
          subjectId: true,
          subTopicId: true,
          setId: true,
          completedAt: true,
        },
      },
    },
  });

  if (!plan) return null;

  return {
    id: plan.id,
    planDate: plan.planDate,
    mode: plan.mode,
    targetMinutes: plan.targetMinutes,
    gateMessage: plan.gateMessage,
    suppressedReason: plan.suppressedReason,
    tasks: plan.tasks,
  };
}

/**
 * Today's plan, generating one on demand if there isn't one.
 *
 * On-demand generation is what covers timezone drift and brand-new accounts — a
 * student who opens the app before the nightly job has run should not see an empty
 * page and conclude nothing was planned for them.
 */
export async function ensurePlanFor(
  userId: string,
  now: Date,
  options: { override?: number | null; regenerate?: boolean } = {},
): Promise<MaterialisedPlan | null> {
  const planDate = startOfUtcDay(now);

  if (!options.regenerate) {
    const existing = await livePlanFor(userId, planDate);
    if (existing) return existing;
  }

  const snapshot = await buildSnapshot(userId, now, options.override);
  if (!snapshot) return null;

  const plan = buildPlan(snapshot);

  /*
   * Superseding rather than editing. "I've only got 20 minutes" produces a new plan;
   * the old one stays, stamped, so what the student was asked to do on a given day
   * remains answerable.
   */
  await prisma.dayPlan.updateMany({
    where: { userId, planDate, supersededAt: null },
    data: { supersededAt: now },
  });

  return materialisePlan(userId, plan, planDate);
}

export type { PlannerInput };
