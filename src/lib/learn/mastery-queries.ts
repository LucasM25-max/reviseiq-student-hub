import "server-only";

import { prisma } from "@/lib/db/prisma";
import { markPointSchema, numericAnswerSchema } from "@/lib/content/schema";
import type { MarkPoint, NumericAnswer } from "@/lib/content/schema";
import { autoMark, clampSelfMark, type MarkOutcome } from "@/lib/marking/auto";
import { selectMasteryQuestions, type MasteryCandidate } from "@/lib/learn/mastery";

/**
 * Database side of the mastery check.
 *
 * The questions come out of the same `Question` table the Test section will serve, joined
 * to the real `MarkScheme`. There is no lesson-specific question store and there will not
 * be one: a student who meets a question here and again in a mock is meeting the same
 * question, with the same mark scheme, and any improvement between the two is real.
 */

export type MasteryQuestion = {
  id: string;
  type: string;
  marks: number;
  commandWord: string;
  ao: string;
  stem: string;
  options: { key: string; text: string }[] | null;
  correctKey: string | null;
  assets: {
    diagramId?: string;
    diagramLetters?: string[];
    figureCaption?: string;
    dataTable?: { headers: string[]; rows: string[][] };
  } | null;
  markScheme: {
    points: MarkPoint[];
    guidance?: string;
    ecfRules?: string;
    modelAnswer?: string;
    numericAnswer?: NumericAnswer;
  } | null;
};

/** JSON columns come back as `unknown`; re-parse them with the schema that wrote them. */
function parseMarkScheme(row: {
  points: unknown;
  guidance: string | null;
  ecfRules: string | null;
  modelAnswer: string | null;
  numericAnswer: unknown;
}): MasteryQuestion["markScheme"] {
  const points = markPointSchema.array().safeParse(row.points);
  if (!points.success) return null;

  const numeric = row.numericAnswer
    ? numericAnswerSchema.safeParse(row.numericAnswer)
    : undefined;

  return {
    points: points.data,
    guidance: row.guidance ?? undefined,
    ecfRules: row.ecfRules ?? undefined,
    modelAnswer: row.modelAnswer ?? undefined,
    numericAnswer: numeric?.success ? numeric.data : undefined,
  };
}

const OPTION_SHAPE = (value: unknown): { key: string; text: string }[] | null => {
  if (!Array.isArray(value)) return null;
  const options = value.flatMap((entry) =>
    entry &&
    typeof entry === "object" &&
    typeof (entry as { key?: unknown }).key === "string" &&
    typeof (entry as { text?: unknown }).text === "string"
      ? [{ key: (entry as { key: string }).key, text: (entry as { text: string }).text }]
      : [],
  );
  return options.length > 0 ? options : null;
};

export async function getQuestionsByIds(ids: string[]): Promise<MasteryQuestion[]> {
  if (ids.length === 0) return [];

  const rows = await prisma.question.findMany({
    where: { id: { in: ids } },
    include: { markScheme: true },
  });

  const byId = new Map(
    rows.map((row) => [
      row.id,
      {
        id: row.id,
        type: row.type,
        marks: row.marks,
        commandWord: row.commandWord,
        ao: row.ao,
        stem: row.stem,
        options: OPTION_SHAPE(row.options),
        correctKey: row.correctKey,
        assets: (row.assets ?? null) as MasteryQuestion["assets"],
        markScheme: row.markScheme ? parseMarkScheme(row.markScheme) : null,
      } satisfies MasteryQuestion,
    ]),
  );

  // Preserve the order the set was snapshotted in, not whatever Postgres returned.
  return ids.flatMap((id) => {
    const question = byId.get(id);
    return question ? [question] : [];
  });
}

