# 01 — Product specification

Covers every user-facing surface: entry, onboarding, and the four main pages.

---

## 1. Entry: create account / log in

**Route:** `/` (unauthenticated) → marketing-lite splash with a single primary action.
Authenticated users are redirected straight to `/today`.

### Screens

| Route                                         | Purpose                                                    |
| --------------------------------------------- | ---------------------------------------------------------- |
| `/signup`                                     | Google button, or name + email + password                  |
| `/login`                                      | Google button, or email + password, "forgot password" link |
| `/verify-email`                               | "Check your inbox" holding state; resend with cooldown     |
| `/verify-email/[token]`                       | Consumes token, marks verified, redirects to onboarding    |
| `/reset-password` / `/reset-password/[token]` | Standard reset flow                                        |

### Rules

- Google sign-in is the primary, visually dominant option. Email/password is equally available, not
  hidden behind "other options".
- Password policy: minimum 10 characters, checked against a common-password blocklist
  (`zxcvbn` score ≥ 2). No forced complexity theatre or rotation.
- Passwords hashed with **argon2id**.
- Email must be verified before Today will generate plans, but the student can complete onboarding
  first — verification should never be the first wall they hit.
- If a student signs up with email/password and later uses Google with the same verified address,
  link the accounts rather than erroring.
- Rate limit: 5 login attempts per email per 15 minutes; 3 verification emails per hour.
- Age gate: a date-of-birth field at signup. Under-13s are blocked (UK GDPR consent age). Under-16s
  get reduced data collection and no marketing email. See doc 09.

### Post-auth routing

```
signed in ──► onboardingCompletedAt == null ──► /onboarding/subjects
           └► onboardingCompletedAt != null ──► /today
```

---

## 2. Onboarding

Four steps, a progress bar, everything resumable. Target: **under 10 minutes**.

### Step 1 — Subjects (`/onboarding/subjects`)

Pick any of Biology, Chemistry, Physics. Multi-select cards. At least one required.

### Step 2 — Year group, exam board and tier (`/onboarding/setup`)

**Year group** is asked first, because it changes how the whole app behaves (D26):

| Year        | What it means                                          | Default behaviour                                                                                                                                                                                                                          |
| ----------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Year 10** | Being taught the course now; GCSEs are ~20 months away | Plan mode defaults to `LEARNING_HEAVY`. The app's job is keeping pace with school and consolidating as you go, not revising a syllabus you haven't met. Exam dates optional; end-of-year exams and school tests are the near-term anchors. |
| **Year 11** | Revising; exams this academic year                     | Plan mode driven by exam proximity. Exam dates strongly prompted. Mock seasons (Nov, Jan) matter.                                                                                                                                          |
| **Other**   | Resitting, home-educated, private candidate            | Treated as Year 11 with exam dates as the only anchor.                                                                                                                                                                                     |

Then, for each selected subject:

- **Exam board** — AQA only, shown as a selected chip with "more boards coming" so the concept is
  established in the UI from day one.
- **Tier** — Foundation / Higher / **"Not sure yet"**. "Not sure yet" defaults content to Foundation
  scope but does not hide Higher material behind a hard wall; instead Higher-only content is labelled
  and de-prioritised by Today. Changeable any time in settings.
- **Exam dates** — optional here, promoted heavily later. Per paper (Paper 1 / Paper 2) with a
  "I don't know yet" default of "summer of [next exam series]".

### Step 3 — RAG rating (`/onboarding/rag`)

The most important screen in the app. One panel per subject, listing its **topics** (8–12 per
subject). Each topic gets one of four ratings:

| Rating       | Student-facing label | Meaning                  | What Today does with it                                                                    |
| ------------ | -------------------- | ------------------------ | ------------------------------------------------------------------------------------------ |
| `NOT_LEARNT` | "Haven't covered it" | Not taught yet in school | **Gated.** Lessons only scheduled once no `RED` or `AMBER` remains (see rules below)       |
| `RED`        | "Really struggle"    | Priority for revision    | Heaviest allocation: lesson recap → notes → flashcards → semi-blurt → scaffolded questions |
| `AMBER`      | "Bit shaky"          | Gaps to close            | Targeted notes + questions on weak sub-topics only                                         |
| `GREEN`      | "Confident"          | Confirm competency       | A few exam questions periodically to verify; drops down a rating if they fail              |

