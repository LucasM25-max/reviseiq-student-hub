# 03 — Data model

Prisma sketch. Illustrative, not final — field names and indexes will shift during Phase 0, but the
entity boundaries and relationships here are the agreed design.

Three groups:

1. **Identity** — Auth.js tables plus the student profile
2. **Curriculum** — seeded from content files, read-mostly, shared by all users
3. **Student state** — everything a student generates, always scoped by `userId`

---

## 1. Identity

```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  emailVerified DateTime?
  name          String?
  image         String?
  passwordHash  String?                     // null for Google-only accounts (argon2id)
  dateOfBirth   DateTime?                   // age gate; under-13 blocked
  role          Role      @default(STUDENT) // ADMIN reserved for content review tooling
  createdAt     DateTime  @default(now())
  deletedAt     DateTime?

  accounts Account[]
  sessions Session[]
  profile  StudentProfile?
}

enum Role { STUDENT ADMIN }

// Account, Session, VerificationToken: standard @auth/prisma-adapter shapes.

model StudentProfile {
  userId               String   @id
  user                 User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  displayName          String?
  timezone             String   @default("Europe/London")
  yearGroup            YearGroup @default(YEAR_11)   // D26 — changes default plan mode
  dailyGoalMinutes     Int      @default(30)
  holidayGoalMinutes   Int      @default(60)         // D24 — holidays are a different regime
  onboardingCompletedAt DateTime?

  // end of the exam season (D27)
  examsCompletedAt      DateTime?               // stamped when the last exam date passes
  congratulationsSeenAt DateTime?               // so the celebration fires exactly once
  schedulingEnabled     Boolean  @default(true) // false after exams; true again on a resit

  // habit layer (D35 — streaks only, no XP/levels/achievements)
  streakCurrent        Int      @default(0)
  streakLongest        Int      @default(0)
  streakFreezesLeft    Int      @default(2)
  lastActiveDate       DateTime?

  // preferences
  reminderChannel      ReminderChannel @default(NONE)
  reminderTimes        Json?           // ["18:30","20:00"]
  reduceMotion         Boolean  @default(false)
  dyslexiaFont         Boolean  @default(false)
  theme                String   @default("system")
}

enum ReminderChannel { NONE EMAIL PUSH BOTH }
enum YearGroup       { YEAR_10 YEAR_11 OTHER }
```

---

## 2. Curriculum (seeded — doc 04)

```prisma
model Subject {
  id           String  @id                  // "aqa-biology"
  code         SubjectCode                  // BIOLOGY | CHEMISTRY | PHYSICS
  examBoard    String  @default("AQA")
  qualCode     String                       // "8461" | "8462" | "8463"
  name         String
  accentColor  String
  topics       Topic[]
  formulae     FormulaEntry[]
  practicals   Practical[]
  paperTemplates PaperTemplate[]
}

enum SubjectCode { BIOLOGY CHEMISTRY PHYSICS }
enum Tier        { FOUNDATION HIGHER BOTH }   // BOTH = content assessed at either tier

model Topic {
  id        String  @id                      // "bio-t1"
  subjectId String
  number    Int                              // 1..n
  title     String
  paper     Int                              // 1 or 2 — drives mock assembly
  order     Int
  subTopics SubTopic[]
  @@unique([subjectId, number])
}

model SubTopic {
  id      String @id                         // "bio-t1-cell-structure"
  topicId String
  code    String                             // AQA code, e.g. "4.1.1"
  title   String
  order   Int
  specPoints SpecPoint[]
  lessons    Lesson[]
  noteSections NoteSection[]
  blurtPrompts BlurtPrompt[]
  @@unique([topicId, code])
}

/// The atomic unit. Everything joins through here.
model SpecPoint {
  id         String @id                      // "4.1.1.2"
  subTopicId String
  code       String @unique
  statement  String @db.Text
  tier       Tier   @default(BOTH)
  mathsSkills String[]                       // AQA MS refs
  wsSkills    String[]                       // AQA WS refs
  practicalIds String[]                      // required practicals that assess this
  order      Int

  questionLinks QuestionSpecPoint[]
  lessonBlockRefs LessonBlockSpecPoint[]
  masteries  SpecPointMastery[]
}

model Lesson {
  id         String @id
  subTopicId String
  slug       String
  title      String
  order      Int
  estMinutes Int
  tier       Tier   @default(BOTH)
  blocks     Json                            // typed block array, zod-validated at seed
  version    Int    @default(1)
  progress   LessonProgress[]
  @@unique([subTopicId, slug])
}

model NoteSection {
  id         String @id
  subTopicId String
  slug       String                          // becomes the #anchor Today deep-links to
  title      String
  bodyMdx    String @db.Text
  tier       Tier   @default(BOTH)
  specPointCodes String[]
  order      Int
}

model Practical {
  id         String @id                      // "bio-rp-3"
  subjectId  String
  number     Int
  title      String
  bodyMdx    String @db.Text
  subTopicIds String[]
  @@unique([subjectId, number])
}

model FormulaEntry {
  id          String  @id
  subjectId   String
  expression  String                         // KaTeX
  meaning     String
  symbols     Json                           // [{symbol, quantity, unit}]
  tier        Tier    @default(BOTH)
  givenInExam Boolean                        // ← the distinction that wins marks
  specPointCodes String[]
}

model BlurtPrompt {
  id             String @id
  subTopicId     String
  prompt         String @db.Text
  expectedPoints Json                        // [{id, idea, aliases[], essential:boolean}]
  tier           Tier   @default(BOTH)
  estMinutes     Int    @default(4)
}
```

