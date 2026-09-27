# 08 — Roadmap

**D9 + D30: the first milestone is a vertical slice — Biology `4.1.1 Cell structure`, one sub-topic,
all four pages genuinely working end to end.** Everything below is ordered to get there, then to
widen.

`4.1.1` is a well-chosen slice: it is diagram-dense (exercising the hand-built SVG approach, D18),
it carries a required practical, it involves a maths skill, and it contains Higher-only material —
so it exercises tier filtering, practical sheets, widgets and the formula/maths handling rather
than just prose. Confirm the exact spec-point list at handover.

Sizes are relative (S / M / L / XL). Each phase is one pull request on
`arena/01a0de94-reviseiq-student-hub`, demoable on a Vercel preview before the next begins.

## Against the September 2027 target (D34)

Roughly twelve months from now. Indicative, assuming steady progress:

| Window              | Phases  | Milestone                                                                          |
| ------------------- | ------- | ---------------------------------------------------------------------------------- |
| Oct – Nov 2026      | P0–P3   | Deployed app, auth, onboarding, content spine, `4.1.1` authored                    |
| Dec 2026 – Jan 2027 | P4–P5   | Learn working; AI marking working                                                  |
| Feb – Mar 2027      | P6–P7   | Revise + FSRS; **Today engine — the vertical slice is done**                       |
| Apr 2027            | P8      | Mocks, grade estimates                                                             |
| May 2027            | P9–P10  | Habit layer, calendar/school tests, tutor, widgets — **software feature-complete** |
| Jun – Sep 2027      | P11–P13 | Hardening, PDF export, and **all remaining capacity on content**                   |

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

## Phase 3 — Content spine · **L**

The pipeline from doc 04, exercised on your first real Biology source material.

- Zod content schemas; `/content` structure; MDX + KaTeX rendering
- `taxonomy.ts` for Biology `4.1.1 Cell structure` — spec points, tiers, practical links.
  **Agreed with you first, before any prose is written** (doc 04 step 2)
- `content:validate` (schema + coverage) wired into CI; `content:seed` (idempotent, upsert by ID)
- First topic's lessons, notes, questions + mark schemes, blurt prompts, practical sheets
- The diagram registry and the first 2–3 hand-built SVG components (D18)

**Exit:** `npm run content:seed` populates Postgres from files; the coverage report prints an honest
per-sub-topic table; CI fails on a deliberately broken content file.

---

## Phase 4 — Learn · **L**

- Block renderers for every block type (doc 01 §3)
- Lesson runner: progressive reveal, progress rail, resume, inline `check` blocks
- End-of-lesson mastery check drawing from the real question bank
- `LessonProgress` tracking and time-on-task
- (AI tutor deferred to P10 — the "I don't get this" button ships disabled with a "coming soon")

**Exit:** a student can work through a complete Biology lesson, be stopped by checks, leave halfway
and resume exactly where they were.

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

## Phase 10 — AI tutor + interactive widgets · **L**

- Grounded, streamed in-lesson tutor with turn caps, refusal behaviour and full logging (doc 06 §4)
- **"Why did I lose this mark?"** (D31) — the answer-aware tutor on the marking breakdown, with the
  after-marking-only guardrails
- The first interactive widgets (D13): label-the-diagram built on existing SVG components,
  then 2–3 genuinely interactive simulations chosen for where they teach best

**Exit:** "I don't get this" gives a useful, on-spec explanation; "why did I lose this mark?"
correctly diagnoses a real misconception; at least one widget makes a concept clearer than prose.

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
