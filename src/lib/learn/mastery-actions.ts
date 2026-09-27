"use server";

import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getLesson } from "@/lib/content/queries";
import { formError, text, type FormState } from "@/lib/forms";
import { lessonSpecPoints } from "@/lib/learn/mastery";
import {
  createMasteryRun,
  getOpenRun,
  getQuestionsByIds,
  getRun,
  recordMasteryAnswers,
  recordSelfMarks,
} from "@/lib/learn/mastery-queries";
import { clampSelfMark } from "@/lib/marking/auto";
import { elapsedSecondsSince, MAX_STEP_SECONDS } from "@/lib/learn/time";
import { safeRedirectPath } from "@/lib/url";

/**
 * The three writes a mastery check needs: start it, answer it, mark it.
 *
 * Each is a plain server action handed straight to a form, so the whole flow works with
 * JavaScript off — which for this feature is not a nicety. A student on a school network
 * with a flaky connection is exactly the student who most needs their answers to arrive.
 */

const LESSON_FALLBACK = "/learn";

function signInAgain(path: string): never {
  redirect(`/login?next=${encodeURIComponent(path)}`);
}

/** Starts a run, or rejoins the one already open. */
export async function startMasteryAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const lessonId = text(formData, "lessonId");
  const path = safeRedirectPath(text(formData, "path"), LESSON_FALLBACK);
  if (!lessonId) return formError("Something went wrong. Reload the page and try again.");

  const user = await getCurrentUser();
  if (!user) signInAgain(path);

  const row = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { subTopicId: true, slug: true },
  });
  if (!row) return formError("That lesson is no longer available.");

  const lesson = await getLesson(row.subTopicId, row.slug);
  if (!lesson) return formError("That lesson is no longer available.");

  const existing = await getOpenRun(user.id, lessonId);
  if (existing) redirect(`${path}?run=${existing.id}`);

  let run;
  try {
    run = await createMasteryRun(
      user.id,
      lessonId,
      row.subTopicId,
      lessonSpecPoints(lesson.blocks),
    );
  } catch (error) {
    console.error("[mastery] could not start a run", error);
    return formError("We couldn't start the check just now. Check your connection.");
  }

  if (!run) {
    return formError("There are no questions for this lesson's spec points yet.");
  }

  redirect(`${path}?run=${run.id}`);
}

/**
 * Submits every answer at once.
 *
 * One form for the whole set rather than one question at a time. A mastery check is
 * three to five questions — paginating them would add four round trips and a resume
 * problem, in exchange for nothing a student wanted.
 */
export async function submitMasteryAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const setId = text(formData, "setId");
  const path = safeRedirectPath(text(formData, "path"), LESSON_FALLBACK);
  if (!setId) return formError("Something went wrong. Reload the page and try again.");

  const user = await getCurrentUser();
  if (!user) signInAgain(path);

  const run = await getRun(user.id, setId);
  if (!run) return formError("That mastery check is no longer available.");
  if (run.completedAt) redirect(`${path}?run=${setId}`);

  const questions = await getQuestionsByIds(run.questionIds);

  const answers = questions.map((question) => ({
    questionId: question.id,
    answerKey: text(formData, `key-${question.id}`) ?? null,
    answerText: text(formData, `text-${question.id}`) ?? null,
  }));

  const unanswered = answers.filter(
    (answer) => answer.answerKey === null && answer.answerText === null,
  );
  if (unanswered.length > 0) {
    return formError(
      unanswered.length === answers.length
        ? "Have a go at each question before submitting — a blank answer teaches you nothing."
        : `${unanswered.length} question${unanswered.length === 1 ? " is" : "s are"} still blank. Write something for each one, even if you are not sure.`,
    );
  }

  // The whole set shares one duration; per-question timing needs a client clock and is
  // not worth a hydration-sensitive dependency for a number nothing reads yet.
  const durationSec = elapsedSecondsSince(
    text(formData, "startedAt"),
    new Date(),
    MAX_STEP_SECONDS * 4,
  );

  try {
    await recordMasteryAnswers(user.id, run, questions, answers, durationSec);
  } catch (error) {
    console.error("[mastery] could not record answers", error);
    return formError("We couldn't save your answers just now. Check your connection.");
  }

  redirect(`${path}?run=${setId}`);
}

/**
 * Applies the marks a student gave themselves against the mark scheme.
 *
 * Phase 5 replaces this with the AI marker. Until then a student reading a real mark
 * scheme and deciding honestly whether they hit each point is doing something genuinely
 * useful — and the attempt row that comes out of it has the same shape either way, so
 * nothing recorded now is wasted when the marker arrives.
 */
export async function selfMarkAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const setId = text(formData, "setId");
  const path = safeRedirectPath(text(formData, "path"), LESSON_FALLBACK);
  if (!setId) return formError("Something went wrong. Reload the page and try again.");

  const user = await getCurrentUser();
  if (!user) signInAgain(path);

  const run = await getRun(user.id, setId);
  if (!run) return formError("That mastery check is no longer available.");
  if (!run.answeredAt) return formError("Answer the questions first.");

  const selfMarked = run.attempts.filter((attempt) => attempt.markedBy === "SELF");

  const marks: { questionId: string; awardedMarks: number }[] = [];
  for (const attempt of selfMarked) {
    const raw = text(formData, `mark-${attempt.questionId}`);
    if (raw === undefined) {
      return formError("Give every question a mark before finishing.");
    }
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isInteger(parsed)) {
      return formError("Marks have to be whole numbers.");
    }
    marks.push({
      questionId: attempt.questionId,
      awardedMarks: clampSelfMark(parsed, attempt.maxMarks),
    });
  }

  try {
    await recordSelfMarks(user.id, setId, marks);
  } catch (error) {
    console.error("[mastery] could not record self-marks", error);
    return formError("We couldn't save your marks just now. Check your connection.");
  }

  redirect(`${path}?run=${setId}`);
}
