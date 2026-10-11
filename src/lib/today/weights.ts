/**
 * Every tunable number in the scheduler, in one place (doc 05 §5).
 *
 * Kept together deliberately: these are the knobs that will be tuned against real
 * completion data later, and hunting them through eight modules is how a scheduler
 * becomes impossible to reason about.
 */

import type { PlanMode, RagValue, SchoolTestKind, TaskType } from "@/lib/today/types";

export const ALGO_VERSION = "today-v1";

/** Scoring weights. Roughly 0–100 once summed. */
export const W = {
  rag: 28,
  urgency: 18,
  schoolTest: 26,
  masteryGap: 16,
  forgettingRisk: 12,
  coverageDebt: 10,
  cardOverdue: 30,
  variety: 5,
  recency: 22,
  fatigue: 8,
  swap: 14,
} as const;

export const RAG_WEIGHT: Record<RagValue, number> = {
  RED: 1,
  AMBER: 0.6,
  GREEN: 0.2,
  NOT_LEARNT: 0.5,
};

/** Task mix targets per mode, as shares of the session (doc 05 §2). */
export const MODE_MIX: Record<PlanMode, Partial<Record<TaskType, number>>> = {
  KEEPING_PACE: { LESSON: 0.4, NOTES: 0.125, BLURT: 0.125, QUESTIONS: 0.25, FLASHCARDS: 0.1 },
  LEARNING_HEAVY: { LESSON: 0.45, NOTES: 0.1, BLURT: 0.1, QUESTIONS: 0.25, FLASHCARDS: 0.1 },
  BALANCED: { LESSON: 0.25, NOTES: 0.1, BLURT: 0.1, QUESTIONS: 0.4, FLASHCARDS: 0.15 },
  EXAM_FOCUS: {
    LESSON: 0.1,
    NOTES: 0.075,
    BLURT: 0.075,
    QUESTIONS: 0.5,
    FLASHCARDS: 0.15,
    MINI_MOCK: 0.1,
  },
  STUDY_LEAVE: { BLURT: 0.1, QUESTIONS: 0.55, FLASHCARDS: 0.2, MINI_MOCK: 0.15 },
  FINAL_SPRINT: { BLURT: 0.15, QUESTIONS: 0.55, FLASHCARDS: 0.2, MINI_MOCK: 0.1 },
};

/**
 * Modes where new lessons are suppressed entirely.
 *
 * Cramming new content in the last fortnight is a worse use of time than retrieval
 * practice on what is already partly known.
 */
export const NO_NEW_LESSONS: PlanMode[] = ["FINAL_SPRINT", "STUDY_LEAVE"];

export const SCHOOL_TEST_KIND_WEIGHT: Record<SchoolTestKind, number> = {
  CLASS_TEST: 0.7,
  END_OF_TOPIC: 0.85,
  SCHOOL_MOCK: 1,
};

/** A single class test must never eat the GCSE plan (doc 05 §5a). */
export const SCHOOL_TEST_SHARE = {
  farDays: 14,
  nearDays: 3,
  farShare: 0.4,
  nearShare: 0.6,
  mockShare: 0.8,
  /** Below this, a session is too short to guarantee a non-test task. */
  minMinutesForMixedSession: 20,
} as const;

export const PACKING = {
  maxTasks: 6,
  /** Allow a small overrun rather than leaving a twelve-minute hole. */
  overrun: 1.15,
  maxConsecutiveSameType: 2,
  /** Two subjects should appear once the session is long enough to hold them. */
  twoSubjectsFrom: 45,
  fullMockMinMinutes: 120,
  warmUpShare: 0.15,
  mainShare: 0.65,
  coolDownShare: 0.2,
} as const;

export const CARDS = {
  /** Flashcards never take more than this share of a session. */
  maxShare: 0.3,
  minutesPerCard: 0.15,
  dailyCap: 40,
} as const;

/** Duration personalisation (doc 05 §6). */
export const DURATION = {
  window: 20,
  minRatio: 0.6,
  maxRatio: 1.8,
} as const;

/** Cold start (doc 05 §7). */
export const COLD_START = {
  days: 3,
  questionsPerSet: 6,
} as const;

/** The gate has been shut this long with no movement ⇒ let one lesson through. */
export const STALE_GATE_DAYS = 14;

/** A LearningNowFlag bypasses the gate for this long, then expires. */
export const LEARNING_NOW_DAYS = 28;

export const QUESTION_SET_SIZE = { red: 4, amber: 5, green: 3, diagnostic: 6 } as const;