UX details:

- Four large segmented buttons per row, colour **and** label **and** icon (never colour alone —
  colour blindness, and roughly 1 in 12 boys is affected).
- "Rate all as X" shortcut per subject for the common cases ("I've covered none of this yet").
- A short, honest framing line: _"Be brutally honest — no one else sees this, and it only changes
  what we give you to do."_
- Sub-topics are **not** shown here (D19). They are collected progressively later.

### Step 4 — Availability (`/onboarding/availability`)

- Weekly grid, Monday–Sunday. Per day: number of minutes available, optionally with a preferred
  time-of-day. Defaults offered as one-tap presets: _School nights (30 min)_, _Serious (60 min
  weeknights, 2 hr weekends)_, _Light (20 min, 4 days)_.
- Daily goal in minutes is derived from this, and shown so the student sees the trade-off against
  their exam dates: _"At 30 min/day you'll get through Biology roughly 3 weeks before your exam."_
- Notification preference: off / email / browser push, with the chosen times. Tone is **gentle**
  throughout (D33) — see §8.
- **Holiday availability** is asked separately and lightly (D24): _"Term time is one thing —
  how much could you do per day in the holidays?"_ One number, changeable later. Students have
  radically different amounts of time in August than on a Tuesday in November, and a single
  weekly pattern models that badly.

Then: `onboardingCompletedAt` is stamped, first `DayPlan` is generated, redirect to `/today`.

### Progressive sub-topic RAG (post-onboarding)

The first time a student works inside a topic, Today inserts a 60-second micro-task:
_"Quick one — let's get specific about Cell Biology"_, listing that topic's sub-topics for RAG rating.
Resolution rule used everywhere:

```
effectiveRag(subTopic) = subTopicRating ?? parentTopicRating
```

The app may **suggest** rating changes ("You've scored 85%+ on Osmosis twice — move to Green?"),
but never silently overrides a student's rating.

---

## 3. Learn

**Purpose:** teach content from scratch, comprehensively, for `NOT_LEARNT` material and for `RED`
topics needing a full re-teach.

**Routes:** `/learn` → `/learn/[subject]` → `/learn/[subject]/[topic]` → `/learn/[subject]/[topic]/[lesson]`

### Lesson anatomy

A lesson is an ordered array of typed **blocks** (data, not code — D6 principle):

| Block type      | Renders as                                                                               |
| --------------- | ---------------------------------------------------------------------------------------- |
| `prose`         | MDX explanation, with KaTeX for equations and chemical notation                          |
| `keyIdea`       | Callout box — the one sentence that must be remembered                                   |
| `definition`    | Term + definition, styled for glanceability                                              |
| `example`       | Worked example, revealed step by step                                                    |
| `diagram`       | A hand-built SVG/React component by ID, with a text-alternative description (D18)        |
| `widget`        | An interactive component by ID with props (e.g. microscope magnification calculator)     |
| `check`         | Inline check-for-understanding: MCQ or one-mark short answer, answered before continuing |
| `misconception` | "Students often say X — here's why that's wrong"                                         |
| `specPointRef`  | Invisible marker binding the surrounding blocks to spec point codes                      |
| `summary`       | End-of-lesson recap, auto-linked to the matching Revise notes                            |

### Behaviour

- Blocks are revealed progressively; the student scrolls/advances through, with a thin progress rail.
- A `check` block must be attempted before the next block unlocks. Wrong answers show the explanation
  immediately — and **do not** generate a flashcard (cards come only from Test-context mistakes, D11),
  but they do feed the mastery estimate with a lower weight.
- Resume: `LessonProgress.lastBlockIndex` means a student always returns exactly where they left.
- Every lesson ends with a **mastery check**: 3–5 questions drawn from the real question bank. These
  _are_ Test-context, so wrong answers **do** create flashcards.
- Estimated time is shown up-front and is what Today uses for packing.
- **AI tutor** ("I don't get this") is available on every block: opens a side panel, grounded in the
  current block plus its spec points, capped turns, logged. See doc 06.

### Coverage guarantee

