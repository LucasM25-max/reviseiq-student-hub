# 05 — The Today engine

The core of ReviseIQ. Takes everything known about a student and produces an ordered list of
deep-linked tasks that fits the time they said they have.

Lives in `/lib/today`. **Pure functions, no I/O.** Data is fetched, passed in as a snapshot, and a
plan comes out. This makes it exhaustively unit-testable, which matters because it is the part of
the app most likely to do something inexplicable in front of a stressed 15-year-old.

---

## 1. Inputs

```ts
type PlannerInput = {
  now: Date;
  targetMinutes: number; // from availability, calendar period, or the quick-session override
  profile: {
    dailyGoalMinutes: number;
    holidayGoalMinutes: number;
    yearGroup: "YEAR_10" | "YEAR_11" | "OTHER"; // D26
    timezone: string;
    schedulingEnabled: boolean; // false after the last exam (D27)
  };
  calendarPeriod: {
    // D24 — which period today falls in
    kind: "TERM" | "HALF_TERM" | "HOLIDAY" | "STUDY_LEAVE" | "EXAM_SEASON";
    endDate: Date;
    minutesPerDay?: number;
  };
  schoolTests: Array<{
    // D25
    id: string;
    subjectId: string;
    date: Date;
    kind: "CLASS_TEST" | "END_OF_TOPIC" | "SCHOOL_MOCK";
    subTopicIds: string[];
  }>;
  enrolments: Array<{
    subjectId: string;
    tier: TierChoice;
    examDates: Array<{ paper: number; date: Date; confirmed: boolean }>;
  }>;
  rag: Array<{ scope: "TOPIC" | "SUBTOPIC"; id: string; value: RagValue }>;
  learningNow: string[]; // sub-topic ids flagged "school is teaching this now"
  mastery: Array<{
    specPointId: string;
    mastery: number;
    confidence: number;
    lastAttemptAt?: Date;
    lastTouchedAt?: Date;
  }>;
  dueCards: { total: number; overdueDays: number[]; bySubject: Record<string, number> };
  recentHistory: Array<{
    date: Date;
    taskType: TaskType;
    subTopicId?: string;
    status: TaskStatus;
    actualMinutes?: number;
  }>;
  contentIndex: ContentIndex; // what lessons/notes/questions/blurts exist, with est. durations
  algoVersion: string;
};
```

---

## 2. Plan mode

Mode is chosen from **year group** (D26) and the **nearest relevant exam date**, then adjusted by the
**calendar period** (D24). It changes the whole shape of the day.

| Mode             | Trigger                                                  | Task mix target                                                                             |
| ---------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `KEEPING_PACE`   | **Year 10**, outside their end-of-year exam window       | 40% lessons · 25% notes/blurt · 25% questions · 10% cards                                   |
| `LEARNING_HEAVY` | > 8 weeks to first exam, or ≥ 40% of topics `NOT_LEARNT` | 45% lessons · 20% notes/blurt · 25% questions · 10% cards                                   |
| `BALANCED`       | 4–8 weeks out                                            | 25% lessons · 20% notes/blurt · 40% questions · 15% cards                                   |
| `EXAM_FOCUS`     | 2–4 weeks out                                            | 10% lessons · 15% notes/blurt · 50% questions · 15% cards · 10% mini-mock                   |
| `STUDY_LEAVE`    | Inside a `STUDY_LEAVE` calendar period                   | 0% lessons · 10% blurt · 55% questions · 20% cards · 15% mock — **sequenced by exam order** |
| `FINAL_SPRINT`   | < 2 weeks out                                            | 0% lessons · 15% blurt · 55% questions · 20% cards · 10% mock                               |

No exam dates set → `BALANCED` for Year 11, `KEEPING_PACE` for Year 10, with a gentle standing nudge
to add dates.

In `FINAL_SPRINT` and `STUDY_LEAVE`, new lessons are suppressed entirely — cramming new content in
the last fortnight is a worse use of time than retrieval practice on what is already partly known.

