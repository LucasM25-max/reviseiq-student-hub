# 08 — Roadmap

**D9 + D30: the first milestone is a vertical slice — Biology `4.1.1 Cell structure`, one sub-topic,
all four pages genuinely working end to end.** Everything below is ordered to get there, then to
widen.

`4.1.1` is diagram-dense (exercising the hand-built SVG approach, D18), it carries a required
practical, and it involves a maths skill — so it exercises practical sheets, widgets and maths
handling rather than just prose.

> **Correction (27 Sep 2026).** This section previously claimed `4.1.1` also contains Higher-only
> material and would therefore exercise tier filtering. Checking the specification directly, it
> does not: the only HT-only line in the whole of `4.1.1` is in `4.1.1.6`. **Tier filtering will
> still be untested when the vertical slice is declared done**, and a green build is not evidence
> that it works. The first real test of it arrives with whichever slice first carries HT content.
>
> Scope has also narrowed and reordered. Slices now follow AQA's scheme-of-work teaching order
> rather than specification numbering (D44), which puts `4.1.1.2` first. See
> [`slices/`](./slices/) for what is actually being authored.

Sizes are relative (S / M / L / XL). Each phase is one pull request on
`arena/01a0de94-reviseiq-student-hub`, demoable on a Vercel preview before the next begins.

## Against the September 2027 target (D34)

Roughly twelve months from now. Indicative, assuming steady progress:

| Window              | Phases  | Milestone                                                               |
| ------------------- | ------- | ----------------------------------------------------------------------- |
| Oct – Nov 2026      | P0–P3   | Deployed app, auth, onboarding, content spine, `4.1.1.2` authored       |
| Dec 2026 – Jan 2027 | P4, P4b | Learn + widget engines; **practical engine**                            |
| Feb – Mar 2027      | P5–P6   | AI marking working; Revise + FSRS                                       |
| Apr 2027            | P7      | **Today engine — the vertical slice is done**                           |
| May 2027            | P8–P9   | Mocks, grade estimates, habit layer                                     |
| Jun 2027            | P10–P11 | Tutor, calendar/school tests, hardening — **software feature-complete** |
| Jul – Sep 2027      | P12–P13 | PDF export, and **all remaining capacity on content**                   |

> **Re-planned 27 Sep 2026, and it costs a month.** Adding the practical engine (P4b, XL) and
> moving the widget engines forward pushes the vertical slice from March to **April 2027** and
> shortens the final content window from four months to **three**. Content was already the binding
> constraint against D34, so this is a real cost, not a rounding error.
>
> Two things make it worth paying. The widget move is not optional — Phase 10 previously owned the
> first interactive widgets, but lessons 1 and 2 of the very first slice use four of them, so
> leaving them in P10 would mean shipping the first lessons with holes in them for five months.
> And the practical engine is what turns a required practical from something a student reads into
> something they do.
>
> **The lever, if the slip is unacceptable:** move P4b to after P7. The vertical slice then lands
> in March as originally planned and RP1 ships as a static practical sheet until the engine
> arrives. Nothing else in the plan depends on it.

**The honest risk:** the software fits comfortably; three subjects × two tiers × a full spec in the
remaining window does not, on any realistic authoring rate. Two ways to land it:

- **Recommended — go deep.** Biology to 100% for launch, Chemistry and Physics arriving during the
  2027/28 academic year. A student with one subject fully covered gets real value; a student with
  three subjects 60% covered hits a wall in every one of them.
- **Go wide.** All three subjects covering Paper 1 only, with Paper 2 following in spring 2028 —
  which happens to match the order students actually revise in.

Worth deciding by around March 2027, when the real authoring rate is known rather than guessed.

---

## Dependency graph

```
P0 Foundations
 └─► P1 Auth ─► P2 Onboarding + RAG ─┐
 └─► P3 Content spine ───────────────┼─► P4 Learn ──┐
                                     │              ├─► P7 TODAY ─► P8 Mocks
                                     └─► P5 Test ───┤              │
                                             └─► P6 Revise/FSRS ───┘
                                                                    └─► P9 Habit
                                                                    └─► P10 Tutor + widgets
                                                                    └─► P11 Hardening
                                                                    └─► P12 Content scale-out
                                                                    └─► P13 PDF export
```

