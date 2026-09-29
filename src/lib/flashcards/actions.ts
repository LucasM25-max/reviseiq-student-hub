"use server";

/**
 * Flashcard and blurt writes.
 *
 * Every action re-checks the session and re-checks ownership: a server action is a
 * public endpoint and the card id in the form is whatever the caller sent.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { scoreBlurt, type ExpectedPoint } from "@/lib/ai/blurt";
import { gradeCard, setSuspended, undoLastReview } from "@/lib/flashcards/review";
import { RATINGS, type RatingName } from "@/lib/fsrs";
import { formError, formSuccess, text, type FormState } from "@/lib/forms";
import { prisma } from "@/lib/db/prisma";

const idSchema = z.string().min(1).max(100);
const ratingSchema = z.enum(RATINGS as [RatingName, ...RatingName[]]);

export async function gradeCardAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser("/revise/flashcards");

  const cardId = idSchema.safeParse(text(formData, "cardId"));
  const rating = ratingSchema.safeParse(text(formData, "rating"));
  if (!cardId.success || !rating.success) return formError("Something went wrong — try again.");

  const duration = Number.parseInt(text(formData, "durationMs") ?? "", 10);

  const outcome = await gradeCard(
    user.id,
    cardId.data,
    rating.data,
    Number.isFinite(duration) ? duration : 0,
  );

  if (!outcome.ok) return formError(outcome.error);

  revalidatePath("/revise/flashcards");

  return formSuccess(
    outcome.leech
      ? "That one keeps slipping. It's paused — the notes will help more than another card."
      : "Saved.",
  );
}

export async function undoReviewAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser("/revise/flashcards");

  const cardId = idSchema.safeParse(text(formData, "cardId"));
  if (!cardId.success) return formError("Something went wrong — try again.");

  const outcome = await undoLastReview(user.id, cardId.data);
  if (!outcome.ok) return formError(outcome.error ?? "There's nothing to undo.");

  revalidatePath("/revise/flashcards");
  return formSuccess("Undone.");
}

export async function suspendCardAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser("/revise/flashcards");

  const cardId = idSchema.safeParse(text(formData, "cardId"));
  if (!cardId.success) return formError("Something went wrong — try again.");

  const resume = text(formData, "resume") === "1";
  const outcome = await setSuspended(user.id, cardId.data, !resume);
  if (!outcome.ok) return formError(outcome.error ?? "That card isn't yours.");

  revalidatePath("/revise/flashcards");
  return formSuccess(resume ? "Back in the deck." : "Paused. You can bring it back any time.");
}

/** Captures a blurt and scores it for idea coverage (D15). */
export async function submitBlurtAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser("/revise");

  const promptId = idSchema.safeParse(text(formData, "promptId"));
  if (!promptId.success) return formError("Something went wrong — try again.");

  const written = (text(formData, "text") ?? "").slice(0, 8000).trim();
  if (written.length < 10) {
    return formError("Write what you can remember first — even a few lines is enough.");
  }

  const prompt = await prisma.blurtPrompt.findUnique({
    where: { id: promptId.data },
    select: { id: true, prompt: true, expectedPoints: true, subTopicId: true },
  });
  if (!prompt) return formError("That prompt doesn't exist.");

  const expectedPoints = (
    Array.isArray(prompt.expectedPoints) ? prompt.expectedPoints : []
  ) as ExpectedPoint[];

  const started = Date.parse(text(formData, "startedAt") ?? "");
  const durationSec = Number.isFinite(started)
    ? Math.min(Math.max(Math.round((Date.now() - started) / 1000), 0), 3600)
    : 0;

  const result = await scoreBlurt(
    { prompt: prompt.prompt, expectedPoints, studentText: written },
    { userId: user.id },
  );

  await prisma.blurtAttempt.create({
    data: {
      userId: user.id,
      promptId: prompt.id,
      text: written,
      coveragePct: result.coveragePct,
      detail: result as unknown as object,
      markedBy: result.source === "AI" ? "AI" : "AI_FALLBACK",
      durationSec,
    },
  });

  revalidatePath(`/revise/blurt/${prompt.id}`);

  return formSuccess("Scored.");
}

/**
 * Plain-signature variants for the no-JavaScript path.
 *
 * A `<form action={…}>` in a server component is handed only the FormData, while the
 * enhanced session uses `useActionState` and needs the (prev, formData) shape. Two
 * thin entry points onto the same logic is the honest way to serve both; wrapping
 * either in a client closure would stop React emitting the hidden action fields.
 */
export async function gradeCardFormAction(formData: FormData): Promise<void> {
  await gradeCardAction({ ok: true }, formData);
}

export async function suspendCardFormAction(formData: FormData): Promise<void> {
  await suspendCardAction({ ok: true }, formData);
}