### Questions and mark schemes

```prisma
model Question {
  id          String @id
  subjectId   String
  primarySubTopicId String
  type        QuestionType
  tier        Tier         @default(BOTH)
  paper       Int
  marks       Int
  commandWord String                          // state | describe | explain | calculate | evaluate ...
  ao          AO
  difficulty  Int                             // 1..5, seeded by author, refined from real data
  stemMdx     String @db.Text
  assets      Json?                           // diagram ids, data tables, graphs
  options     Json?                           // MCQ options
  correctKey  String?                         // MCQ/objective — deterministic marking
  estSeconds  Int
  markScheme  MarkScheme?
  specPoints  QuestionSpecPoint[]
  attempts    QuestionAttempt[]
  version     Int   @default(1)
  retired     Boolean @default(false)

  @@index([subjectId, tier, paper])
  @@index([primarySubTopicId, tier])
}

enum QuestionType { MCQ SHORT CALCULATION EXTENDED PRACTICAL DATA_RESPONSE }
enum AO { AO1 AO2 AO3 }

model QuestionSpecPoint {
  questionId   String
  specPointId  String
  weight       Float @default(1)
  @@id([questionId, specPointId])
}

model MarkScheme {
  questionId String @id
  /// points: [{ id, text, marks, alternatives[], reject[] }]
  points     Json
  guidance   String? @db.Text                 // how an examiner should apply it
  ecfRules   String? @db.Text                 // error carried forward
  modelAnswer String? @db.Text                // shown after marking, never sent to the marker
}

/// Blueprint for assembling a full mock — never a fixed question list.
model PaperTemplate {
  id          String @id                      // "bio-p1-higher"
  subjectId   String
  paper       Int
  tier        Tier
  totalMarks  Int    @default(100)
  durationMin Int    @default(105)
  /// { topicWeights:{...}, aoMix:{AO1:.40,AO2:.40,AO3:.20},
  ///   typeMix:{MCQ:.15,...}, practicalMinPct:0.15, extendedMin:1, difficultyRamp:[...] }
  blueprint   Json
}
```

---

## 3. Student state

### Enrolment, exams, RAG