P5 must precede P6 because flashcards only exist as a consequence of wrong answers (D11).
P7 must follow P4–P6 because Today has nothing to link to until they exist — but a **stub Today**
ships in P2 so the app is navigable from the start.

---

## Phase 0 — Foundations · **M** · ✅ **Done**

Scaffold, infrastructure, and the design system.

- Next.js 15 + TypeScript strict + Tailwind + shadcn/ui; app shell, nav, dark mode
- Neon Postgres (EU region), Prisma, first migration
- Env validation module; Sentry; GitHub Actions CI (typecheck, lint, unit, build)
- Vercel project, preview deploys, Neon branching per preview
- Design tokens: subject accent colours, typography scale, spacing, focus states

**Exit:** an empty but deployed app with a working DB connection, CI green, and a component gallery.

> **As built.** Next.js **16** (released since this was written) with Tailwind v4 and a
> hand-rolled UI kit rather than shadcn/ui — the same primitives, no generator dependency, and
> every component is one we can read. Prisma 7 with the `@prisma/adapter-pg` driver adapter.
> Migrations are hand-authored SQL applied by `scripts/db-migrate.mjs`; `prisma migrate` is not
> used. Local development runs an **embedded PostgreSQL** (`npm run db:start`) so no Docker or
> system Postgres is needed. Sentry, Vercel and Neon are deferred until there is something to
> deploy. CI runs typecheck, lint, format, tests, build and the smoke test.

---

## Phase 1 — Auth · **M** · ✅ **Done**

- Auth.js v5 split config (`auth.config.ts` edge-safe, `auth.ts` Node-only with Prisma adapter)
- Google OAuth + credentials (argon2id), JWT sessions
- Email verification and password reset via Resend; account linking on matching verified email
- Date-of-birth age gate (under-13 blocked); rate limiting on auth endpoints
- `middleware.ts` coarse protection + `requireStudent()` server guard

**Exit:** sign up both ways, verify, reset, log out, log in, hit a protected route.

> **As built.** `@node-rs/argon2` for hashing rather than a JS implementation. The file
> convention is `src/proxy.ts`, not `middleware.ts` — Next 16 renamed it. Google sign-up has no
> date of birth, so it routes through a dedicated `/onboarding/date-of-birth` step and an
> under-13 result deletes the account before signing out to `/too-young`. Unverified users can
> sign in and onboard behind a persistent banner rather than being blocked, because locking a
> student out of setup over an unread email is worse than the risk it avoids. Rate limiting uses
> a Postgres `RateBucket` with an atomic upsert; no Redis. Every flow is covered end to end by
> `npm run smoke`.

---

## Phase 2 — Onboarding + RAG · **M** · ✅ **Done**

- The four onboarding steps (doc 01 §2), resumable, with a progress bar
- **Year group** selection (D26) — it changes defaults everywhere downstream
- Subject / board / tier / exam date selection; `SubjectEnrolment` + `ExamDate`
- Topic-level RAG screen with the four ratings (D19)
- Weekly availability grid + daily goal + **holiday goal** + reminder preferences
- **Stub Today** — real layout, placeholder tasks, so the shell is complete

**Exit:** a new account can complete onboarding in under 10 minutes and land on Today.

> **As built.** Four steps — subjects, setup (year group, exam series, per-subject tier), RAG,
> availability — with `canVisit`/`furthestOf` guards so a student can go back but never skip
> ahead, and a `returnTo` parameter so Settings can reuse the same forms. Deselecting a subject
> deactivates the enrolment instead of deleting it, so ratings survive a change of mind. Every
> step works with JavaScript disabled, which the smoke test proves by never running any.
> Exam dates are estimated from the AQA series and marked unconfirmed until the student says
> otherwise. Stub Today is explicitly labelled as a preview in the UI.

---

## Phase 3 — Content spine · **L** — ✅ Done

The pipeline from doc 04, exercised on your first real Biology source material.

- [x] Zod content schemas; `/content` structure; **Markdown** + KaTeX rendering
- [x] `taxonomy.ts` for Biology `4.1.1 Cell structure` — spec points, tiers, practical links.
      **Agreed with you first, before any prose is written** (doc 04 step 2)
