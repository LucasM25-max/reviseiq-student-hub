"use server";

/**
 * Practice mode writes.
 *
 * Three actions: start a run, answer a question, dispute a mark. Each re-checks the
 * session and re-checks ownership, because a server action is a public endpoint and
 * the id in the form is whatever the caller sent.
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { formError, formSuccess, text, type FormState } from "@/lib/forms";
import { markAnswer } from "@/lib/marking/service";
import { PRACTICE_REASON, PRACTICE_SIZE } from "@/lib/test/queries";

const idSchema = z.string().min(1).max(100);

/**
 * Chooses the questions for a run.
 *
 * Weakest spec points first, then unseen questions, then anything else — so practice
 * goes where it is needed rather than replaying what the student can already do.
 * Ties break on a stable key so a run is reproducible.
 */
async function chooseQuestions(userId: string, subTopicId: string): Promise<string[]> {
  const questions = await prisma.question.findMany({
    where: { primarySubTopicId: subTopicId, retired: false },
    select: {
      id: true,
      marks: true,
      difficulty: true,
      specPoints: { select: { specPointId: true } },
    },
  });
  if (questions.length === 0) return [];

  const [mastery, seen] = await Promise.all([
    prisma.specPointMastery.findMany({
      where: {
        userId,
        specPointId: { in: questions.flatMap((q) => q.specPoints.map((s) => s.specPointId)) },
      },
      select: { specPointId: true, mastery: true },
    }),
    prisma.questionAttempt.findMany({
      where: { userId, questionId: { in: questions.map((q) => q.id) } },
      select: { questionId: true },
      distinct: ["questionId"],
    }),
  ]);

  const masteryById = new Map(mastery.map((row) => [row.specPointId, row.mastery]));
  const attempted = new Set(seen.map((row) => row.questionId));

  const scored = questions.map((question) => {
    const values = question.specPoints
      .map((link) => masteryById.get(link.specPointId))
      .filter((value): value is number => value !== undefined);

    // Never attempted counts as maximum need, not as perfect.
    const need =
      values.length === 0 ? 1 : 1 - values.reduce((a, b) => a + b, 0) / values.length;

    return {
      id: question.id,
      need,
      fresh: attempted.has(question.id) ? 0 : 1,
      difficulty: question.difficulty,
    };
  });

  scored.sort(
    (a, b) =>
      b.need - a.need ||
      b.fresh - a.fresh ||
      a.difficulty - b.difficulty ||
      a.id.localeCompare(b.id),
  );

  return scored.slice(0, PRACTICE_SIZE).map((question) => question.id);
}

export async function startPracticeAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser("/test");

  const subTopicId = idSchema.safeParse(text(formData, "subTopicId"));
  if (!subTopicId.success) return formError("Pick a topic to practise.");

  const subTopic = await prisma.subTopic.findUnique({
    where: { id: subTopicId.data },
    select: { id: true },
  });
  if (!subTopic) return formError("That topic doesn't exist.");

  const questionIds = await chooseQuestions(user.id, subTopic.id);
  if (questionIds.length === 0) {
    return formError("There are no questions on that topic yet.");
  }

  const set = await prisma.questionSet.create({
    data: { userId: user.id, questionIds, reason: PRACTICE_REASON },
    select: { id: true },
  });

  redirect(`/test/practice/${set.id}`);
}

export async function submitAnswerAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser("/test");

  const setId = idSchema.safeParse(text(formData, "setId"));
  const questionId = idSchema.safeParse(text(formData, "questionId"));
  if (!setId.success || !questionId.success)
    return formError("Something went wrong — try again.");

  const answerText = (text(formData, "answerText") ?? "").slice(0, 5000);
  const answerKey = (text(formData, "answerKey") ?? "").slice(0, 50) || null;

  // Clamped: a tab left open overnight is not an hour of thinking, and the client
  // controls this value so it can be anything at all.
  const started = Date.parse(text(formData, "startedAt") ?? "");
  const durationSec = Number.isFinite(started)
    ? Math.min(Math.max(Math.round((Date.now() - started) / 1000), 0), 3600)
    : 0;

  const outcome = await markAnswer({
    userId: user.id,
    questionId: questionId.data,
    answerText,
    answerKey,
    context: "PRACTICE",
    setId: setId.data,
    durationSec,
  });

  if (!outcome.ok) return formError(outcome.error);

  // Finish the run once every question in the snapshot has an attempt.
  const set = await prisma.questionSet.findFirst({
    where: { id: setId.data, userId: user.id },
    select: { id: true, questionIds: true, completedAt: true },
  });

  if (set && !set.completedAt) {
    const answered = await prisma.questionAttempt.count({ where: { setId: set.id } });
    if (answered >= set.questionIds.length) {
      await prisma.questionSet.update({
        where: { id: set.id },
        data: { answeredAt: new Date(), completedAt: new Date() },
      });
    }
  }

  revalidatePath(`/test/practice/${setId.data}`);

  return formSuccess("Marked.");
}

/**
 * "I think this mark is wrong."
 *
 * The single most important trust mechanism in the product: an AI mark that is wrong
 * and unchallengeable loses a student permanently. It never changes the mark — it
 * records the disagreement for review, and says so.
 */
export async function disputeMarkAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser("/test");

  const attemptId = idSchema.safeParse(text(formData, "attemptId"));
  if (!attemptId.success) return formError("Something went wrong — try again.");

  const reason = (text(formData, "reason") ?? "").slice(0, 1000).trim();

  const attempt = await prisma.questionAttempt.findFirst({
    where: { id: attemptId.data, userId: user.id },
    select: { id: true, setId: true },
  });
  if (!attempt) return formError("That answer isn't yours.");

  await prisma.questionAttempt.update({
    where: { id: attempt.id },
    data: { disputed: true, disputeReason: reason || null, disputedAt: new Date() },
  });

  if (attempt.setId) revalidatePath(`/test/practice/${attempt.setId}`);

  return formSuccess("Thanks — flagged for review. Your mark hasn't changed.");
}