```prisma
model SubjectEnrolment {
  id        String  @id @default(cuid())
  userId    String
  subjectId String
  tier      TierChoice @default(UNSURE)
  active    Boolean @default(true)
  createdAt DateTime @default(now())
  examDates ExamDate[]
  @@unique([userId, subjectId])
}

enum TierChoice { FOUNDATION HIGHER UNSURE }

model ExamDate {
  id           String   @id @default(cuid())
  enrolmentId  String
  paper        Int
  date         DateTime
  confirmed    Boolean  @default(false)       // false = "summer of X" estimate
}

/// D19: topic-level at onboarding, sub-topic added progressively.
model RagRating {
  id         String   @id @default(cuid())
  userId     String
  scope      RagScope
  topicId    String?
  subTopicId String?
  value      RagValue
  source     RagSource @default(USER)
  updatedAt  DateTime  @updatedAt
  @@unique([userId, scope, topicId, subTopicId])
  @@index([userId, value])
}

enum RagScope  { TOPIC SUBTOPIC }
enum RagValue  { NOT_LEARNT RED AMBER GREEN }
enum RagSource { USER SUGGESTED_ACCEPTED IMPORTED }

/// Pending "should this move to Green?" prompts. Never auto-applied.
model RagSuggestion {
  id         String   @id @default(cuid())
  userId     String
  subTopicId String
  from       RagValue
  to         RagValue
  reason     String
  createdAt  DateTime @default(now())
  resolvedAt DateTime?
  accepted   Boolean?
}

/// Escape hatch from the NOT_LEARNT gate (doc 05): "school is teaching me this now".
model LearningNowFlag {
  id         String   @id @default(cuid())
  userId     String
  subTopicId String
  createdAt  DateTime @default(now())
  expiresAt  DateTime
  @@unique([userId, subTopicId])
}
```

### Activity

```prisma
model LessonProgress {
  id             String   @id @default(cuid())
  userId         String
  lessonId       String
  lastBlockIndex Int      @default(0)
  state          ProgressState @default(IN_PROGRESS)
  startedAt      DateTime @default(now())
  completedAt    DateTime?
  totalSeconds   Int      @default(0)
  @@unique([userId, lessonId])
}

enum ProgressState { NOT_STARTED IN_PROGRESS COMPLETED }

model QuestionAttempt {
  id            String   @id @default(cuid())
  userId        String
  questionId    String
  context       AttemptContext
  setId         String?                        // QuestionSet or MockAttempt id
  answerText    String?  @db.Text
  answerKey     String?                        // objective types
  awardedMarks  Int
  maxMarks      Int
  markedBy      MarkedBy
  markDetail    Json?                          // per-mark-point result from the AI marker
  aiConfidence  Float?
  disputed      Boolean  @default(false)
  durationSec   Int
  createdAt     DateTime @default(now())

  cards FlashCard[]
  @@index([userId, questionId])
  @@index([userId, createdAt])
}

enum AttemptContext { LESSON_CHECK PRACTICE MINI_MOCK FULL_MOCK MASTERY_CHECK }
enum MarkedBy       { AUTO AI AI_FALLBACK SELF }

/// A snapshotted set of questions, so a Today deep link stays stable and resumable.
model QuestionSet {
  id          String   @id @default(cuid())
  userId      String
  questionIds String[]
  reason      String
  createdAt   DateTime @default(now())
  completedAt DateTime?
}

model MockAttempt {
  id              String   @id @default(cuid())
  userId          String
  kind            MockKind
  subjectId       String
  paperTemplateId String?
  questionIds     String[]
  tier            Tier
  durationMin     Int
  startedAt       DateTime @default(now())
  submittedAt     DateTime?
  awardedMarks    Int?
  totalMarks      Int
  gradeEstimate   String?                       // "6", clearly labelled as indicative
  breakdown       Json?                         // per topic and per AO
}

enum MockKind { MINI FULL }

model BlurtAttempt {
  id          String   @id @default(cuid())
  userId      String
  promptId    String
  text        String   @db.Text
  coverage    Json                              // [{pointId, present, quote}]
  coveragePct Float
  createdAt   DateTime @default(now())
}
```

### Flashcards (doc 07)

```prisma
/// Created ONLY from a wrong QuestionAttempt (D11).
model FlashCard {
  id             String  @id @default(cuid())
  userId         String
  sourceAttemptId String
  questionId     String
  specPointId    String
  markPointId    String?                        // the specific mark-scheme point missed
  front          String  @db.Text
  back           String  @db.Text
  hint           String?
  cardType       CardType @default(QA)

  // FSRS-6 state
  due        DateTime
  stability  Float    @default(0)
  difficulty Float    @default(0)
  elapsedDays Int     @default(0)
  scheduledDays Int   @default(0)
  reps       Int      @default(0)
  lapses     Int      @default(0)
  state      FsrsState @default(NEW)
  lastReview DateTime?

  suspended  Boolean  @default(false)
  retiredAt  DateTime?
  createdAt  DateTime @default(now())
  reviews    CardReview[]

  @@index([userId, due])
  @@index([userId, specPointId])
}

enum CardType  { QA CLOZE DEFINITION }
enum FsrsState { NEW LEARNING REVIEW RELEARNING }

model CardReview {
  id            String   @id @default(cuid())
  cardId        String
  userId        String
  rating        Int                              // 1 Again, 2 Hard, 3 Good, 4 Easy
  state         FsrsState
  due           DateTime
  stability     Float
  difficulty    Float
  elapsedDays   Int
  lastElapsedDays Int
  scheduledDays Int
  reviewedAt    DateTime @default(now())
  durationMs    Int
  @@index([userId, reviewedAt])
}
```