Learn must cover the whole specification for a subject/tier — every spec point must appear in at
least one lesson block. A CI check (`npm run content:coverage`) fails the build if any spec point in
the taxonomy has no lesson coverage, no notes coverage, or fewer than N questions. This is how
"comprehensive" becomes a testable property rather than an aspiration.

---

## 4. Revise

**Purpose:** fast, high-density recall and consolidation for material already learnt.

**Routes:** `/revise` hub → `/revise/[subject]/notes/[subTopic]`, `/revise/flashcards`,
`/revise/formulae/[subject]`, `/revise/practicals/[subject]`, `/revise/blurt/[promptSet]`

### 4.1 Concise notes

- One page per sub-topic. Ruthlessly short: bullet-dense, bolded key terms, tables over paragraphs.
- Higher-only content in a visually distinct band, hidden by default for Foundation students with a
  "show Higher content" toggle.
- Required practicals appear **inline** at the relevant point (D14), plus standalone (4.4).
- Sticky sub-topic contents rail on desktop (D22 — we have the width, use it).
- Every section carries its spec point codes, so Today can link to `#section` anchors precisely.
- Actions on every notes page: _Blurt this_, _Questions on this_, _Ask the tutor_.

### 4.2 Flashcards

Fully specified in [doc 07](./07-flashcards-fsrs.md). Summary:

- Cards exist **only** because the student got a question wrong (D11).
- Generated from the attempt: the missed mark-scheme point becomes the card, not the whole question.
- Scheduled with **FSRS-6** (`ts-fsrs`), four-button grading (Again / Hard / Good / Easy).
- Review UI: keyboard-first (space to flip, 1–4 to grade), sub-second transitions, shows which
  question it came from and links back to it.
- Cards suspend automatically once a student re-answers the source spec point correctly twice.

### 4.3 Formula / equation sheet

- Per subject, filtered by tier.
- Critically: split into **"given in the exam"** and **"must be recalled"** — this distinction is
  worth real marks in Physics and students routinely don't know it.
- Each equation lists symbols, units, and a one-tap "practise this" → calculation questions using it.
- A self-test mode: hide the equation, recall it, reveal.

### 4.4 Required practical sheets

- One page per required practical: aim, apparatus, method, variables (independent / dependent /
  control), results handling, sources of error, safety, and typical exam questions about it.
- Reachable standalone from the Revise hub _and_ inline in notes (D14).
- Given practicals are ≥15% of marks, Today treats practicals as a first-class task type, not an
  afterthought.

### 4.5 Semi-blurting (D15)

The distinctive feature. Between passive notes and rigid exam questions.

- A **prompt set** for a sub-topic contains 3–6 guided recall prompts, e.g.
  _"Name 3 subcellular structures found only in plant cells"_, _"Write everything you remember about
  how the microscope magnification equation is used"_.
- Student types freely into a textarea. No mark scheme rigidity, no command-word pedantry.
- Gemini scores **idea coverage** against an `expectedPoints` list: which ideas were present, which
  were missing, which were stated incorrectly.
- Output UI: a coverage bar, ticked ideas, and a "you didn't mention…" list that links straight into
  the relevant notes section.
- Missing ideas **do not** create flashcards (D11 — cards come from questions only), but they do
  lower the mastery estimate for those spec points, which makes Today schedule real questions on them.

---

## 5. Test

**Purpose:** exam-realistic practice and assessment for every topic, with AI marking.

**Routes:** `/test` hub → `/test/practice?set=…`, `/test/mini-mock/[id]`, `/test/mock/[id]`,
`/test/review/[attemptId]`

### 5.1 Question bank

All questions are **original, written in AQA style** (D5). Each question carries:

- The spec point(s) it assesses, tier, and paper
- Marks available and the **command word** (state, describe, explain, calculate, evaluate, suggest…)
- AO tag (AO1 / AO2 / AO3) and a difficulty estimate
- Type: `MCQ`, `SHORT`, `CALCULATION`, `EXTENDED` (4–6 mark), `PRACTICAL`, `DATA_RESPONSE`
- A structured mark scheme: an ordered list of credit-worthy points, each with accepted alternative
  wordings and reject lists, plus guidance and error-carried-forward rules

### 5.2 Practice mode

