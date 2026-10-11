/**
 * The planner's contract (doc 05 §1).
 *
 * Everything the scheduler needs arrives as one snapshot and a plan comes out. No
 * I/O anywhere in `/lib/today` — that is what makes the engine exhaustively testable,
 * which matters because it is the part of the app most likely to do something
 * inexplicable in front of a stressed fifteen-year-old.
 */

export type TaskType =
  | "FLASHCARDS"
  | "LESSON"
  | "NOTES"
  | "BLURT"
  | "QUESTIONS"
  | "PRACTICAL"
  | "RAG_REFINE"
  | "MINI_MOCK"
  | "FULL_MOCK"
  | "DIAGNOSTIC";

export type TaskStatus = "PENDING" | "DONE" | "SKIPPED" | "SWAPPED";

export type PlanMode =
  | "KEEPING_PACE"
  | "LEARNING_HEAVY"
  | "BALANCED"
  | "EXAM_FOCUS"
  | "STUDY_LEAVE"
  | "FINAL_SPRINT";

export type RagValue = "NOT_LEARNT" | "RED" | "AMBER" | "GREEN";

export type CalendarKind = "TERM" | "HALF_TERM" | "HOLIDAY" | "STUDY_LEAVE" | "EXAM_SEASON";

export type SchoolTestKind = "CLASS_TEST" | "END_OF_TOPIC" | "SCHOOL_MOCK";

export type TierChoice = "FOUNDATION" | "HIGHER" | "UNSURE";

/** What exists to be scheduled. A task is never generated for content that does not. */
export type ContentSubTopic = {
  id: string;
  subjectId: string;
  code: string;
  title: string;
  /** Lesson ids, in order, with their authored estimates. */
  lessons: Array<{ id: string; slug: string; estMinutes: number; higherOnly: boolean }>;
  /** Whether note sections exist, and the anchors of the weakest ones. */
  noteSections: Array<{ anchor: string; estMinutes: number; specPointIds: string[] }>;
  blurtPrompts: Array<{ id: string; estMinutes: number }>;
  /** Questions available, with the spec points they assess. */
  questions: Array<{
    id: string;
    marks: number;
    difficulty: number;
    estSeconds: number;
    higherOnly: boolean;
    specPointIds: string[];
  }>;
  practicals: Array<{ id: string; number: number; estMinutes: number }>;
  specPointIds: string[];
  /** Which paper this sub-topic is assessed on, for exam urgency. */
  paper: number;
};

export type ContentIndex = {
  subTopics: ContentSubTopic[];
};

export type PlannerProfile = {
  dailyGoalMinutes: number;
  holidayGoalMinutes: number;
  yearGroup: "YEAR_10" | "YEAR_11" | "OTHER";
  timezone: string;
  /** False after the last exam (D27). A hard precondition, not a hint. */
  schedulingEnabled: boolean;
};

export type CalendarPeriod = {
  kind: CalendarKind;
  endDate: Date;
  minutesPerDay?: number;
  /** Set on a day the student actually sits a paper. */
  examToday?: { subjectId: string; paper: number } | null;
};

export type SchoolTest = {
  id: string;
  subjectId: string;
  date: Date;
  kind: SchoolTestKind;
  subTopicIds: string[];
};

export type Enrolment = {
  subjectId: string;
  subjectName: string;
  subjectSlug: string;
  tier: TierChoice;
  examDates: Array<{ paper: number; date: Date; confirmed: boolean }>;
};

export type RagEntry = { scope: "TOPIC" | "SUBTOPIC"; id: string; value: RagValue };

export type MasteryEntry = {
  specPointId: string;
  mastery: number;
  confidence: number;
  lastAttemptAt?: Date;
  lastTouchedAt?: Date;
};

export type HistoryEntry = {
  date: Date;
  taskType: TaskType;
  subTopicId?: string;
  subjectId?: string;
  status: TaskStatus;
  estMinutes?: number;
  actualMinutes?: number;
};

export type PlannerInput = {
  now: Date;
  targetMinutes: number;
  profile: PlannerProfile;
  calendarPeriod: CalendarPeriod;
  schoolTests: SchoolTest[];
  enrolments: Enrolment[];
  rag: RagEntry[];
  /** Sub-topic ids flagged "school is teaching this now", with their expiry. */
  learningNow: Array<{ subTopicId: string; expiresAt: Date }>;
  mastery: MasteryEntry[];
  dueCards: {
    total: number;
    overdueDays: number[];
    bySubject: Record<string, number>;
  };
  /** Sub-topics whose lessons the student has already completed. */
  completedLessonIds: string[];
  recentHistory: HistoryEntry[];
  contentIndex: ContentIndex;
  /** Days since the student's account was created, for cold start. */
  accountAgeDays: number;
  /** Consecutive days the NOT_LEARNT gate has been shut, for stale-gate relief. */
  gateShutDays: number;
  algoVersion: string;
};

/** A scored, schedulable piece of work. */
export type Candidate = {
  /** Stable within one plan, so swaps and tests can refer to it. */
  key: string;
  type: TaskType;
  subjectId: string;
  subjectSlug: string;
  subTopicId?: string;
  /** Everything needed to build the deep link and the payload. */
  ref: CandidateRef;
  estMinutes: number;
  title: string;
  /** Scoring terms, kept so the rationale can name the dominant one. */
  terms: Record<string, number>;
  score: number;
  /** True when this exists only because a school test is close. */
  fromSchoolTest: boolean;
  higherOnly: boolean;
};

export type CandidateRef =
  | { kind: "FLASHCARDS"; cardCount: number }
  | { kind: "LESSON"; lessonId: string; lessonSlug: string; subTopicCode: string }
  | { kind: "NOTES"; subTopicCode: string; anchor: string | null }
  | { kind: "BLURT"; promptId: string }
  | { kind: "QUESTIONS"; questionIds: string[] }
  | { kind: "PRACTICAL"; practicalNumber: number }
  | { kind: "RAG_REFINE"; topicId: string }
  | { kind: "DIAGNOSTIC"; questionIds: string[] }
  | { kind: "MINI_MOCK"; questionIds: string[] }
  | { kind: "FULL_MOCK"; questionIds: string[] };

export type PlannedTask = Candidate & {
  order: number;
  rationale: string;
};

export type Plan = {
  mode: PlanMode;
  targetMinutes: number;
  tasks: PlannedTask[];
  totalEstMinutes: number;
  /** Shown when the gate is shut, so its absence is never silent (doc 05 §4). */
  gateMessage: string | null;
  /** Set when the day is suppressed — an exam day, or scheduling has ended. */
  suppressed: { reason: "EXAM_TODAY" | "SCHEDULING_OFF"; message: string } | null;
  algoVersion: string;
};