### Year 10 is a genuinely different product (D26)

A Year 10 is **not** revising; they are keeping up. Applying the Year 11 model to them produces an
app that nags about exams 20 months away and gates lessons for content they meet next Tuesday.
Concrete differences:

- `KEEPING_PACE` is the default mode regardless of how far away the GCSE is.
- **The `NOT_LEARNT` gate is inverted in practice.** For Year 10, `LearningNowFlag` is the primary
  driver rather than the exception — Today asks once a month, _"What are you covering in school at
  the moment?"_ and prioritises keeping pace with that plus consolidating behind it.
- Mocks are mini-mocks and end-of-topic tests. Full papers only appear near their Year 10 summer
  exams, when a whole paper's worth of content actually exists in their heads.
- School tests (§5a) carry proportionally more weight, because they are the only real deadlines
  a Year 10 has.
- Exam countdowns are de-emphasised in the UI. A 600-day counter is anxiety, not motivation.

### Calendar adjustment (D24)

| Period                  | Adjustment                                                                                                                                                                                                                                      |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TERM`                  | No change. Weekly availability applies.                                                                                                                                                                                                         |
| `HALF_TERM` / `HOLIDAY` | `targetMinutes` comes from the holiday figure. No new school content is being taught, so lesson share drops ~10 points and consolidation rises. Long contiguous blocks make this the natural home for **full mock papers**.                     |
| `STUDY_LEAVE`           | Mode forced to `STUDY_LEAVE`. Ordering is dominated by which exam is next.                                                                                                                                                                      |
| `EXAM_SEASON`           | On a day with an exam, the plan is suppressed to a single light task or nothing at all, with a simple _"Good luck today"_. Revising hard the evening before the next paper is fine; being handed a 90-minute plan on the morning of one is not. |

---

## 3. Candidate generation

For every `(subject, subTopic)` the student is enrolled in, generate candidate tasks according to
its **effective RAG** (`subTopicRating ?? topicRating`):

| Effective RAG | Candidates generated                                                                                                                           |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `NOT_LEARNT`  | `LESSON` — **only if the gate is open** (§4)                                                                                                   |
| `RED`         | `LESSON` (re-teach, if a lesson exists and was never completed), `NOTES`, `BLURT`, `QUESTIONS` (scaffolded: low-mark, single-spec-point first) |
| `AMBER`       | `NOTES` (only the weak sections), `BLURT`, `QUESTIONS` (mixed marks, targeting the lowest-mastery spec points in the sub-topic)                |
| `GREEN`       | `QUESTIONS` (small confirmation set, 3–5, including at least one higher-mark item)                                                             |

Plus these, generated globally rather than per sub-topic:

- **`FLASHCARDS`** — whenever cards are due. Always a candidate, always near the top (§5).
- **`PRACTICAL`** — when a required practical attached to a worked sub-topic has never been reviewed
  and its questions are under-attempted. Practicals are ≥15% of marks; the scheduler treats them as a
  first-class task type, not filler.
- **`RAG_REFINE`** — 60-second sub-topic rating prompt, the first time a topic is worked on (D19).
- **`MINI_MOCK`** — in `EXAM_FOCUS`/`FINAL_SPRINT`, at most twice a week, when ≥ 3 sub-topics in a
  subject have enough attempted questions to make a meaningful paper.
- **`FULL_MOCK`** — never auto-inserted into a short day. Suggested as a _weekend_ task when
  `targetMinutes ≥ 120`, or surfaced as a standing "you're ready for a full paper" card on Today.
- **`DIAGNOSTIC`** — cold start only (§7).
- **School-test candidates** — for every sub-topic covered by a school test within 14 days, the
  normal candidate set is generated _regardless of RAG_ (including `NOT_LEARNT`, via the
  auto-created `LearningNowFlag`), then boosted and capped per §5a.

---

## 4. The `NOT_LEARNT` gate

The rule as specified: _Today suggests lessons for not-yet-learnt content **only when all learnt
content is green**._

```ts
function notLearntGateOpen(rag: RagSnapshot): boolean {
  const learnt = rag.filter((r) => r.value !== "NOT_LEARNT");
  if (learnt.length === 0) return true; // brand-new student: nothing to fix yet
  return !learnt.some((r) => r.value === "RED" || r.value === "AMBER");
}
```

Applied **per subject**, not globally — a student who is green across Biology should be learning new
Biology even if their Physics is a mess. Otherwise a single weak subject would freeze progress
everywhere, which is not what the rule is for.

### Three deliberate escape hatches

The gate is correct as a default and wrong as an absolute. Without exits it produces a student who
is being taught something in school **this week**, cannot access the lesson for it, and concludes the
app is broken.

1. **`LearningNowFlag`** — a per-sub-topic "we're doing this in school now" flag, set from the RAG
   screen or from a locked lesson. Bypasses the gate for 28 days, then expires.
2. **Manual browsing is never gated.** `/learn` is always fully browsable. The gate governs what
   Today _recommends_, never what the student may _access_. Locking content would be hostile.
3. **Stale-gate relief.** If the gate has been shut for 14+ consecutive days and no `RED` has moved,
   Today inserts one lesson anyway, explaining why: _"You've been grinding on Red topics for a
   fortnight — here's something new to keep momentum."_ Perpetual gating is demotivating, and
   demotivated students close the app.

When the gate is shut, Today says so explicitly, with the count: _"New lessons unlock when your 3
remaining Red/Amber topics go Green."_ Never silent absence.

---

## 5. Priority scoring

Each candidate gets a score in roughly 0–100. Weights live in one constants file and are tuned
against real completion data later.

```
priority =  w_rag       * ragWeight
          + w_urgency   * examUrgency
          + w_test      * schoolTestUrgency      ← D25
          + w_mastery   * masteryGap
          + w_decay     * forgettingRisk
          + w_coverage  * coverageDebt
          + w_due       * cardOverdue
          + w_variety   * varietyBonus
          - w_recent    * recencyPenalty
          - w_fatigue   * subjectFatigue
          - w_swap      * swapPenalty