- Entered either from a topic, or (usually) from a Today deep link that says _"5 exam questions on
  osmosis"_ and lands on exactly those 5 questions.
- The set is **snapshotted** when the plan is generated, so the link is stable and resumable.
- Marking is immediate per question: objective types marked deterministically in-app; open responses
  marked by Gemini against the mark scheme (doc 06).
- After marking: the mark breakdown point-by-point, what was missing, the full mark scheme, a model
  answer, and a **"this mark looks wrong"** button.
- Wrong answers → flashcards (D11) and a mastery update.

### 5.3 Mini-mocks (D20)

- 20–30 minutes, ~25–30 marks, mixed topics, timed with a visible countdown.
- No feedback until submitted. Then a full breakdown plus a "what to do next" block that hands
  straight back to Today.
- Composition is weighted toward the student's weak spec points, but always includes 20–30% Green
  material so it acts as a genuine check rather than a punishment beating.
- Schedulable by Today as a single task.

### 5.4 Full mock papers (D20)

- Mirrors real AQA structure: correct **duration (1h45)**, **100 marks**, correct **paper/topic
  split**, correct **tier**, and an AO mix within AQA's published tolerances (AO1 37–43%, AO2 37–43%,
  AO3 17–23%), assembled from a **paper blueprint** rather than picked ad hoc.
- Ramped difficulty across the paper, multi-part structured questions, at least one 6-mark extended
  response, and practical-based questions worth ≥15% of the paper.
- Started deliberately by the student (Today will suggest one, but never silently drops a 105-minute
  task into a 30-minute evening).
