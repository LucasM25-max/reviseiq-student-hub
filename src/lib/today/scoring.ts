/**
 * Priority scoring (doc 05 §5).
 *
 * Each term is a separate exported function returning 0–1, so each can be tested on
 * its own and the dominant one can be named in the rationale. The weighted sum lives
 * in `scoreCandidate`.
 */

import { DAY_MS, daysUntil } from "@/lib/today/mode";
import { RAG_WEIGHT, SCHOOL_TEST_KIND_WEIGHT, W } from "@/lib/today/weights";
import type {
  Enrolment,
  HistoryEntry,
  MasteryEntry,
  RagValue,
  SchoolTest,
  TaskType,
} from "@/lib/today/types";

const clamp01 = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), 1);
};

export const ragWeight = (value: RagValue, gateOpen: boolean): number =>
  value === "NOT_LEARNT" && !gateOpen ? 0 : RAG_WEIGHT[value];

/**
 * How close the exam carrying this topic is.
 *
 * A topic on a paper sat in three weeks outranks the same topic on a paper sat in
 * June, which is the entire reason this term exists.
 */
export function examUrgency(
  enrolment: Enrolment | undefined,
  paper: number,
  now: Date,
): number {
  if (!enrolment) return 0;

  const relevant = enrolment.examDates
    .filter((exam) => exam.paper === paper && exam.date.getTime() >= now.getTime())
    .sort((a, b) => a.date.getTime() - b.date.getTime())[0];

  if (!relevant) return 0;

  return clamp01(1 - daysUntil(relevant.date, now) / 120);
}

/**
 * A GCSE in June is abstract; a Biology test on Friday is not (doc 05 §5a).
 *
 * Barely felt at a fortnight, dominant at two days, zero again the day after.
 */
export function schoolTestUrgency(
  subTopicId: string,
  tests: SchoolTest[],
  now: Date,
): { urgency: number; test: SchoolTest | null } {
  const relevant = tests
    .filter(
      (test) => test.subTopicIds.includes(subTopicId) && test.date.getTime() >= now.getTime(),
    )
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const nearest = relevant[0];
  if (!nearest) return { urgency: 0, test: null };

  const days = daysUntil(nearest.date, now);
  if (days > 14) return { urgency: 0, test: null };

  const ramp = Math.pow(1 - days / 14, 1.8);
  return { urgency: clamp01(ramp * SCHOOL_TEST_KIND_WEIGHT[nearest.kind]), test: nearest };
}

/**
 * Low mastery that we have evidence for.
 *
 * Weighted by confidence so unmeasured content scores low here and is picked up by
 * coverage debt instead — otherwise the app thrashes confidently on a single unlucky
 * attempt.
 */
export function masteryGap(specPointIds: string[], mastery: MasteryEntry[]): number {
  const relevant = mastery.filter((entry) => specPointIds.includes(entry.specPointId));
  if (relevant.length === 0) return 0;

  const total = relevant.reduce(
    (sum, entry) => sum + (1 - clamp01(entry.mastery)) * clamp01(entry.confidence),
    0,
  );

  return clamp01(total / relevant.length);
}

/** The FSRS intuition applied at spec-point level, not just to cards. */
export function forgettingRisk(
  specPointIds: string[],
  mastery: MasteryEntry[],
  now: Date,
): number {
  const touches = mastery
    .filter((entry) => specPointIds.includes(entry.specPointId))
    .map((entry) => entry.lastTouchedAt ?? entry.lastAttemptAt)
    .filter((date): date is Date => date instanceof Date);

  if (touches.length === 0) return 0;

  const mostRecent = Math.max(...touches.map((date) => date.getTime()));
  const days = Math.max(0, (now.getTime() - mostRecent) / DAY_MS);

  return clamp01(1 - Math.exp(-days / 21));
}

/**
 * Whole areas must not be silently ignored because there is no data on them.
 *
 * 1 for a sub-topic never assessed at all, decaying as attempts accumulate.
 */
export function coverageDebt(specPointIds: string[], mastery: MasteryEntry[]): number {
  if (specPointIds.length === 0) return 0;

  const seen = mastery.filter(
    (entry) => specPointIds.includes(entry.specPointId) && entry.confidence > 0,
  ).length;

  return clamp01(1 - seen / specPointIds.length);
}

