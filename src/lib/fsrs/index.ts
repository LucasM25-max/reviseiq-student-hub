/**
 * The FSRS-6 scheduler (D12), and the only place `ts-fsrs` is imported.
 *
 * Everything here is pure: state in, state out, with the clock passed as an argument.
 * That is what makes a 180-day simulation possible as a unit test, and it keeps the
 * library's `Card` shape — snake_case, `Date` objects, numeric enums — from leaking
 * into the database layer or the UI.
 */

import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Card as FsrsCard,
  type FSRS,
  type Grade,
} from "ts-fsrs";

/** Our own state shape: the database's column names, and nothing library-specific. */
export type SchedulerState = {
  due: Date;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  learningSteps: number;
  state: CardStateName;
  lastReview: Date | null;
};

export type CardStateName = "NEW" | "LEARNING" | "REVIEW" | "RELEARNING";
export type RatingName = "AGAIN" | "HARD" | "GOOD" | "EASY";

export const RATINGS: RatingName[] = ["AGAIN", "HARD", "GOOD", "EASY"];

/**
 * `maximum_interval: 365` is deliberate (doc 07 §1). Default FSRS will happily
 * schedule a card for 2050; for an exam with a fixed date, anything beyond a year is
 * wasted scheduling. Fuzz spreads due dates so no single day spikes.
 */
export const FSRS_PARAMETERS = {
  request_retention: 0.9,
  maximum_interval: 365,
  enable_fuzz: true,
} as const;

let cached: FSRS | null = null;

/** One scheduler, built once. Parameters are fixed, so it is safe to share. */
function scheduler(): FSRS {
  cached ??= fsrs(generatorParameters(FSRS_PARAMETERS));
  return cached;
}

const STATE_TO_NAME: Record<number, CardStateName> = {
  [State.New]: "NEW",
  [State.Learning]: "LEARNING",
  [State.Review]: "REVIEW",
  [State.Relearning]: "RELEARNING",
};

const NAME_TO_STATE: Record<CardStateName, State> = {
  NEW: State.New,
  LEARNING: State.Learning,
  REVIEW: State.Review,
  RELEARNING: State.Relearning,
};

const NAME_TO_RATING: Record<RatingName, Grade> = {
  AGAIN: Rating.Again,
  HARD: Rating.Hard,
  GOOD: Rating.Good,
  EASY: Rating.Easy,
};

function toFsrs(state: SchedulerState): FsrsCard {
  return {
    due: state.due,
    stability: state.stability,
    difficulty: state.difficulty,
    elapsed_days: state.elapsedDays,
    scheduled_days: state.scheduledDays,
    reps: state.reps,
    lapses: state.lapses,
    learning_steps: state.learningSteps,
    state: NAME_TO_STATE[state.state],
    last_review: state.lastReview ?? undefined,
  };
}

function fromFsrs(card: FsrsCard): SchedulerState {
  return {
    due: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    learningSteps: card.learning_steps,
    state: STATE_TO_NAME[card.state] ?? "NEW",
    lastReview: card.last_review ?? null,
  };
}

/** A brand-new card, due immediately. */
export function newCard(now: Date): SchedulerState {
  return fromFsrs(createEmptyCard(now));
}

/**
 * A hard ceiling on the interval.
 *
 * `maximum_interval` is applied by the library *before* fuzz, so an interval can come
 * back at 367 days with the fuzz added on top. Two days is immaterial in itself, but
 * this ceiling is a product decision rather than a tuning knob — a GCSE course has a
 * fixed exam date, and scheduling past it is not "slightly long", it is pointless.
 * Clamping keeps `due` and `scheduledDays` consistent with one another.
 */
function clampInterval(state: SchedulerState, now: Date): SchedulerState {
  if (state.scheduledDays <= FSRS_PARAMETERS.maximum_interval) return state;

  const from = state.lastReview ?? now;
  const due = new Date(from.getTime() + FSRS_PARAMETERS.maximum_interval * 24 * 60 * 60 * 1000);

  return { ...state, scheduledDays: FSRS_PARAMETERS.maximum_interval, due };
}

/** The next state for one rating. Pure — the same inputs always give the same output. */
export function review(state: SchedulerState, rating: RatingName, now: Date): SchedulerState {
  const outcome = scheduler().next(toFsrs(state), now, NAME_TO_RATING[rating]);
  return clampInterval(fromFsrs(outcome.card), now);
}

/** What each button would do, for showing intervals on the rating buttons. */
export function preview(state: SchedulerState, now: Date): Record<RatingName, SchedulerState> {
  const all = scheduler().repeat(toFsrs(state), now);

  return {
    AGAIN: clampInterval(fromFsrs(all[Rating.Again].card), now),
    HARD: clampInterval(fromFsrs(all[Rating.Hard].card), now),
    GOOD: clampInterval(fromFsrs(all[Rating.Good].card), now),
    EASY: clampInterval(fromFsrs(all[Rating.Easy].card), now),
  };
}

/**
 * How long until a card is due, in whole minutes, floored at zero.
 *
 * Used for the button labels, so it has to read the way a student thinks: "10 min",
 * "2 days", not "0.007 days".
 */
export function minutesUntil(due: Date, now: Date): number {
  return Math.max(0, Math.round((due.getTime() - now.getTime()) / 60_000));
}

export function formatInterval(due: Date, now: Date): string {
  const minutes = minutesUntil(due, now);

  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr`;

  const days = Math.round(minutes / (60 * 24));
  if (days < 31) return `${days} day${days === 1 ? "" : "s"}`;

  const months = Math.round(days / 30);
  if (months < 12) return `${months} mo`;

  return `${Math.round(days / 365)} yr`;
}