- Full-screen focus mode, timer, flag-for-review, navigate between questions, autosave every answer.
- Submission triggers **batched** AI marking of all open responses in one request (cost control, doc 06).
- Results page: total, per-topic breakdown, per-AO breakdown, time-per-question, and an **estimated
  grade** from a configurable, clearly-labelled indicative boundary table ("estimate based on
  previous years' boundaries — not official").
- Results feed RAG suggestions, mastery, and flashcard generation in one pass.

---

## 6. Today

**Purpose:** the core of the app. Turns all user data into a concrete, ranked, deep-linked plan.
The algorithm is specified fully in [doc 05](./05-today-engine.md); this section is the UI.

**Route:** `/today`

### Layout (desktop-first, D22)

```
┌────────────────────────────────────────────────────────────────────┐
│  Good evening, Lucas.        🔥 12-day streak    ⏱ 0 / 45 min today │
│  ⚑ Biology class test in 4 days · Cell structure, Transport        │
├──────────────────────────────────────┬─────────────────────────────┤
│  TODAY'S PLAN                        │  AT A GLANCE                │
│  ┌────────────────────────────────┐  │  • 14 cards due             │
│  │ 1  Flashcards · 12 due   6 min │  │  • Biology P1 in 47 days    │
│  │    Because they're due today   │  │  • 3 Red topics left        │
│  │    [Start]            [Swap]   │  │  • Half term starts Mon     │
│  ├────────────────────────────────┤  │  THIS WEEK                  │
│  │ 2  5 exam questions            │  │  M T W T F S S              │
│  │    Osmosis · Biology    12 min │  │  ✓ ✓ ✓ • · · ·              │
│  │    You scored 3/8 here last    │  │                             │
│  │    Tuesday                     │  │  SUBJECT PROGRESS           │
│  │    [Start]            [Swap]   │  │  Bio   ███████░░░  68%      │
│  ├────────────────────────────────┤  │  Chem  ████░░░░░░  41%      │
│  │ 3  Lesson: Active transport    │  │  Phys  ██░░░░░░░░  22%      │
│  │    Biology · new       18 min  │  │                             │
│  │    [Start]            [Swap]   │  │                             │
│  └────────────────────────────────┘  │                             │
│  ⏲ I've only got  [15] [25] [45] min │                             │
└──────────────────────────────────────┴─────────────────────────────┘
```

### Behaviour

- **Every task is a deep link.** "Complete 5 exam questions on osmosis" opens exactly those 5
  questions; "Review 12 cards" opens exactly that FSRS queue; "Read notes on enzymes" opens that
  anchor. No task ever dumps the student on a hub page to go find something.
- **Every task states its reason** in one plain-English line. Trust in the plan comes from the
  student understanding _why_.
- **Swap** replaces a task with the next-best alternative of a different type or subject, and records
  the rejection as a weak negative signal.
- **"I've only got N minutes"** (D10) regenerates a shortened plan instantly, keeping only the
  highest-priority tasks that fit.
- Completing a task returns to Today with the item ticked, the timer advanced, and — if performance
  was notably bad — the remaining plan **re-ranked** on the spot.
- End-of-session summary: minutes done, marks earned, cards added, topics that moved.
- Missed days do **not** create an overdue backlog pile (see doc 05 — decayed priority boost instead).
- Exam-proximity modes shift the mix automatically: >8 weeks out = learning-heavy; 2–8 weeks =
  question-heavy; <2 weeks = retrieval and past-paper-style practice only.

---

## 7. School tests and the school calendar

Two features that make the plan fit a student's actual life rather than an idealised one.

### 7.1 School tests (D25)

**Route:** `/settings/tests`, plus a prominent "Add a school test" action on Today.

Real school assessments are the deadlines students actually feel. A GCSE in June is abstract; a
Biology test on Friday is not — and an app that ignores Friday will be ignored on Thursday.

Adding one takes about 20 seconds:

| Field                   | Notes                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ |
| Subject                 | From the student's enrolled subjects                                                                         |
| Date                    | Date picker, defaults to the next school day                                                                 |
| Kind                    | `CLASS_TEST` · `END_OF_TOPIC` · `SCHOOL_MOCK` — affects how much of the plan it may claim                    |
| Topics covered          | Multi-select over topics **and** sub-topics. This is the whole point — the student says exactly what's on it |
| Recurrence _(optional)_ | `NONE` · `WEEKLY` · `FORTNIGHTLY`, for schools that run a routine low-stakes quiz                            |

What happens then (algorithm in doc 05 §5):

- The selected sub-topics get a **temporary urgency boost** that ramps as the date approaches and
  drops to zero the day after.
- A countdown chip appears on Today: _"Biology class test in 4 days · Cell structure, Transport"_.
- If the test covers `NOT_LEARNT` content, a `LearningNowFlag` is **created automatically** for those
  sub-topics — the gate shouldn't stop a student preparing for a test on Friday. This is the
  cleanest use of the escape hatch in doc 05 §4.
- Allocation is **capped** so a single class test can't consume the whole revision plan:
  ≤ 40% of a session normally, ≤ 60% in the final three days, and never more than 80% even for a
  school mock. GCSEs are still the target.
- Afterwards, one gentle prompt: _"How did the Biology test go?"_ — three options
  (went well / mixed / badly), which becomes a `RagSuggestion` rather than an automatic change.

### 7.2 School calendar (D24)

**Route:** `/settings/calendar`

Pre-populated with a **default England school-year calendar** (autumn / spring / summer terms, three
half-terms, Christmas, Easter and summer holidays) for the current academic year. Every date is
editable, because term dates vary by local authority and academy trust — the default just means
almost nobody has to type anything.

Period types and what they change:

| Period                  | Effect on Today                                                                                                                                                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TERM`                  | Normal weekly availability. School is teaching new content, so `LearningNowFlag`s stay relevant.                                                                                                                                    |
| `HALF_TERM` / `HOLIDAY` | Switches to **holiday availability** (the separate number from onboarding). No new school content is being taught, so the plan leans consolidation-heavy. Longer contiguous blocks make this the natural home for full mock papers. |
| `STUDY_LEAVE`           | From the first exam to the last. Maximum intensity, and — critically — **sequenced by exam order**: the subject being sat on Thursday outranks everything else on Wednesday.                                                        |
| `EXAM_SEASON`           | Overlaps study leave; used to suppress anything that isn't retrieval practice.                                                                                                                                                      |

A one-off prompt at the start of each holiday: _"Half term starts Monday — how much do you want to
do each day?"_ Defaults to the holiday number, adjustable in one tap. The Easter holiday before
exams is the single highest-leverage revision window of the year, and the app should treat it that
way without nagging about it.

---

## 8. End of the exam season (D27)

When `now` passes the last exam date across all of the student's enrolments:

1. **A congratulations screen**, once. Genuine, calm, and final — _"That's it. Every exam done."_
   Alongside it, an honest summary of the whole journey: days revised, questions answered, marks
   earned, topics taken from Red to Green, cards retired. No score, no grade prediction, no upsell.
2. **Today and scheduling stop.** No plans generated, the nightly cron skips the account, reminders
   are cancelled, and the streak is frozen at its final value rather than broken.
3. **The app stays browsable.** Notes, lessons, past attempts and the progress history all remain.
   Nothing is deleted, nothing is locked. Students sometimes want to look back.
4. **An escape hatch:** _"Actually, I've got a resit"_ re-enables scheduling with new exam dates.
   Without this, a November resit candidate is locked out of the thing they need most.

Deliberately deferred, in this order:

- **English and Maths resit support** — the obvious next need for students who didn't get a grade 4.
  Requires two new subjects and a different content model (Maths especially), so it is its own
  project, not a bolt-on.
- **A-level pathway** — a natural progression for students who did well, and a way to keep an
  account alive across the summer. Same architecture, entirely new content.

Both are noted in the data model so the post-exam screen can eventually offer a next step instead of
a dead end.

---

## 9. Cross-cutting UI

### 9.1 Brand and tone (D23)

**ReviseIQ is a serious revision tool.** The reference points are a well-made textbook, Linear, and
the Financial Times — not Duolingo.

| Do                                                   | Don't                                     |
| ---------------------------------------------------- | ----------------------------------------- |
| Calm, high-contrast, typography-led layouts          | Mascots, characters, cartoon illustration |
| Generous whitespace; content is the interface        | Confetti storms, slot-machine animations  |
| Subject accents used sparingly as wayfinding         | Rainbow gradients, decorative colour      |
| Direct, warm copy that respects the reader           | Hype, exclamation marks, forced jollity   |
| Progress shown as evidence — marks, coverage, trends | Points, levels, badges, trophies          |

**No XP, no levels, no achievements (D35).** The tension between a serious tool and a gamified one
was resolved by removing the game layer rather than restyling it. What remains is a **streak**
(consistency is the one behaviour genuinely worth reinforcing), a **daily minutes goal**, and
**honest progress statistics** — marks per question over time, RAG movement, spec coverage, time
revised. Those are evidence of progress, which is what a serious student actually wants. Points
are a proxy for progress; we have the real thing, so we don't need the proxy.

**Voice:** second person, plain English, short sentences. Never patronising — a 15-year-old can tell
instantly, and will hold it against the app. Honest about weakness, never harsh about it.

### 9.2 Notification tone (D33)

Gentle and invitational, always:

- ✅ _"Ready when you are — 25 minutes gets you through today's plan."_
- ❌ _"You're about to lose your 12-day streak!"_

Rules: maximum **one** reminder a day plus one weekly summary. No loss-framing, no guilt, no
counting how long it's been since they last opened it. A missed day silently consumes a streak
freeze rather than generating a warning. The off switch is one tap and is never buried. This is
both the right call for anxious 15-year-olds and what the ICO Children's Code expects (doc 09 §2).

### 9.3 General

- **Navigation:** persistent left sidebar on desktop (Today, Learn, Revise, Test, Progress,
  Settings); bottom tab bar under `md`.
- **Design language:** calm, high-contrast, generous whitespace, one accent colour per subject
  (Biology green, Chemistry blue, Physics purple) used consistently across every surface.
- **Dark mode** from day one — students revise at night.
- **Print stylesheets** on notes, formula sheets and practical sheets from early on — the cheap 90%
  of D28. Real PDF export (including a "mistakes booklet" generated from flashcards) comes later.
- **Accessibility:** WCAG 2.2 AA target. Full keyboard operability (essential for flashcards),
  visible focus, no colour-only meaning, `prefers-reduced-motion` respected, a dyslexia-friendly font
  toggle, and adjustable text size. SVG diagrams get real text alternatives, not `alt=""`.
- **Progress page** (`/progress`): RAG heatmap per subject, mastery over time, marks-per-question
  trend, time revised, exam countdowns. Honest, not inflated.
- **Settings** (`/settings`): subjects, tiers, exam dates, availability, notifications, RAG re-rate,
  account, data export and deletion.
