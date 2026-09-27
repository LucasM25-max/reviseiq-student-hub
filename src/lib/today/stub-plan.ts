import "server-only";

import type { RagValue } from "@/generated/prisma/enums";
import { daysUntil } from "@/lib/curriculum/exam-dates";
import { prisma } from "@/lib/db/prisma";

/**
 * A placeholder Today.
 *
 * The real scheduler is Phase 7 (docs/plan/05-today-engine.md) and needs lessons, notes,
 * questions and FSRS cards to schedule — none of which exist yet. What this does instead
 * is take the student's *actual* RAG ratings, exam dates and availability and lay out the
 * shape of a day, so the shell is complete and the data collected during onboarding is
 * visibly doing something.
 *
 * Everything it returns is labelled as not-yet-buildable in the UI. It deliberately
 * shares no code with the real engine, so there is nothing here to mistake for it later.
 */

export type StubTask = {
  id: string;
  kind: "LEARN" | "REVISE" | "TEST";
  subject: string;
  accent: string;
  title: string;
  detail: string;
  minutes: number;
  /** The phase that will make this task real. */
  availableIn: string;
};

export type TodaySummary = {
  greeting: string;
  minutesAvailableToday: number;
  dailyGoalMinutes: number;
  streakCurrent: number;
  subjects: {
    id: string;
    name: string;
    accent: string;
    counts: Record<RagValue, number>;
    total: number;
    firstPaperInDays: number | null;
  }[];
  tasks: StubTask[];
  nextExamInDays: number | null;
};

const PRIORITY: RagValue[] = ["RED", "AMBER", "NOT_LEARNT", "GREEN"];

export async function getTodaySummary(userId: string, now = new Date()): Promise<TodaySummary> {
  const [profile, enrolments, ratings, availability] = await Promise.all([
    prisma.studentProfile.findUnique({ where: { userId } }),
    prisma.subjectEnrolment.findMany({
      where: { userId, active: true },
      include: {
        subject: { include: { topics: { orderBy: { order: "asc" } } } },
        examDates: { orderBy: { date: "asc" } },
      },
      orderBy: { subject: { order: "asc" } },
    }),
    prisma.ragRating.findMany({
      where: { userId, scope: "TOPIC" },
      select: { topicId: true, value: true },
    }),
    prisma.availabilitySlot.findMany({ where: { userId } }),
  ]);

  const ratingByTopic = new Map<string, RagValue>();
  for (const rating of ratings) {
    if (rating.topicId) ratingByTopic.set(rating.topicId, rating.value);
  }

  const todayMinutes = availability.find((slot) => slot.weekday === now.getDay())?.minutes ?? 0;

  const subjects = enrolments.map((enrolment) => {
    const counts: Record<RagValue, number> = { NOT_LEARNT: 0, RED: 0, AMBER: 0, GREEN: 0 };

    for (const topic of enrolment.subject.topics) {
      const value = ratingByTopic.get(topic.id);
      if (value) counts[value] += 1;
    }

    const firstPaper = enrolment.examDates[0];

    return {
      id: enrolment.subject.id,
      name: enrolment.subject.name,
      accent: enrolment.subject.accent,
      counts,
      total: enrolment.subject.topics.length,
      firstPaperInDays: firstPaper ? daysUntil(firstPaper.date, now) : null,
    };
  });

  const examDays = subjects
    .map((subject) => subject.firstPaperInDays)
    .filter((days): days is number => days !== null && days >= 0);

  // Pick the highest-priority unrated-or-weak topic from each subject, round-robin.
  const candidates = enrolments.flatMap((enrolment) =>
    enrolment.subject.topics.map((topic) => ({
      topic,
      subject: enrolment.subject,
      value: ratingByTopic.get(topic.id) ?? "NOT_LEARNT",
    })),
  );

  candidates.sort((a, b) => PRIORITY.indexOf(a.value) - PRIORITY.indexOf(b.value));

  const tasks: StubTask[] = [];
  const usedSubjects = new Set<string>();

  for (const candidate of candidates) {
    if (tasks.length >= 3) break;
    // One per subject, so a student with three subjects sees all three represented.
    if (usedSubjects.has(candidate.subject.id)) continue;
    usedSubjects.add(candidate.subject.id);

    tasks.push(buildTask(candidate.value, candidate.subject, candidate.topic));
  }

  return {
    greeting: greetingFor(now),
    minutesAvailableToday: todayMinutes,
    dailyGoalMinutes: profile?.dailyGoalMinutes ?? 30,
    streakCurrent: profile?.streakCurrent ?? 0,
    subjects,
    tasks,
    nextExamInDays: examDays.length > 0 ? Math.min(...examDays) : null,
  };
}

function buildTask(
  value: RagValue,
  subject: { id: string; name: string; accent: string },
  topic: { id: string; code: string; title: string },
): StubTask {
  const base = {
    subject: subject.name,
    accent: subject.accent,
    id: `${subject.id}:${topic.id}`,
  };

  switch (value) {
    case "NOT_LEARNT":
      return {
        ...base,
        kind: "LEARN",
        title: `Learn ${topic.title}`,
        detail: `${topic.code} — you haven't covered this yet`,
        minutes: 20,
        availableIn: "Phase 4",
      };
    case "RED":
      return {
        ...base,
        kind: "REVISE",
        title: `Revise ${topic.title}`,
        detail: `${topic.code} — rated red, so it goes first`,
        minutes: 15,
        availableIn: "Phase 6",
      };
    case "AMBER":
      return {
        ...base,
        kind: "TEST",
        title: `5 exam questions on ${topic.title}`,
        detail: `${topic.code} — amber, closing the gaps`,
        minutes: 12,
        availableIn: "Phase 5",
      };
    default:
      return {
        ...base,
        kind: "TEST",
        title: `2 exam questions on ${topic.title}`,
        detail: `${topic.code} — green, just keeping it warm`,
        minutes: 6,
        availableIn: "Phase 5",
      };
  }
}

function greetingFor(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return "Morning";
  if (hour < 18) return "Afternoon";
  return "Evening";
}