/** Candidate questions for a lesson, as the pure selector wants them. */
export async function getMasteryCandidates(
  subTopicId: string,
  specPoints: string[],
): Promise<MasteryCandidate[]> {
  if (specPoints.length === 0) return [];

  const rows = await prisma.question.findMany({
    where: {
      retired: false,
      primarySubTopicId: subTopicId,
      specPoints: { some: { specPointId: { in: specPoints } } },
    },
    select: {
      id: true,
      marks: true,
      difficulty: true,
      type: true,
      specPoints: { select: { specPointId: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    marks: row.marks,
    difficulty: row.difficulty,
    type: row.type,
    specPoints: row.specPoints.map((link) => link.specPointId),
  }));
}

/**
 * The run a student is currently on, or null.
 *
 * "Currently on" means the most recent run for this lesson that has not been marked yet.
 * Finished runs are kept — the point of recording an attempt is being able to look at it
 * later — so a retake creates a new row rather than overwriting the last one.
 */
export async function getOpenRun(userId: string, lessonId: string) {
  return prisma.questionSet.findFirst({
    where: { userId, lessonId, reason: MASTERY_REASON, completedAt: null },
    orderBy: { createdAt: "desc" },
    include: { attempts: true },
  });
}

export async function getRun(userId: string, setId: string) {
  return prisma.questionSet.findFirst({
    where: { id: setId, userId },
    include: { attempts: true },
  });
}

export async function getLatestCompletedRun(userId: string, lessonId: string) {
  return prisma.questionSet.findFirst({
    where: { userId, lessonId, reason: MASTERY_REASON, completedAt: { not: null } },
    orderBy: { completedAt: "desc" },
    include: { attempts: true },
  });
}

export const MASTERY_REASON = "mastery-check";

/** Creates a run from the deterministic selection for a lesson. */
export async function createMasteryRun(
  userId: string,
  lessonId: string,
  subTopicId: string,
  specPoints: string[],
) {
  const candidates = await getMasteryCandidates(subTopicId, specPoints);
  const selection = selectMasteryQuestions(specPoints, candidates);

  if (selection.questionIds.length === 0) return null;

  return prisma.questionSet.create({
    data: {
      userId,
      lessonId,
      reason: MASTERY_REASON,
      questionIds: selection.questionIds,
    },
  });
}

export type SubmittedAnswer = {
  questionId: string;
  answerKey?: string | null;
  answerText?: string | null;
};

/**
 * Writes the answers and everything that can be marked without a language model.
 *
 * Each attempt is upserted on `(setId, questionId)` so a resubmitted form — a double
 * click, a back-button replay — updates one row instead of creating a second.
 */
export async function recordMasteryAnswers(
  userId: string,
  set: { id: string; questionIds: string[] },
  questions: MasteryQuestion[],
  answers: SubmittedAnswer[],
  durationSec: number,
) {
  const byId = new Map(questions.map((question) => [question.id, question]));
  const answerById = new Map(answers.map((answer) => [answer.questionId, answer]));

  const outcomes: { questionId: string; outcome: MarkOutcome }[] = [];

  // Sequential rather than Promise.all: these are upserts on the same unique index, and
  // the same lesson opened twice would otherwise race for the same row.
  for (const questionId of set.questionIds) {
    const question = byId.get(questionId);
    if (!question) continue;

    const answer: Omit<SubmittedAnswer, "questionId"> = answerById.get(questionId) ?? {};
    const outcome = autoMark(
      {
        id: question.id,
        type: question.type,
        marks: question.marks,
        correctKey: question.correctKey,
      },
      { answerKey: answer.answerKey, answerText: answer.answerText },
      question.markScheme?.numericAnswer ?? null,
    );
    outcomes.push({ questionId, outcome });

    await prisma.questionAttempt.upsert({
      where: { setId_questionId: { setId: set.id, questionId } },
      create: {
        userId,
        questionId,
        setId: set.id,
        context: "MASTERY_CHECK",
        answerKey: answer.answerKey ?? null,
        answerText: answer.answerText ?? null,
        awardedMarks: outcome.awardedMarks,
        maxMarks: question.marks,
        markedBy: outcome.markedBy,
        markDetail: outcome.detail,
        durationSec,
      },
      update: {
        answerKey: answer.answerKey ?? null,
        answerText: answer.answerText ?? null,
        awardedMarks: outcome.awardedMarks,
        markedBy: outcome.markedBy,
        markDetail: outcome.detail,
        durationSec,
      },
    });
  }

  await prisma.questionSet.update({
    where: { id: set.id },
    data: {
      answeredAt: new Date(),
      // A run with nothing left to self-mark is finished the moment it is answered.
      completedAt: outcomes.every(({ outcome }) => !outcome.needsSelfMark) ? new Date() : null,
    },
  });

  return outcomes;
}

/**
 * Applies the marks a student awarded themselves and closes the run.
 *
 * Ownership is re-checked here and every mark is re-clamped here, even though the action
 * that calls it does both. The caller is one `await` away from being wrong, and the cost
 * of being sure is a single indexed read — whereas the cost of being wrong is a student
 * writing marks into somebody else's attempt.
 */
export async function recordSelfMarks(
  userId: string,
  setId: string,
  marks: { questionId: string; awardedMarks: number }[],
) {
  const set = await prisma.questionSet.findFirst({
    where: { id: setId, userId },
    include: { attempts: true },
  });
  if (!set) return null;

  const byQuestion = new Map(marks.map((mark) => [mark.questionId, mark.awardedMarks]));

  for (const attempt of set.attempts) {
    // Only ever overwrite a mark the student is responsible for. An auto-marked answer
    // is not theirs to revise.
    if (attempt.markedBy !== "SELF") continue;

    const raw = byQuestion.get(attempt.questionId);
    if (raw === undefined) continue;

    await prisma.questionAttempt.update({
      where: { id: attempt.id },
      data: { awardedMarks: clampSelfMark(raw, attempt.maxMarks) },
    });
  }

  return prisma.questionSet.update({
    where: { id: setId },
    data: { completedAt: new Date() },
  });
}