- [x] `content:validate` (schema + coverage) wired into CI; `content:seed` (idempotent, upsert by ID)
- [x] First topic's lessons, notes, questions + mark schemes, blurt prompts, practical sheets
- [x] The diagram registry and the first **three** hand-built SVG components (D18)
- [x] **The RP1 fault table, authored as content data** (D50), and the five practical questions
      derived from it — neither waited for the simulation engine in P4b

**Exit — met.** `npm run content:seed` populates Postgres from files and is proven idempotent in
CI; `npm run content:report` prints an honest per-sub-topic table that shows two sub-topics as
`partial` rather than rounding them up to green; CI fails on deliberately broken content.

**What shipped:** 3 lessons, 7 note sections, 4 blurt prompts, 17 questions (45 marks, AO split
exactly 40/40/20, all six question types, 31.1% practical), 1 required practical with a 9-fault
table, 5 spec points. Four routes render it: the lesson index, a lesson, the revision notes and
the practical sheet.

**Two deviations from the plan as written, both deliberate:**

1. **Markdown, not MDX.** MDX allows arbitrary JSX, which zod cannot validate and Postgres cannot
   store inert. Content is `react-markdown` + `remark-gfm` + `remark-math` + `rehype-katex`, with
   no `rehype-raw`, so a lesson body is data rather than code. Interactivity comes from the typed
   `widget` and `diagram` block types instead, which the validator can check.
2. **`content:validate` runs in three ordered layers** — schema, then cross-reference, then
   coverage gates — and stops at the first that fails. Parsing has to succeed before references
   mean anything. The consequence for testing is that one broken file cannot exercise all three
   layers, so `tests/fixtures/broken-content/` holds three permanently-broken fixtures, one per
   layer, and CI asserts each is rejected.

**Bugs found and fixed by exercising it,** rather than by reading it:

- Seven of thirteen SVG labels overflowed their viewBox and were clipped in the browser. Both
  cell diagrams were relaid out around a single right-hand label column, and
  `tests/diagrams.test.ts` now renders each diagram and measures every label against the viewBox.
- Two leader lines pointed at the wrong organelle, and the mitochondria cristae were not rotated
  with their lozenges, so they escaped the outline.
- Lettered structures rendered as `A — Cell wall`. Question q03 asks _"Name the structures
  labelled A, B and C"_ over that diagram, so the figure printed its own answer. Lettering now
  **replaces** the name rather than appending to it, which makes the giveaway unreachable rather
  than merely fixed.
- Lesson pages jumped from `h1` straight to `h3`/`h4`, leaving a hole in the outline a
  screen-reader user navigates by. Bodies now author `##` as their top-level heading and the
  renderer shifts the run to the depth its container sits at (D54).
- `content:seed` pruned stale rows with `Promise.all`, under a comment promising "children
  first". Concurrent cascades into the same join table are a deadlock waiting for a large
  enough content set.
- `npm run audit:prod` went red on four high-severity advisories reaching the production tree
  through the `prisma` CLI that `@prisma/client` depends on. Pinned via `overrides` — see the
  README.

---

## Phase 4 — Learn + widget engines · **XL**

- Block renderers for every block type (doc 01 §3)
- Lesson runner: progressive reveal, progress rail, resume, inline `check` blocks
- End-of-lesson mastery check drawing from the real question bank
- `LessonProgress` tracking and time-on-task
- **The four generic widget engines** (D40): `label-the-diagram`, `comparison-table`,
  `scale-explorer`, `card-sort` — moved forward from P10, because lessons 1 and 2 of the first
  slice use all four and a `widget` block cannot render without them
- (AI tutor deferred to P10 — the "I don't get this" button ships disabled with a "coming soon")

**Exit:** a student can work through a complete Biology lesson, be stopped by checks, leave halfway
and resume exactly where they were.

---

## Phase 4b — Practical engine · **XL**

New workstream, added 27 Sep 2026 (D45). Sits after Learn because the practical renders as a
lesson block and is that system's most demanding consumer — a good architectural stress test early
rather than late. Required practicals are built as interactive simulations
a student actually performs, starting with **RP1 Microscopy**. Fully specified in
[`slices/biology-4.1.1.2-animal-and-plant-cells.md`](./slices/biology-4.1.1.2-animal-and-plant-cells.md) §4.

- Pure, DOM-free state machine: reducer, fault model, optics, graticule arithmetic, rubric (D46)
- The `microscope-practical` widget — a thin React renderer over derived state
- SVG cell fields at three magnifications, with focus, stain, iris and bubble states
- Freehand drawing captured as vectors; deterministic geometry rubric; narrowly-scoped AI
  judgement; advisory-only marks (D47)