```

| Term                | Definition                                                                                                                                                                                                                 |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ragWeight`         | `RED 1.0 · AMBER 0.6 · GREEN 0.2 · NOT_LEARNT 0.5` (0 when the gate is shut)                                                                                                                                               |
| `examUrgency`       | `clamp(1 - daysToExam/120, 0, 1)` for the paper containing this topic — a topic on a paper sat in three weeks outranks the same topic on a paper sat in June                                                               |
| `schoolTestUrgency` | See §5a. Zero unless a school test covers this sub-topic; ramps steeply over the final 10 days; zero again the day after the test                                                                                          |
| `masteryGap`        | `(1 - mastery) * confidence` — low mastery **that we have evidence for**. Unmeasured content scores low here and is picked up by `coverageDebt` instead, so the app doesn't confidently thrash on a single unlucky attempt |
| `forgettingRisk`    | `1 - exp(-daysSinceLastTouch / 21)` — the FSRS intuition applied at spec-point level, not just cards                                                                                                                       |
| `coverageDebt`      | `1` if a sub-topic has never been assessed at all, decaying with attempts. Stops whole areas being silently ignored because there is no data on them                                                                       |
| `cardOverdue`       | For `FLASHCARDS` only: `clamp(dueCount/20, 0, 1) + clamp(maxOverdueDays/7, 0, 1)`                                                                                                                                          |
| `varietyBonus`      | Rewards a task type and subject not used in the last 2 days                                                                                                                                                                |
| `recencyPenalty`    | Strong penalty for the same sub-topic **and** task type within 48 h — with a deliberate exception for FSRS cards, which are supposed to recur                                                                              |
| `subjectFatigue`    | Penalty when one subject has taken > 60% of the last 7 days' minutes                                                                                                                                                       |
| `swapPenalty`       | A task the student swapped away from in the last 7 days                                                                                                                                                                    |

---

## 5a. School tests (D25)