export function cardOverdue(dueCards: { total: number; overdueDays: number[] }): number {
  const count = clamp01(dueCards.total / 20);
  const worst = dueCards.overdueDays.length === 0 ? 0 : Math.max(...dueCards.overdueDays);
  return clamp01(count + clamp01(worst / 7));
}

/** Rewards a task type and subject not used in the last two days. */
export function varietyBonus(
  type: TaskType,
  subjectId: string,
  history: HistoryEntry[],
  now: Date,
): number {
  const recent = history.filter((entry) => now.getTime() - entry.date.getTime() <= 2 * DAY_MS);
  if (recent.length === 0) return 1;

  const sameType = recent.some((entry) => entry.taskType === type);
  const sameSubject = recent.some((entry) => entry.subjectId === subjectId);

  return (sameType ? 0 : 0.5) + (sameSubject ? 0 : 0.5);
}

/**
 * The same sub-topic *and* task type within 48 hours is almost always wrong.
 *
 * Cards are the deliberate exception: they are supposed to recur, and penalising
 * them for it would break the whole point of spaced repetition.
 */
export function recencyPenalty(
  type: TaskType,
  subTopicId: string | undefined,
  history: HistoryEntry[],
  now: Date,
): number {
  if (type === "FLASHCARDS") return 0;

  const hit = history.find(
    (entry) =>
      entry.taskType === type &&
      entry.subTopicId === subTopicId &&
      subTopicId !== undefined &&
      now.getTime() - entry.date.getTime() <= 2 * DAY_MS,
  );

  return hit ? 1 : 0;
}

/** Penalty when one subject has taken more than 60% of the last week's minutes. */
export function subjectFatigue(subjectId: string, history: HistoryEntry[], now: Date): number {
  const week = history.filter((entry) => now.getTime() - entry.date.getTime() <= 7 * DAY_MS);

  const total = week.reduce(
    (sum, entry) => sum + (entry.actualMinutes ?? entry.estMinutes ?? 0),
    0,
  );
  if (total <= 0) return 0;

  const mine = week
    .filter((entry) => entry.subjectId === subjectId)
    .reduce((sum, entry) => sum + (entry.actualMinutes ?? entry.estMinutes ?? 0), 0);

  const share = mine / total;
  return share <= 0.6 ? 0 : clamp01((share - 0.6) / 0.4);
}

/** A task the student swapped away from in the last seven days. */
export function swapPenalty(
  type: TaskType,
  subTopicId: string | undefined,
  history: HistoryEntry[],
  now: Date,
): number {
  const hit = history.find(
    (entry) =>
      entry.status === "SWAPPED" &&
      entry.taskType === type &&
      entry.subTopicId === subTopicId &&
      now.getTime() - entry.date.getTime() <= 7 * DAY_MS,
  );

  return hit ? 1 : 0;
}

export type ScoreTerms = Record<string, number>;

/** The weighted sum. Terms are kept so the rationale can name the dominant one. */
export function combine(terms: ScoreTerms): number {
  return (
    W.rag * (terms.rag ?? 0) +
    W.urgency * (terms.urgency ?? 0) +
    W.schoolTest * (terms.schoolTest ?? 0) +
    W.masteryGap * (terms.masteryGap ?? 0) +
    W.forgettingRisk * (terms.forgettingRisk ?? 0) +
    W.coverageDebt * (terms.coverageDebt ?? 0) +
    W.cardOverdue * (terms.cardOverdue ?? 0) +
    W.variety * (terms.variety ?? 0) -
    W.recency * (terms.recency ?? 0) -
    W.fatigue * (terms.fatigue ?? 0) -
    W.swap * (terms.swap ?? 0)
  );
}

/** The term contributing most, for the rationale template (doc 05 §9). */
export function dominantTerm(terms: ScoreTerms): string {
  const weighted: Array<[string, number]> = [
    ["cardOverdue", W.cardOverdue * (terms.cardOverdue ?? 0)],
    ["schoolTest", W.schoolTest * (terms.schoolTest ?? 0)],
    ["rag", W.rag * (terms.rag ?? 0)],
    ["urgency", W.urgency * (terms.urgency ?? 0)],
    ["masteryGap", W.masteryGap * (terms.masteryGap ?? 0)],
    ["forgettingRisk", W.forgettingRisk * (terms.forgettingRisk ?? 0)],
    ["coverageDebt", W.coverageDebt * (terms.coverageDebt ?? 0)],
  ];

  weighted.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  return weighted[0]![1] > 0 ? weighted[0]![0] : "coverageDebt";
}