- Keyboard-operable throughout, with a live text description of the field of view

**Why it is its own phase:** it is the largest component in the product after the Today engine, and
it does not belong inside a content pipeline. **It must not block `4.1.1.2`** — lessons 1–2, notes
and the content question bank ship first, with the practical arriving behind them.

**Why the questions do not wait for it (D50):** the fault table is _data_, authored in Phase 3
alongside the rest of the content. The engine in this phase renders it. That split is what lets the
five practical questions be written and marked months before the simulation exists, while still
guaranteeing they never drift from it — there is still only one fault table.

**The risk to manage:** this is the kind of component that sits at 80% done for a long time. Build
it against the fixed fault table and acceptance list in the slice doc, and stop when they pass,
rather than polishing open-endedly.

**Exit:** a student completes all 20 steps of AQA's student sheet, makes a technique mistake, sees
the consequence in the field of view, and answers an exam question about why that step matters —
with the whole simulation's logic covered by `vitest` and no browser required.

---

---

## Phase 5 — Test + AI marking · **XL**

The highest-risk phase; budget accordingly.

- Question renderers per type; answer capture and autosave
- Deterministic marking for objective types
- `/lib/ai` — Gemini client, versioned prompts, response schemas, post-processing, `MarkCache`,
  `AiUsage` ledger, per-user quotas, global ceiling, deterministic fallback (doc 06)
- `POST /api/ai/mark`; marking UI with point-by-point breakdown, mark scheme, model answer
- "I think this mark is wrong" dispute flow
- Practice mode driven by `QuestionSet` snapshots
- `SpecPointMastery` updates from attempts
- **Golden set** of hand-marked answers + the agreement test in CI

**Exit:** answer a 6-mark extended response, get a credible point-by-point AI mark in under 4
seconds, see the mark scheme, dispute it. Golden set agreement ≥ 90% within ±1 mark.

---

## Phase 6 — Revise + FSRS · **L**

- Notes pages with sticky contents, tier toggle, stable section anchors, inline practicals
- Formula sheet with the `givenInExam` split and self-test mode
- Standalone required-practical sheets
- **Flashcards**: creation from wrong attempts, `CardTemplate` global cache, anti-flood caps,
  `ts-fsrs` wrapper, keyboard-first review UI, undo, suspend, leech handling, retirement (doc 07)
- **Semi-blurting** (D15): prompt sets, free-text capture, `POST /api/ai/blurt` coverage scoring,
  coverage UI linking back into notes

**Exit:** get a question wrong → a card appears → review it with FSRS → the interval behaves
correctly. Complete a blurt and get honest idea-coverage feedback.

---

## Phase 7 — The Today engine · **XL**

The payoff phase. Everything before it exists so this can work.

- `/lib/today` pure scheduler: plan modes, candidate generation, the `NOT_LEARNT` gate and its three
  escape hatches, priority scoring, session packing, duration personalisation (doc 05)
- `DayPlan` / `PlanTask` materialisation; nightly Vercel Cron + on-demand generation
- Deep links with prepared payloads for every task type
- Task completion flow with `?task=` round-tripping; adaptive re-ranking on surprising performance
- "I've only got N minutes" (D10); swap; rationale templates
- Cold-start diagnostics (doc 05 §7)
- Progressive sub-topic RAG refinement tasks; `RagSuggestion` prompts
- **Year 10 vs Year 11 behaviour** (D26) — `KEEPING_PACE` mode, monthly "what's school covering?"
- **School calendar** (D24) — default England term dates, editable, holiday availability,
  study-leave and exam-day handling
- **School tests** (D25) — add/edit UI, topic scoping, urgency ramp, allocation caps, auto
  `LearningNowFlag`, the post-test "how did it go?" prompt
- **End-of-exam-season termination** (D27) — congratulations screen, scheduling stop, resit hatch
- The archetype fixture suite and plan invariant tests

**Exit — this is the vertical slice done.** A student completes onboarding, opens Today, is told to
review 12 cards and do 5 questions on a named sub-topic, clicks straight into exactly that, gets
AI-marked, generates cards from mistakes, returns to a ticked-off plan, and gets a different,
sensible plan tomorrow.