A GCSE in June is abstract. A Biology test on Friday is not. If the app ignores Friday, it gets
ignored on Thursday — so a school test is a first-class input, not a note in a calendar.

```ts
function schoolTestUrgency(subTopicId: string, tests: SchoolTest[], now: Date): number {
  const relevant = tests.filter(
    (t) => t.subTopicIds.includes(subTopicId) && t.date >= today(now),
  );
  if (relevant.length === 0) return 0;
  const days = daysUntil(nearest(relevant).date);
  if (days > 14) return 0; // don't hijack the plan a fortnight out
  const ramp = Math.pow(1 - days / 14, 1.8); // steep: barely felt at 14 days, dominant at 2
  const kindWeight = { CLASS_TEST: 0.7, END_OF_TOPIC: 0.85, SCHOOL_MOCK: 1.0 };
  return ramp * kindWeight[nearest(relevant).kind];
}
```

### Interactions

- **The gate opens automatically.** If a test covers `NOT_LEARNT` sub-topics, a `LearningNowFlag` is
  created for them when the test is added. Blocking a student from a lesson on something they are
  tested on in four days would be indefensible (§4, escape hatch 1).
- **Task mix shifts** for the covered sub-topics, towards the way people actually prepare for a
  class test: notes and flashcards early in the window, questions and a mini-mock in the last
  three days.
- **A school mock is treated as a real mock.** `SCHOOL_MOCK` unlocks full-paper suggestions in the
  run-up, because that is exactly what the student is about to sit.

### Allocation caps

A single class test must never eat the GCSE plan:

| Window            | Max share of a session |
| ----------------- | ---------------------- |
| 4–14 days out     | 40%                    |
| 1–3 days out      | 60%                    |
| Any `SCHOOL_MOCK` | 80%                    |

Above the cap, remaining slots go to normal priority. There is always at least one non-test task
unless the session is under 20 minutes.

### Afterwards

The day after, urgency drops to zero and one gentle prompt appears: _"How did the Biology test go?"_
→ went well / mixed / badly. This becomes a `RagSuggestion` for the covered sub-topics, never an
automatic change. It is the cheapest high-quality signal the app will ever get: a real assessment,
marked by a real teacher, on known content.

---

## 5b. Hard rules applied before scoring

1. Tier filter — Foundation students never get Higher-only content (`UNSURE` → Foundation scope,
   Higher labelled and de-weighted).
2. Gate filter — `NOT_LEARNT` lessons removed when the gate is shut and no escape hatch applies.
3. Content-existence filter — a task is never generated for content that does not exist yet.
   During the vertical slice this is doing most of the work.
4. Completion filter — a lesson already completed is not re-suggested as a lesson; it becomes a
   notes/blurt/question candidate instead.

---

## 6. Session packing

Scoring gives an ordered list. Packing turns it into a session that a human would actually enjoy.

```
1. Reserve flashcards.  If cards are due, place a FLASHCARDS task FIRST, capped at
   min(dueCount, floor(targetMinutes * 0.3 / 0.15min-per-card), 40 cards).
   Rationale: overdue cards decay fastest, and it is a genuinely easy start.

2. Session shape:
      warm-up   (~15%)  flashcards, or a short blurt
      main      (~65%)  the highest-priority substantive work — lesson or questions
      cool-down (~20%)  a small confirmation set, or a Green-topic question set

3. Greedy fill by priority, subject to:
      - no more than 2 consecutive tasks of the same type
      - ≥ 2 subjects represented when targetMinutes ≥ 45 and the student takes ≥ 2 subjects
      - no task with estMinutes > remaining time  (except: allow up to 15% overrun on the
        final task rather than leaving a 12-minute hole)
      - a FULL_MOCK is only ever placed when targetMinutes ≥ 120 and it is the only task

4. Guarantee a floor. A plan always contains ≥ 1 task, even if everything is green and nothing is
   due — fall back to the lowest-mastery Green sub-topic's confirmation questions.

5. Cap the plan at 6 tasks. A list of 11 things is a list nobody starts.
```

