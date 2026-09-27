import "server-only";

import { prisma } from "@/lib/db/prisma";
import { accumulateSeconds } from "@/lib/learn/time";
import type { ProgressState } from "@/generated/prisma/enums";

/**
 * Reading and writing where a student has got to.
 *
 * One rule shapes this whole file: **nothing is written on a GET**. Opening a lesson
 * creates no row. Progress appears the first time a student actually does something —
 * answers a check, presses continue — which keeps page renders free of side effects and
 * means a lesson someone opened and immediately closed is not reported back to them as
 * "in progress". The cost is that the row has to be created lazily by every writer, which
 * is what `upsert` is for.
 */

export type LessonCheckState = {
  blockIndex: number;
  chosenKey: string;
  correct: boolean;
  firstCorrect: boolean;
  attempts: number;
};

export type LessonState = {
  lastBlockIndex: number;
  state: ProgressState;
  completed: boolean;
  totalSeconds: number;
  startedAt: Date | null;
  completedAt: Date | null;
  /** Answered checks, keyed by the block index they sit at. */
  checks: Map<number, LessonCheckState>;
};

const EMPTY_STATE: Omit<LessonState, "checks"> = {
  lastBlockIndex: 0,
  state: "NOT_STARTED",
  completed: false,
  totalSeconds: 0,
  startedAt: null,
  completedAt: null,
};

export async function getLessonState(userId: string, lessonId: string): Promise<LessonState> {
  const [progress, checks] = await Promise.all([
    prisma.lessonProgress.findUnique({ where: { userId_lessonId: { userId, lessonId } } }),
    prisma.lessonCheckAttempt.findMany({
      where: { userId, lessonId },
      select: {
        blockIndex: true,
        chosenKey: true,
        correct: true,
        firstCorrect: true,
        attempts: true,
      },
    }),
  ]);

  return {
    ...(progress
      ? {
          lastBlockIndex: progress.lastBlockIndex,
          state: progress.state,
          completed: progress.state === "COMPLETED",
          totalSeconds: progress.totalSeconds,
          startedAt: progress.startedAt,
          completedAt: progress.completedAt,
        }
      : EMPTY_STATE),
    checks: new Map(checks.map((check) => [check.blockIndex, check])),
  };
}

/** Progress for several lessons at once, for the lesson list and the Learn index. */
export async function getProgressForLessons(userId: string, lessonIds: string[]) {
  if (lessonIds.length === 0)
    return new Map<string, { state: ProgressState; percent: number }>();

  const rows = await prisma.lessonProgress.findMany({
    where: { userId, lessonId: { in: lessonIds } },
    select: { lessonId: true, state: true, lastBlockIndex: true },
  });

  return new Map(
    rows.map((row) => [
      row.lessonId,
      { state: row.state, percent: row.state === "COMPLETED" ? 100 : 0 },
    ]),
  );
}

/**
 * Moves a student forward, never backwards.
 *
 * Re-submitting the same continue button — a double click, a bfcache replay, a refresh
 * on the POST — must not rewind anyone, so the saved index only ever increases. Time is
 * added every call, because the student really did spend that time on the page, and the
 * caller has already clamped it.
 */
export async function advanceProgress(
  userId: string,
  lessonId: string,
  toBlockIndex: number,
  stepSeconds: number,
  options: { complete?: boolean } = {},
) {
  const now = new Date();
  const existing = await prisma.lessonProgress.findUnique({
    where: { userId_lessonId: { userId, lessonId } },
  });

  const lastBlockIndex = Math.max(existing?.lastBlockIndex ?? 0, toBlockIndex);
  const completed = options.complete === true || existing?.state === "COMPLETED";

  return prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    create: {
      userId,
      lessonId,
      lastBlockIndex,
      state: completed ? "COMPLETED" : "IN_PROGRESS",
      totalSeconds: accumulateSeconds(0, stepSeconds),
      startedAt: now,
      lastActivityAt: now,
      completedAt: completed ? now : null,
    },
    update: {
      lastBlockIndex,
      state: completed ? "COMPLETED" : "IN_PROGRESS",
      totalSeconds: accumulateSeconds(existing?.totalSeconds ?? 0, stepSeconds),
      lastActivityAt: now,
      // Keep the first completion time. Re-reading a finished lesson is not a second
      // completion, and overwriting it would corrupt any later "when did you learn this".
      completedAt: completed ? (existing?.completedAt ?? now) : null,
    },
  });
}

/**
 * Records an answer to an inline check.
 *
 * The first attempt is kept separately from the latest one. Only the first says anything
 * about what the student knew — after they have seen the explanation, a correct answer is
 * recall of the last thirty seconds — and it is the first that a mastery estimate will
 * eventually want.
 */
export async function recordCheckAnswer(
  userId: string,
  lessonId: string,
  blockIndex: number,
  chosenKey: string,
  correct: boolean,
) {
  return prisma.lessonCheckAttempt.upsert({
    where: { userId_lessonId_blockIndex: { userId, lessonId, blockIndex } },
    create: { userId, lessonId, blockIndex, chosenKey, correct, firstCorrect: correct },
    update: { chosenKey, correct, attempts: { increment: 1 } },
  });
}

/** Lessons a student has started but not finished, newest first. */
export async function getResumableLessons(userId: string, limit = 3) {
  return prisma.lessonProgress.findMany({
    where: { userId, state: "IN_PROGRESS" },
    orderBy: { lastActivityAt: "desc" },
    take: limit,
    include: {
      lesson: {
        select: {
          id: true,
          slug: true,
          title: true,
          estMinutes: true,
          subTopic: {
            select: { code: true, title: true, topic: { select: { subjectId: true } } },
          },
        },
      },
    },
  });
}