---

## Phase 8 — Mocks · **L**

- `PaperTemplate` blueprints (topic weights, AO mix, type mix, ≥15% practical, difficulty ramp)
- Assembly engine weighted toward weak spec points, with a Green floor
- Mini-mocks (20–30 min) — schedulable by Today
- Full papers: 1h45, 100 marks, focus mode, timer, flag-for-review, autosave
- Batched submission marking (`/api/ai/mark-batch`) as a background job
- Results: total, per-topic, per-AO, time-per-question, indicative grade estimate from a
  configurable boundary table, clearly labelled as an estimate
- Results feed mastery, RAG suggestions and card generation in one pass

**Exit:** sit a full assembled Biology Paper 1, get marked within 30 seconds of submitting, and see
Today's plan change as a result.

---

## Phase 9 — Habit layer · **M**

- Streaks with a streak-freeze; daily minutes goal; honest progress page
- **No XP, levels or achievements** (D35) — progress is shown as evidence: marks per question over
  time, RAG movement, spec coverage, time revised
- Web push (VAPID) + email reminders at chosen times, via Vercel Cron
- Weekly summary email
- **Gentle-tone copy pass** (D33) across every notification and empty state — no loss-framing,
  no guilt, one reminder a day maximum

**Exit:** a student who revises four days running sees a streak and an honest progress picture,
and is invited — not pressured — back at 18:30.

---

## Phase 10 — AI tutor · **M**

- Grounded, streamed in-lesson tutor with turn caps, refusal behaviour and full logging (doc 06 §4)
- **"Why did I lose this mark?"** (D31) — the answer-aware tutor on the marking breakdown, with the
  after-marking-only guardrails
- (Interactive widgets moved to P4; the practical simulation is P4b)

**Exit:** "I don't get this" gives a useful, on-spec explanation; "why did I lose this mark?"
correctly diagnoses a real misconception.

---

## Phase 11 — Hardening · **M**

- Accessibility audit against WCAG 2.2 AA; keyboard paths; screen reader pass on flashcards and the
  exam runner; dyslexia font and text sizing
- Performance against the doc 02 targets
- UK GDPR work: privacy policy, terms, DPIA, data export, hard deletion, retention policy (doc 09)
- Cost dashboard; load test of the marking path; abuse testing including prompt injection
- Error and empty states everywhere; offline-ish resilience for flaky connections

**Exit:** ready to put in front of real students who are not you.

---

## Phase 12 — Content scale-out · **XL, ongoing**

Repeat the doc 04 loop, topic by topic: remaining Biology → Chemistry → Physics, both tiers.
Revisit **D4** (hand-authoring per topic) once the third topic is done — if the pattern has
stabilised, invest in `content:generate` with a review PR.

**Exit:** the coverage report shows 100% of the spec covered for lessons, notes and questions at
both tiers, for the subjects in scope (see the go-deep / go-wide decision above).

---

## Phase 13 — PDF export · **S**, runs alongside P12

D28, in two steps, cheapest first:

1. **Print stylesheets** on notes, formula sheets and practical sheets. Ships much earlier (Phase 6
   is fine) and delivers most of the value — a lot of students revise on paper.
2. **Real PDF generation** for anything print CSS can't do well: a formula booklet, a per-topic
   revision pack, and a **"mistakes booklet"** compiled from the student's own flashcards. That
   last one is the interesting product — a personalised revision guide made entirely of things they
   have actually got wrong, which is exactly what you'd want to take into a study session.

**Exit:** a student can print clean notes, and download a mistakes booklet for a subject.

---

## Build order (D29)

**Learn before Test.** The natural order:

**P0 → P1 → P2 → P3 → P4 → P5 → P6 → P7 → P8 → P9 → P10 → P11 → P12/P13**

The alternative of moving Test ahead of Learn — to de-risk AI marking earlier and get a more
impressive demo sooner — was considered and **rejected**. Learn first means the slice grows the way
a student experiences it, and it means the first content authored (`4.1.1`) is exercised by lessons
and notes before it has to carry a question bank too.

One partial hedge worth taking: build a **throwaway marking spike** during Phase 4 — one hardcoded
question, one mark scheme, one Gemini call, no UI. Half a day, and it retires the single biggest
technical unknown months before Phase 5 depends on it.