### Mastery

```prisma
/// Rolling, recency-weighted estimate per spec point. Rebuildable from attempts.
model SpecPointMastery {
  userId        String
  specPointId   String
  mastery       Float    @default(0)           // 0..1
  confidence    Float    @default(0)           // 0..1, rises with attempt count
  attempts      Int      @default(0)
  lastAttemptAt DateTime?
  lastTouchedAt DateTime?                      // any interaction: lesson, notes, card, question
  updatedAt     DateTime @updatedAt
  @@id([userId, specPointId])
  @@index([userId, mastery])
}
```

### Availability and plans (doc 05)

```prisma
model AvailabilitySlot {
  id        String @id @default(cuid())
  userId    String
  weekday   Int                                // 0 = Sunday
  minutes   Int
  preferredStart String?                       // "18:30"
  @@unique([userId, weekday])
}

model AvailabilityException {
  id      String   @id @default(cuid())
  userId  String
  date    DateTime @db.Date
  minutes Int                                  // 0 = away/holiday
  note    String?
  @@unique([userId, date])
}

/// D24 — the school year. Seeded from an England default calendar, fully editable.
model CalendarPeriod {
  id             String   @id @default(cuid())
  userId         String
  kind           PeriodKind
  label          String                         // "October half term"
  startDate      DateTime @db.Date
  endDate        DateTime @db.Date
  minutesPerDay  Int?                           // overrides weekly availability for this period
  promptedAt     DateTime?                      // the one-off "how much this half term?" nudge
  @@index([userId, startDate])
}

enum PeriodKind { TERM HALF_TERM HOLIDAY STUDY_LEAVE EXAM_SEASON }

/// D25 — a real assessment at the student's school.
model SchoolTest {
  id          String   @id @default(cuid())
  userId      String
  subjectId   String
  kind        SchoolTestKind @default(CLASS_TEST)
  title       String?
  date        DateTime @db.Date
  recurrence  Recurrence @default(NONE)
  recurUntil  DateTime? @db.Date
  outcome     TestOutcome?                      // from the gentle "how did it go?" prompt
  outcomeAt   DateTime?
  createdAt   DateTime @default(now())
  scopes      SchoolTestScope[]
  @@index([userId, date])
}

enum SchoolTestKind { CLASS_TEST END_OF_TOPIC SCHOOL_MOCK }
enum Recurrence     { NONE WEEKLY FORTNIGHTLY }
enum TestOutcome    { WENT_WELL MIXED WENT_BADLY }

/// What the test covers — topics and/or sub-topics.
model SchoolTestScope {
  id           String @id @default(cuid())
  schoolTestId String
  topicId      String?
  subTopicId   String?
}

model DayPlan {
  id            String   @id @default(cuid())
  userId        String
  date          DateTime @db.Date
  targetMinutes Int
  generatedAt   DateTime @default(now())
  algoVersion   String
  mode          PlanMode                        // drives the task mix
  status        PlanStatus @default(ACTIVE)
  tasks         PlanTask[]
  @@unique([userId, date])
}

enum PlanMode   { KEEPING_PACE LEARNING_HEAVY BALANCED EXAM_FOCUS STUDY_LEAVE FINAL_SPRINT }
enum PlanStatus { ACTIVE COMPLETED PARTIAL MISSED SUPERSEDED }

model PlanTask {
  id          String   @id @default(cuid())
  dayPlanId   String
  order       Int
  type        TaskType
  subjectId   String?
  subTopicId  String?
  title       String                            // "5 exam questions on osmosis"
  rationale   String                            // "You scored 3/8 here last Tuesday"
  targetHref  String                            // the deep link — always resolvable
  payload     Json?                             // questionSetId, cardIds, lessonId, promptSetId
  estMinutes  Int
  priority    Float
  status      TaskStatus @default(PENDING)
  startedAt   DateTime?
  completedAt DateTime?
  actualMinutes Int?
  swappedFor  String?
  @@index([dayPlanId, order])
}

enum TaskType   { FLASHCARDS LESSON NOTES BLURT QUESTIONS MINI_MOCK FULL_MOCK PRACTICAL RAG_REFINE DIAGNOSTIC }

/// Set on a PlanTask when it exists because of a school test, so the UI can badge it
/// ("for Friday's Biology test") and the allocation caps in doc 05 §5 can be enforced.
/// Implemented as a nullable `schoolTestId` column on PlanTask.
enum TaskStatus { PENDING IN_PROGRESS DONE PARTIAL SKIPPED EXPIRED }

model StudySession {
  id        String   @id @default(cuid())
  userId    String
  taskId    String?
  startedAt DateTime
  endedAt   DateTime?
  minutes   Int      @default(0)
  @@index([userId, startedAt])
}
```