### Duration estimation

`estMinutes` starts from content metadata (a lesson's authored estimate; questions' `estSeconds`;
cards at ~9 s each) and is then **personalised**: multiply by the student's rolling ratio of actual
to estimated minutes over their last 20 completed tasks, clamped to 0.6–1.8. Students who read
slowly stop getting plans they can never finish.

---

## 7. Cold start (consequence of D11)

Flashcards are generated **only** from wrong answers, so a new student has zero cards and zero
mastery data. Their first week is deliberately different:

- **Days 1–3:** Today front-loads short `DIAGNOSTIC` question sets — 5–8 questions across each Amber
  and Green topic, explicitly framed as _"Let's find out what you actually know — getting these
  wrong is the point."_
- This seeds mastery estimates, generates the first flashcards, and surfaces any RAG rating that is
  wildly optimistic.
- Red topics get a lesson or notes first, then questions — no point diagnosing something the student
  has already told us they can't do.
- By roughly day 4 the normal algorithm has enough signal to run properly, and the diagnostics stop.

The framing matters. If the app's first act is a test the student fails, the framing must make that
feel like calibration rather than judgement.

---

## 8. Regeneration and adaptation

| Trigger                             | Behaviour                                                                                                                                                                                                                          |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nightly cron, ~04:00 local          | Generate tomorrow's `DayPlan` from that weekday's availability                                                                                                                                                                     |
| First visit of the day with no plan | Generate on demand (covers timezone drift and new users)                                                                                                                                                                           |
| Task completed                      | Mark done, recalculate remaining tasks **only if** performance was surprising (scored < 40% or > 90% against expectation) — otherwise leave the list stable, because a plan that reshuffles under the student's feet is unsettling |
| "I've only got N minutes" (D10)     | Supersede today's plan; re-pack the same candidates into N minutes; keep completed tasks                                                                                                                                           |
| Swap                                | Replace with the next-best candidate of a **different type or subject**; record a `swapPenalty` signal                                                                                                                             |
| Missed day                          | The plan is marked `MISSED`. **No backlog is created.**                                                                                                                                                                            |
| School test added or edited         | Today's plan is regenerated immediately — the student has just told us something important and should see it reflected at once                                                                                                     |
| Calendar period boundary crossed    | `targetMinutes` and mode switch on the first plan of the new period; a one-off prompt confirms holiday availability                                                                                                                |
| Last exam date passes               | Scheduling **stops** — see §8a                                                                                                                                                                                                     |

### Why no backlog

Carrying missed tasks forward is how Anki-style tools generate a 400-card wall that makes students
quit. Instead, missing work increases `forgettingRisk` and `coverageDebt` naturally, so genuinely
important items resurface on merit — while a plan is always sized to the time actually available.

FSRS cards are the exception: they are genuinely due and do accumulate, but the daily card cap (§6)
means the student sees at most ~40, prioritised by overdue days. The rest wait.

---

## 8a. End of the exam season (D27)

The scheduler terminates cleanly rather than running forever into an empty future.

```
nightly cron:
  if profile.schedulingEnabled and now > max(examDates):
      profile.examsCompletedAt = now
      profile.schedulingEnabled = false
      freeze streak at its current value          (do not break it)
      cancel all scheduled reminders
      skip plan generation from here on
```

On next open, the student gets the congratulations screen (doc 01 §8) exactly once —
`congratulationsSeenAt` guards it. Everything stays browsable; nothing is deleted.

`schedulingEnabled` is a stored flag rather than a computed check precisely so the **resit escape
hatch** works: _"Actually, I've got a resit"_ sets new exam dates, flips the flag back on, and plans
resume the next morning. A student resitting in November needs the app more than anyone, and a
computed "are all exams past" check would lock them out.

The planner also refuses to generate for `schedulingEnabled === false` as a hard precondition, so
no other code path can accidentally resurrect a finished account.

---

## 9. Explanations (`rationale`)

Every task carries one plain-English sentence. Trust in the plan is entirely downstream of the
student understanding why they were given something. Generated from the dominant scoring term:

