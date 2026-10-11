import "server-only";

/**
 * Everything the planner needs, read once (doc 05 §1).
 *
 * The engine is pure, so this is the only place that touches the database on the way
 * in. Keeping the read in one function also keeps it honest about cost: one pass,
 * no per-candidate queries hiding inside the scoring loop.
 */

import { startOfUtcDay } from "@/lib/ai/usage";
import { subjectSlugFromId } from "@/lib/content/queries";
import { prisma } from "@/lib/db/prisma";
import { periodFor, type PeriodRow } from "@/lib/today/calendar";
import { LEARNING_NOW_DAYS, ALGO_VERSION } from "@/lib/today/weights";
import type {
  CalendarPeriod,
  ContentSubTopic,
  PlannerInput,
  RagEntry,
  TierChoice,
} from "@/lib/today/types";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Which calendar period today falls in (D24).
 *
 * A stored `TermPeriod` wins when the student has one — they know their school's
 * dates and we do not. An exam still overrides everything: sitting a paper today is
 * what today *is*, whatever the calendar says about term.
 */
export function inferCalendarPeriod(
  now: Date,
  examDates: Array<{ date: Date; paper: number; subjectId: string }>,
  periods: PeriodRow[] = [],
): CalendarPeriod {
  const upcoming = examDates
    .filter((exam) => exam.date.getTime() >= startOfUtcDay(now).getTime())
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const today = startOfUtcDay(now).getTime();
  const examToday = examDates.find((exam) => startOfUtcDay(exam.date).getTime() === today);

  if (examToday) {
    return {
      kind: "EXAM_SEASON",
      endDate: upcoming[upcoming.length - 1]?.date ?? now,
      examToday: { subjectId: examToday.subjectId, paper: examToday.paper },
    };
  }

  const stored = periodFor(now, periods);
  if (stored) {
    return {
      kind: stored.kind,
      endDate: stored.endDate,
      minutesPerDay: stored.minutesPerDay ?? undefined,
      examToday: null,
    };
  }

  const first = upcoming[0];
  if (first && first.date.getTime() - now.getTime() <= 21 * DAY_MS) {
    return {
      kind: "EXAM_SEASON",
      endDate: upcoming[upcoming.length - 1]!.date,
      examToday: null,
    };
  }

  return { kind: "TERM", endDate: new Date(now.getTime() + 60 * DAY_MS), examToday: null };
}

