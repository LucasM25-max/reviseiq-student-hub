import "server-only";

/**
 * The things Today asks a student, as opposed to the things it asks them to do.
 *
 * Kept apart from the plan because they are not tasks: they are one-tap signals the
 * app is missing, and they should never compete for a slot in the session.
 */

import { prisma } from "@/lib/db/prisma";

export type PendingSuggestion = {
  id: string;
  subTopic: string;
  suggested: string;
  reason: string;
};

export type PendingTestOutcome = {
  id: string;
  subject: string;
  date: Date;
};

/**
 * Ratings we think are wrong, waiting on the student's word.
 *
 * Never applied automatically: the RAG grid is the one thing a student fully
 * controls, and silently rewriting it would break that.
 */
export async function pendingSuggestionsFor(userId: string): Promise<PendingSuggestion[]> {
  const rows = await prisma.ragSuggestion.findMany({
    where: { userId, acceptedAt: null, dismissedAt: null },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: {
      id: true,
      suggested: true,
      reason: true,
      subTopic: { select: { code: true, title: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    subTopic: `${row.subTopic.code} ${row.subTopic.title}`,
    suggested: row.suggested,
    reason: row.reason,
  }));
}

/**
 * A test that has been and gone, with nobody asked how it went.
 *
 * The day after, and once — a prompt that keeps reappearing is nagging, and D33
 * rules that out.
 */
export async function testAwaitingOutcome(
  userId: string,
  now: Date,
): Promise<PendingTestOutcome | null> {
  const todayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const fortnightAgo = new Date(todayStart.getTime() - 14 * 24 * 60 * 60 * 1000);

  const row = await prisma.schoolTest.findFirst({
    where: {
      userId,
      outcome: null,
      outcomeAskedAt: null,
      date: { lt: todayStart, gte: fortnightAgo },
    },
    orderBy: { date: "desc" },
    select: { id: true, date: true, subject: { select: { name: true } } },
  });

  if (!row) return null;

  return { id: row.id, subject: row.subject.name, date: row.date };
}

/** Whether the congratulations screen is still owed (D27). */
export async function owedCongratulations(userId: string): Promise<boolean> {
  const profile = await prisma.studentProfile.findUnique({
    where: { userId },
    select: { schedulingEnabled: true, congratulationsSeenAt: true },
  });

  return (
    profile != null && !profile.schedulingEnabled && profile.congratulationsSeenAt === null
  );
}

/** Shown exactly once. */
export async function markCongratulationsSeen(userId: string): Promise<void> {
  await prisma.studentProfile.updateMany({
    where: { userId, congratulationsSeenAt: null },
    data: { congratulationsSeenAt: new Date() },
  });
}

/**
 * Ends the season when the last exam has passed (D27).
 *
 * The streak is frozen rather than broken: finishing your exams is not a reason to
 * lose a hundred-day streak. Called from the nightly job and on first open, so a
 * student who never gets a cron run still lands correctly.
 */
export async function endSeasonIfPast(userId: string, now: Date): Promise<boolean> {
  const profile = await prisma.studentProfile.findUnique({
    where: { userId },
    select: { schedulingEnabled: true, examsCompletedAt: true },
  });
  if (!profile?.schedulingEnabled) return false;

  const last = await prisma.examDate.findFirst({
    where: { enrolment: { userId } },
    orderBy: { date: "desc" },
    select: { date: true },
  });

  // No dates at all is not a finished season — it is an unconfigured one.
  if (!last) return false;

  const dayAfter = new Date(last.date.getTime() + 24 * 60 * 60 * 1000);
  if (now.getTime() < dayAfter.getTime()) return false;

  /*
   * The resit hatch, protected (D27). A student who has said "actually, I've got a
   * resit" has not yet had time to add the new dates, and re-ending the season on
   * the strength of the old ones would lock them straight back out — which is the
   * exact failure a stored flag exists to prevent. Only end again once there is an
   * exam *later* than the last ending.
   */
  if (profile.examsCompletedAt && last.date.getTime() <= profile.examsCompletedAt.getTime()) {
    return false;
  }

  await prisma.studentProfile.update({
    where: { userId },
    data: { schedulingEnabled: false, examsCompletedAt: now },
  });

  /*
   * Today's plan was built while the season was still running, and `ensurePlanFor`
   * returns a live plan rather than rebuilding one. Without superseding it the
   * student finishes their last exam and is still handed a list of tasks — so the
   * stale plan is retired here, and the next read regenerates as suppressed.
   */
  await prisma.dayPlan.updateMany({
    where: { userId, supersededAt: null },
    data: { supersededAt: now },
  });

  return true;
}