### AI usage, caching, quotas (doc 06)

```prisma
model AiUsage {
  id           String   @id @default(cuid())
  userId       String?
  feature      AiFeature
  model        String
  inputTokens  Int
  outputTokens Int
  cachedTokens Int      @default(0)
  costMicros   Int                               // millionths of a USD
  latencyMs    Int
  ok           Boolean  @default(true)
  createdAt    DateTime @default(now())
  @@index([userId, createdAt])
  @@index([createdAt])
}

enum AiFeature { MARK MARK_BATCH BLURT TUTOR }

/// hash(questionId + model + normalisedAnswer) → mark result.
model MarkCache {
  hash       String   @id
  questionId String
  model      String
  result     Json
  hits       Int      @default(0)
  createdAt  DateTime @default(now())
  @@index([questionId])
}

model RateBucket {
  key       String   @id                          // "user:<id>:mark:2026-09-27"
  count     Int      @default(0)
  windowEnd DateTime
}
```

### Habit layer (D35)

Streaks live on `StudentProfile`. There is no XP, level or achievement model — deliberately (D35).

```prisma
model PushSubscription { id String @id @default(cuid()) userId String endpoint String @unique keys Json createdAt DateTime @default(now()) }
```

---

## Design notes

1. **`SpecPoint` is the hub.** Questions, lessons, notes, cards, formulae and practicals all
   reference spec point codes. Today's ranking is essentially a query over spec points joined to
   RAG, mastery and FSRS state. Get this join right and the rest is presentation.
2. **RAG and mastery are separate on purpose.** RAG is the student's _belief_; mastery is the
   _evidence_. Divergence between them is itself a useful signal, and it drives `RagSuggestion`.
3. **Plans are materialised, not computed on read.** A `DayPlan` row with `PlanTask` children means
   the plan is stable through the day, resumable, and auditable when it does something odd. The
   `algoVersion` column lets us compare scheduler versions against real completion rates later.
4. **`QuestionSet` snapshots make deep links safe.** "5 questions on osmosis" refers to an immutable
   list, so refreshing, resuming tomorrow, or bookmarking all behave.
5. **`SpecPointMastery` is a cache.** It is fully rebuildable from `QuestionAttempt` history, so a
   change to the mastery formula is a backfill, not a migration.
6. **`Tier` on content, `TierChoice` on the student.** `UNSURE` resolves to Foundation scope with
   Higher material labelled and de-prioritised rather than hidden.
7. **Combined Science is not modelled, but not blocked.** Adding it means a `qualifications String[]`
   flag on `SpecPoint` and new `PaperTemplate` rows — no structural change.
8. **Three kinds of deadline, one scoring model.** `ExamDate` (the real thing), `SchoolTest` (the
   deadline students actually feel) and `CalendarPeriod` (how much time exists) are separate
   entities but all feed the same urgency terms in doc 05. Keeping them separate means a school
   test can be deleted without touching exam data, and a calendar edit never rewrites a plan's history.
9. **The post-exam state is stored, not computed.** `examsCompletedAt` and `schedulingEnabled` are
   real columns because the congratulations moment must fire exactly once, and because a resit has
   to be able to switch scheduling back on without rewriting exam dates.
10. **Year group is an enum, not an integer.** `OTHER` covers resitters, private candidates and
    home-educated students, who would otherwise be forced into a lie at onboarding.