export async function buildSnapshot(
  userId: string,
  now: Date,
  override?: number | null,
): Promise<PlannerInput | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { createdAt: true, profile: true },
  });
  if (!user?.profile) return null;

  const profile = user.profile;

  const enrolmentRows = await prisma.subjectEnrolment.findMany({
    where: { userId, active: true },
    select: { subjectId: true, tier: true, subject: { select: { id: true, name: true } } },
  });
  if (enrolmentRows.length === 0) return null;

  const subjectIds = enrolmentRows.map((row) => row.subjectId);

  const [
    examRows,
    subTopicRows,
    ragRows,
    masteryRows,
    flagRows,
    periodRows,
    testRows,
    cardRows,
    lessonRows,
    history,
  ] = await Promise.all([
    prisma.examDate.findMany({
      where: { enrolment: { userId, subjectId: { in: subjectIds } } },
      select: {
        paper: true,
        date: true,
        confirmed: true,
        enrolment: { select: { subjectId: true } },
      },
    }),
    prisma.subTopic.findMany({
      where: { topic: { subjectId: { in: subjectIds } } },
      select: {
        id: true,
        code: true,
        title: true,
        topicId: true,
        topic: { select: { subjectId: true, paper: true } },
      },
      orderBy: { code: "asc" },
    }),
    prisma.ragRating.findMany({
      where: { userId },
      select: { scope: true, topicId: true, subTopicId: true, value: true },
    }),
    prisma.specPointMastery.findMany({
      where: { userId },
      select: { specPointId: true, mastery: true, attempts: true, lastSeenAt: true },
    }),
    prisma.learningNowFlag.findMany({
      where: { userId, expiresAt: { gt: now } },
      select: { subTopicId: true, expiresAt: true },
    }),
    prisma.termPeriod.findMany({
      where: { userId },
      select: { kind: true, startDate: true, endDate: true, minutesPerDay: true, label: true },
    }),
    prisma.schoolTest.findMany({
      where: { userId, date: { gte: startOfUtcDay(now) } },
      select: { id: true, subjectId: true, date: true, kind: true, subTopicIds: true },
    }),
    prisma.flashcard.findMany({
      where: { userId, retiredAt: null, suspendedAt: null, due: { lte: now } },
      select: { due: true, specPointId: true },
    }),
    prisma.lessonProgress.findMany({
      where: { userId, state: "COMPLETED" },
      select: { lessonId: true },
    }),
    prisma.planTask.findMany({
      where: {
        plan: { userId, planDate: { gte: new Date(now.getTime() - 14 * DAY_MS) } },
      },
      select: {
        type: true,
        status: true,
        subTopicId: true,
        subjectId: true,
        estMinutes: true,
        actualMinutes: true,
        completedAt: true,
        plan: { select: { planDate: true } },
      },
      take: 200,
    }),
  ]);

  const subTopicIds = subTopicRows.map((row) => row.id);

  const [lessons, notes, blurts, questions, practicals, specPoints] = await Promise.all([
    prisma.lesson.findMany({
      where: { subTopicId: { in: subTopicIds } },
      select: { id: true, slug: true, subTopicId: true, estMinutes: true, tier: true },
      orderBy: { order: "asc" },
    }),
    prisma.noteSection.findMany({
      where: { subTopicId: { in: subTopicIds } },
      select: { id: true, subTopicId: true, slug: true },
      orderBy: { order: "asc" },
    }),
    prisma.blurtPrompt.findMany({
      where: { subTopicId: { in: subTopicIds } },
      select: { id: true, subTopicId: true, estMinutes: true },
      orderBy: { order: "asc" },
    }),
    prisma.question.findMany({
      where: { primarySubTopicId: { in: subTopicIds }, retired: false },
      select: {
        id: true,
        primarySubTopicId: true,
        marks: true,
        difficulty: true,
        estSeconds: true,
        tier: true,
        specPoints: { select: { specPointId: true } },
      },
    }),
    prisma.practical.findMany({
      where: { subjectId: { in: subjectIds } },
      select: { id: true, number: true, subTopicIds: true },
    }),
    prisma.specPoint.findMany({
      where: { subTopicId: { in: subTopicIds } },
      select: { id: true, subTopicId: true },
    }),
  ]);

  const contentSubTopics: ContentSubTopic[] = subTopicRows.map((row) => {
    const mine = <T extends { subTopicId: string }>(items: T[]) =>
      items.filter((item) => item.subTopicId === row.id);

    const points = mine(specPoints).map((point) => point.id);

    return {
      id: row.id,
      subjectId: row.topic.subjectId,
      code: row.code,
      title: row.title,
      paper: row.topic.paper ?? 1,
      lessons: mine(lessons).map((lesson) => ({
        id: lesson.id,
        slug: lesson.slug,
        estMinutes: lesson.estMinutes ?? 20,
        higherOnly: lesson.tier === "HIGHER",
      })),
      noteSections: mine(notes).map((section) => ({
        anchor: section.slug,
        estMinutes: 6,
        specPointIds: points,
      })),
      blurtPrompts: mine(blurts).map((prompt) => ({
        id: prompt.id,
        estMinutes: prompt.estMinutes ?? 4,
      })),
      questions: questions
        .filter((question) => question.primarySubTopicId === row.id)
        .map((question) => ({
          id: question.id,
          marks: question.marks,
          difficulty: question.difficulty,
          estSeconds: question.estSeconds,
          higherOnly: question.tier === "HIGHER",
          specPointIds: question.specPoints.map((link) => link.specPointId),
        })),
      practicals: practicals
        .filter((practical) => practical.subTopicIds.includes(row.id))
        .map((practical) => ({ id: practical.id, number: practical.number, estMinutes: 20 })),
      specPointIds: points,
    };
  });

  const examDates = examRows.map((row) => ({
    subjectId: row.enrolment.subjectId,
    paper: row.paper,
    date: row.date,
    confirmed: row.confirmed,
  }));

  const rag: RagEntry[] = ragRows
    .map((row) => {
      const id = row.scope === "SUBTOPIC" ? row.subTopicId : row.topicId;
      return id ? { scope: row.scope as "TOPIC" | "SUBTOPIC", id, value: row.value } : null;
    })
    .filter((entry): entry is RagEntry => entry !== null);

  const bySubject: Record<string, number> = {};
  const specToSubject = new Map(
    specPoints.map((point) => [
      point.id,
      subTopicRows.find((row) => row.id === point.subTopicId)?.topic.subjectId ?? "",
    ]),
  );
  for (const card of cardRows) {
    const subjectId = specToSubject.get(card.specPointId) ?? "";
    bySubject[subjectId] = (bySubject[subjectId] ?? 0) + 1;
  }

  return {
    now,
    targetMinutes:
      override && override > 0
        ? Math.min(override, 600)
        : Math.max(5, profile.dailyGoalMinutes ?? 45),
    profile: {
      dailyGoalMinutes: profile.dailyGoalMinutes ?? 45,
      holidayGoalMinutes: profile.holidayGoalMinutes ?? profile.dailyGoalMinutes ?? 45,
      yearGroup: (profile.yearGroup ?? "OTHER") as PlannerInput["profile"]["yearGroup"],
      timezone: profile.timezone ?? "Europe/London",
      schedulingEnabled: profile.schedulingEnabled ?? true,
    },
    calendarPeriod: inferCalendarPeriod(now, examDates, periodRows),
    schoolTests: testRows.map((row) => ({
      id: row.id,
      subjectId: row.subjectId,
      date: row.date,
      kind: row.kind,
      subTopicIds: row.subTopicIds,
    })),
    enrolments: enrolmentRows.map((row) => ({
      subjectId: row.subjectId,
      subjectName: row.subject.name,
      subjectSlug: subjectSlugFromId(row.subjectId),
      tier: (row.tier ?? "UNSURE") as TierChoice,
      examDates: examDates
        .filter((exam) => exam.subjectId === row.subjectId)
        .map((exam) => ({ paper: exam.paper, date: exam.date, confirmed: exam.confirmed })),
    })),
    rag,
    learningNow: flagRows.map((row) => ({
      subTopicId: row.subTopicId,
      expiresAt: row.expiresAt,
    })),
    mastery: masteryRows.map((row) => ({
      specPointId: row.specPointId,
      mastery: row.mastery,
      // Confidence grows with evidence: one attempt is not a measurement.
      confidence: Math.min(1, row.attempts / 3),
      lastTouchedAt: row.lastSeenAt,
    })),
    dueCards: {
      total: cardRows.length,
      overdueDays: cardRows.map((card) =>
        Math.max(0, Math.floor((now.getTime() - card.due.getTime()) / DAY_MS)),
      ),
      bySubject,
    },
    contentIndex: { subTopics: contentSubTopics },
    completedLessonIds: lessonRows.map((row) => row.lessonId),
    recentHistory: history.map((task) => ({
      date: task.completedAt ?? task.plan.planDate,
      taskType: task.type as PlannerInput["recentHistory"][number]["taskType"],
      subTopicId: task.subTopicId ?? undefined,
      subjectId: task.subjectId ?? undefined,
      status: task.status,
      estMinutes: task.estMinutes,
      actualMinutes: task.actualMinutes ?? undefined,
    })),
    accountAgeDays: Math.floor((now.getTime() - user.createdAt.getTime()) / DAY_MS),
    gateShutDays: 0,
    algoVersion: ALGO_VERSION,
  };
}

export { LEARNING_NOW_DAYS };
