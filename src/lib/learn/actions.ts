"use server";

import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import { getLesson } from "@/lib/content/queries";
import { prisma } from "@/lib/db/prisma";
import { formError, text, type FormState } from "@/lib/forms";
import { advanceProgress, recordCheckAnswer } from "@/lib/learn/progress";
import { blockIndexForStage, buildStages } from "@/lib/learn/stages";
import { elapsedSecondsSince } from "@/lib/learn/time";
import { safeRedirectPath } from "@/lib/url";

/**
 * Writes for the lesson runner.
 *
 * Both actions are plain server functions handed straight to a `<form action={...}>`, so
 * React emits the hidden `$ACTION_*` fields and the forms work with JavaScript switched
 * off. Wrapping either of them in a client closure would break that, silently, for every
 * student whose JavaScript has not arrived yet — this repo has made that mistake once
 * already and `npm run smoke` runs JS-disabled specifically to stop it happening again.
 *
 * Both end in `redirect()`, which answers 303 on the no-JS path and lands the student on
 * an anchor for the content they just unlocked, rather than back at the top of a lesson
 * they have already read.
 */

/** Everything a runner form has to carry to identify what it is acting on. */
type RunnerTarget = {
  lessonId: string;
  path: string;
  stepStartedAt: string | undefined;
};

function readTarget(formData: FormData): RunnerTarget | null {
  const lessonId = text(formData, "lessonId");
  const rawPath = text(formData, "path");
  if (!lessonId || !rawPath) return null;

  return {
    lessonId,
    // Never redirect to whatever the form says without checking it: the field is on the
    // page and therefore editable, and an open redirect is an open redirect even when it
    // is only reachable by a signed-in student.
    path: safeRedirectPath(rawPath, "/learn"),
    stepStartedAt: text(formData, "stepStartedAt"),
  };
}

function signInAgain(path: string): never {
  redirect(`/login?next=${encodeURIComponent(path)}`);
}

/**
 * Reveals the next step, or finishes the lesson.
 *
 * The target step comes from the form rather than from "current + 1" so that a stale tab
 * cannot skip a student forward: the value is clamped to the lesson's real step count,
 * and `advanceProgress` refuses to move anyone backwards.
 */
export async function advanceLessonAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const target = readTarget(formData);
  if (!target) return formError("Something went wrong. Reload the page and try again.");

  const user = await getCurrentUser();
  if (!user) signInAgain(target.path);

  const lesson = await getLessonById(target.lessonId);
  if (!lesson) return formError("That lesson is no longer available.");

  const stages = buildStages(lesson.blocks);
  const requested = Number.parseInt(text(formData, "toStage") ?? "", 10);
  if (!Number.isInteger(requested)) {
    return formError("Something went wrong. Reload the page and try again.");
  }

  const toStage = Math.min(Math.max(requested, 0), Math.max(stages.length - 1, 0));
  const finishing = text(formData, "finish") === "1" && toStage >= stages.length - 1;
  const seconds = elapsedSecondsSince(target.stepStartedAt);

  try {
    await advanceProgress(
      user.id,
      lesson.id,
      blockIndexForStage(stages, toStage),
      seconds,
      finishing ? { complete: true } : {},
    );
  } catch (error) {
    console.error("[learn] could not save lesson progress", error);
    return formError("We couldn't save your progress just now. Check your connection.");
  }

  redirect(finishing ? `${target.path}/mastery` : `${target.path}#step-${toStage}`);
}

/**
 * Answers an inline check.
 *
 * Deliberately does *not* advance. The student reads the explanation first and then
 * chooses to continue, which is the whole point of putting a check there — a gate that
 * opened the moment you touched it would just be a speed bump.
 */
export async function answerCheckAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const target = readTarget(formData);
  if (!target) return formError("Something went wrong. Reload the page and try again.");

  const user = await getCurrentUser();
  if (!user) signInAgain(target.path);

  const lesson = await getLessonById(target.lessonId);
  if (!lesson) return formError("That lesson is no longer available.");

  const blockIndex = Number.parseInt(text(formData, "blockIndex") ?? "", 10);
  const block = Number.isInteger(blockIndex) ? lesson.blocks[blockIndex] : undefined;
  if (!block || block.type !== "check") {
    return formError("Something went wrong. Reload the page and try again.");
  }

  const chosen = text(formData, "answer");
  if (!chosen) {
    return formError("Choose an answer first.", { answer: "Pick one of the options." });
  }
  if (!block.options.some((option) => option.key === chosen)) {
    return formError("That isn't one of the options.");
  }

  try {
    await recordCheckAnswer(
      user.id,
      lesson.id,
      blockIndex,
      chosen,
      chosen === block.correctKey,
    );
  } catch (error) {
    console.error("[learn] could not save a check answer", error);
    return formError("We couldn't save that just now. Check your connection.");
  }

  redirect(`${target.path}#check-${blockIndex}`);
}

/**
 * Looks a lesson up by id alone.
 *
 * The runner forms carry a lesson id, not a slug pair, so this exists to avoid making
 * every caller re-derive the sub-topic. It reuses `getLesson`, which re-parses the JSON
 * blocks through the content schema, so an action can trust `block.type` the same way a
 * page can.
 */
async function getLessonById(lessonId: string) {
  const row = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { subTopicId: true, slug: true },
  });
  if (!row) return null;
  return getLesson(row.subTopicId, row.slug);
}