| Dominant term          | Rationale template                                                           |
| ---------------------- | ---------------------------------------------------------------------------- |
| `cardOverdue`          | "12 cards are due — this is the fastest win of the day."                     |
| `masteryGap`           | "You scored 3/8 on osmosis questions last Tuesday."                          |
| `ragWeight` (RED)      | "You marked this Red, and your exam is in 6 weeks."                          |
| `forgettingRisk`       | "You haven't touched enzymes in 18 days."                                    |
| `coverageDebt`         | "You've never answered a question on this — let's find out where you stand." |
| `examUrgency`          | "This is on Paper 1, which you sit in 12 days."                              |
| `ragWeight` (GREEN)    | "Quick check that photosynthesis is still solid."                            |
| gate open              | "Everything else is Green — time for something new."                         |
| `schoolTestUrgency`    | "This is on your Biology test on Friday."                                    |
| calendar (holiday)     | "You've got a longer stretch today — good time for a full paper."            |
| calendar (study leave) | "Chemistry Paper 1 is tomorrow morning."                                     |

These are templates, not AI-generated. They must be instant, free, and deterministic. Tone follows
D33 — stating a reason, never applying pressure.

---

## 10. Deep links

Every `PlanTask.targetHref` resolves to exactly the described work — never a hub page.

| Task type    | Href                                                     | Payload prepared at generation time                |
| ------------ | -------------------------------------------------------- | -------------------------------------------------- |
| `FLASHCARDS` | `/revise/flashcards?task=<id>`                           | Card ID list, frozen so the queue is stable        |
| `LESSON`     | `/learn/<subject>/<topic>/<lesson>?task=<id>`            | Resume index                                       |
| `NOTES`      | `/revise/<subject>/notes/<subTopic>?task=<id>#<section>` | The specific weak section anchor                   |
| `BLURT`      | `/revise/blurt/<promptSetId>?task=<id>`                  | Prompt set                                         |
| `QUESTIONS`  | `/test/practice?set=<questionSetId>&task=<id>`           | **`QuestionSet` snapshot** — the exact 5 questions |
| `MINI_MOCK`  | `/test/mini-mock/<attemptId>?task=<id>`                  | Pre-assembled attempt                              |
| `FULL_MOCK`  | `/test/mock/<attemptId>?task=<id>`                       | Pre-assembled from the paper blueprint             |
| `PRACTICAL`  | `/revise/practicals/<subject>/<n>?task=<id>`             | —                                                  |
| `RAG_REFINE` | `/settings/rag/<topicId>?task=<id>`                      | Sub-topic list                                     |

The `?task=` parameter is how completion flows back: finishing the work marks the task done, records
`actualMinutes`, and returns the student to Today with the item ticked.

---

## 11. Testing

The engine is pure, so it gets a proper test suite:

- **Snapshot fixtures** for archetypal students: brand-new, all-red, all-green, one-week-to-exam,
  returning-after-three-weeks, single-subject, three-subjects, 15-minute-a-day, weekend-warrior,
  **Year 10 mid-term**, **class test in 3 days**, **Easter holiday**, **study leave with an exam
  tomorrow**, **exam day**, **post-exam**, **resitter**.
- **Invariants** asserted on every generated plan:
  - total `estMinutes` ≤ `targetMinutes × 1.15`
  - ≥ 1 task always
  - ≤ 6 tasks
  - no Higher-only content for a Foundation student
  - no `NOT_LEARNT` lesson when the gate is shut and no escape hatch applies
  - no task referencing content that does not exist
  - every `targetHref` resolves to a real route with a valid payload
  - school-test tasks never exceed the §5a share caps
  - **no plan at all** when `schedulingEnabled === false`
  - no full mock placed in a session under 120 minutes
  - determinism: identical input ⇒ identical plan
- **Property tests** over randomised inputs for the packing invariants.
- **`algoVersion`** stamped on every plan, so scheduler versions can be compared against real
  completion rates once there is data.
