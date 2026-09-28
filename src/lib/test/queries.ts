import "server-only";

/**
 * Reads for practice mode.
 *
 * A practice run is a `QuestionSet` snapshot: the ids are fixed when the run starts,
 * so adding or retiring a question never changes a run already in progress, and the
 * same set can be resumed days later and still be the same paper.
 */

import { subjectSlugFromId } from "@/lib/content/queries";
import { prisma } from "@/lib/db/prisma";
import type { MarkResult } from "@/lib/ai/types";

export const PRACTICE_REASON = "practice";
export const PRACTICE_SIZE = 5;

export type PracticeTopic = {
  subTopicId: string;
  code: string;
  title: string;
  subjectId: string;
  subjectName: string;
  subjectSlug: string;
  questionCount: number;
  marksAvailable: number;
  /** 0–1, averaged over the spec points this student has attempted. Null if never. */
  mastery: number | null;
};

/** Sub-topics with enough questions to practise, for the subjects a student takes. */
export async function practiceTopicsFor(userId: string): Promise<PracticeTopic[]> {
  const enrolments = await prisma.subjectEnrolment.findMany({
    where: { userId, active: true },
    select: { subjectId: true },
  });
  const subjectIds = enrolments.map((row) => row.subjectId);
  if (subjectIds.length === 0) return [];

  const subTopics = await prisma.subTopic.findMany({
    where: { topic: { subjectId: { in: subjectIds } } },
    select: {
      id: true,
      code: true,
      title: true,
      topicId: true,
      specPoints: { select: { id: true } },
    },
    orderBy: { code: "asc" },
  });

  // Counted in the database rather than by loading every question row.
  const questionStats = await prisma.question.groupBy({
    by: ["primarySubTopicId"],
    where: { retired: false, subjectId: { in: subjectIds } },
    _count: { _all: true },
    _sum: { marks: true },
  });

  const statsBySubTopic = new Map(
    questionStats.map((row) => [
      row.primarySubTopicId,
      { count: row._count._all, marks: row._sum.marks ?? 0 },
    ]),
  );

  // Fetched flat rather than as a nested select: two levels of relation select do not
  // survive type inference in the generated client, and silently widen to scalars.
  const topics = await prisma.topic.findMany({
    where: { id: { in: subTopics.map((subTopic) => subTopic.topicId) } },
    select: { id: true, subjectId: true },
  });
  const subjects = await prisma.subject.findMany({
    where: { id: { in: subjectIds } },
    select: { id: true, name: true },
  });

  const subjectByTopic = new Map(topics.map((topic) => [topic.id, topic.subjectId]));
  const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));

  const specPointIds = subTopics.flatMap((subTopic) => subTopic.specPoints.map((sp) => sp.id));

  const mastery =
    specPointIds.length === 0
      ? []
      : await prisma.specPointMastery.findMany({
          where: { userId, specPointId: { in: specPointIds } },
          select: { specPointId: true, mastery: true },
        });

  const masteryById = new Map(mastery.map((row) => [row.specPointId, row.mastery]));

  return subTopics
    .filter((subTopic) => (statsBySubTopic.get(subTopic.id)?.count ?? 0) > 0)
    .map((subTopic) => {
      const stats = statsBySubTopic.get(subTopic.id) ?? { count: 0, marks: 0 };
      const subject = subjectById.get(subjectByTopic.get(subTopic.topicId) ?? "");
      const seen = subTopic.specPoints
        .map((sp) => masteryById.get(sp.id))
        .filter((value): value is number => value !== undefined);

      return {
        subTopicId: subTopic.id,
        code: subTopic.code,
        title: subTopic.title,
        subjectId: subject?.id ?? "",
        subjectName: subject?.name ?? "",
        subjectSlug: subject ? subjectSlugFromId(subject.id) : "",
        questionCount: stats.count,
        marksAvailable: stats.marks,
        mastery:
          seen.length === 0 ? null : seen.reduce((sum, value) => sum + value, 0) / seen.length,
      };
    });
}

export type PracticeQuestion = {
  id: string;
  type: string;
  marks: number;
  commandWord: string;
  stem: string;
  assets: unknown;
  options: unknown;
  attempt: {
    id: string;
    answerText: string | null;
    answerKey: string | null;
    awardedMarks: number;
    maxMarks: number;
    markedBy: string;
    disputed: boolean;
    result: MarkResult | null;
  } | null;
};

export type PracticeRun = {
  id: string;
  createdAt: Date;
  completedAt: Date | null;
  questions: PracticeQuestion[];
  answered: number;
  awarded: number;
  available: number;
};

/** Loads a run, scoped to its owner. Returns null for anyone else's. */
export async function practiceRunFor(
  userId: string,
  setId: string,
): Promise<PracticeRun | null> {
  const set = await prisma.questionSet.findFirst({
    where: { id: setId, userId },
    select: { id: true, questionIds: true, createdAt: true, completedAt: true },
  });
  if (!set) return null;

  const [questions, attempts] = await Promise.all([
    prisma.question.findMany({
      where: { id: { in: set.questionIds } },
      select: {
        id: true,
        type: true,
        marks: true,
        commandWord: true,
        stem: true,
        assets: true,
        options: true,
      },
    }),
    prisma.questionAttempt.findMany({
      where: { setId: set.id },
      select: {
        id: true,
        questionId: true,
        answerText: true,
        answerKey: true,
        awardedMarks: true,
        maxMarks: true,
        markedBy: true,
        disputed: true,
        markDetail: true,
      },
    }),
  ]);

  const byId = new Map(questions.map((question) => [question.id, question]));
  const attemptByQuestion = new Map(attempts.map((attempt) => [attempt.questionId, attempt]));

  // Snapshot order is the run's order, not the database's.
  const ordered = set.questionIds
    .map((id) => byId.get(id))
    .filter((question): question is NonNullable<typeof question> => question !== undefined);

  const resolved: PracticeQuestion[] = ordered.map((question) => {
    const attempt = attemptByQuestion.get(question.id);
    return {
      id: question.id,
      type: question.type,
      marks: question.marks,
      commandWord: question.commandWord,
      stem: question.stem,
      assets: question.assets,
      options: question.options,
      attempt: attempt
        ? {
            id: attempt.id,
            answerText: attempt.answerText,
            answerKey: attempt.answerKey,
            awardedMarks: attempt.awardedMarks,
            maxMarks: attempt.maxMarks,
            markedBy: attempt.markedBy,
            disputed: attempt.disputed,
            result: (attempt.markDetail as unknown as MarkResult | null) ?? null,
          }
        : null,
    };
  });

  return {
    id: set.id,
    createdAt: set.createdAt,
    completedAt: set.completedAt,
    questions: resolved,
    answered: resolved.filter((question) => question.attempt !== null).length,
    awarded: resolved.reduce((total, q) => total + (q.attempt?.awardedMarks ?? 0), 0),
    available: resolved.reduce((total, q) => total + q.marks, 0),
  };
}

/** The mark scheme and model answer, only ever loaded after an attempt exists. */
export async function reviewMaterialFor(questionId: string) {
  const scheme = await prisma.markScheme.findUnique({
    where: { questionId },
    select: { points: true, guidance: true, modelAnswer: true },
  });
  if (!scheme) return null;

  return {
    points: (Array.isArray(scheme.points) ? scheme.points : []) as Array<{
      id: string;
      text: string;
      marks: number;
    }>,
    guidance: scheme.guidance,
    modelAnswer: scheme.modelAnswer,
  };
}
