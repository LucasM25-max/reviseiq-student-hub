# 02 — Architecture

## Stack

| Layer             | Choice                                                                  | Why                                                                                                                       |
| ----------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Framework         | **Next.js 15+, App Router, React 19, TypeScript strict**                | Server Components keep content rendering cheap; Server Actions remove most API boilerplate; one deploy target.            |
| Styling           | **Tailwind CSS + shadcn/ui** (Radix primitives)                         | Accessible components we own the source of, not a black-box library.                                                      |
| Auth              | **Auth.js v5** (`next-auth@beta`) + `@auth/prisma-adapter`              | Google OAuth and credentials in one system, with full control over the user table.                                        |
| ORM / DB          | **Prisma + PostgreSQL**                                                 | The Today engine is relational: it joins attempts × spec points × RAG × FSRS state. This is exactly what Postgres is for. |
| DB host           | **Neon**, EU (London `eu-west-2` if available, else `eu-central-1`)     | Serverless Postgres, branching for preview deploys, UK/EU data residency for children's data.                             |
| AI                | **Google Gemini `gemini-3.8-flash`** via `@google/genai`                | D8. Structured output, 1M context, cheap enough for per-answer marking.                                                   |
| Spaced repetition | **`ts-fsrs`** (FSRS-6, MIT)                                             | D12.                                                                                                                      |
| Email             | **Resend** + React Email                                                | Verification, password reset, revision reminders.                                                                         |
| Validation        | **Zod** everywhere — forms, server actions, AI responses, content files | One schema definition reused as TS types.                                                                                 |
| Maths/chemistry   | **KaTeX** via `rehype-katex`                                            | Equations and chemical notation in content.                                                                               |
| Content           | **MDX + TypeScript modules in-repo**, compiled and seeded to Postgres   | Git-versioned source of truth, relational query layer. See doc 04.                                                        |
| Testing           | **Vitest** (unit) + **Playwright** (E2E)                                | The Today engine and FSRS wrapper are pure functions — heavily unit-tested.                                               |
| Errors/analytics  | **Sentry** + **Vercel Analytics**                                       | Plus a bespoke `AiUsage` cost table.                                                                                      |
| Hosting           | **Vercel**                                                              | D1. `GEMINI_API_KEY` as an encrypted env var (D8).                                                                        |

### Deliberate non-choices

- **No Supabase/Firebase.** D1 — we own the auth and data layer.
- **No Redis in v1.** Rate limiting and AI quotas use a Postgres token-bucket table. One fewer
  service, one fewer bill; swap to Upstash if write contention shows up.
- **No separate backend service.** Next.js route handlers and server actions are the backend. If the
  content-generation pipeline grows heavy, it becomes an offline script, not a service.
- **No state management library.** Server Components + URL state + `useOptimistic`. Introduce Zustand
  only if a genuinely client-heavy surface (the mock exam runner) demands it.

---

## Auth implementation notes

Auth.js v5 has two sharp edges worth writing down now:

1. **The Credentials provider forces `session: { strategy: "jwt" }`** when used with a database
   adapter. Database sessions and credentials do not mix. We use JWT sessions and keep our own
   `StudentProfile` row keyed by user ID for anything stateful.
2. **Split config is mandatory with the Prisma adapter.** `auth.config.ts` holds edge-safe providers
   and callbacks and is what `middleware.ts` imports; `auth.ts` adds the Prisma adapter and is only
   imported from the Node runtime. Importing `auth.ts` into middleware pulls Prisma into the edge
   runtime and breaks the build.

```
auth.config.ts   ← edge-safe: providers list, authorized callback, custom pages
auth.ts          ← Node-only: PrismaAdapter, argon2 verification, jwt/session callbacks
middleware.ts    ← imports auth.config.ts only
```

Route protection lives in middleware for the coarse check (signed in or not) plus a
`requireStudent()` helper in server components/actions for the real check, because middleware alone
is not an authorisation boundary.

---

## Route map

```
/                                  Splash (redirects to /today when signed in)
/signup  /login  /reset-password  /verify-email

/onboarding/subjects
/onboarding/setup                  Board + tier + exam dates
/onboarding/rag                    Topic-level RAG
/onboarding/availability           Weekly pattern + reminders

/today                             The plan
/today/session/[taskId]            Optional focus wrapper with a timer

/learn
/learn/[subject]
/learn/[subject]/[topic]
/learn/[subject]/[topic]/[lesson]

/revise
/revise/[subject]/notes/[subTopic]
/revise/flashcards                 FSRS queue
/revise/formulae/[subject]
/revise/practicals/[subject]
/revise/practicals/[subject]/[n]
/revise/blurt/[promptSetId]

/test
/test/practice                     ?set=<questionSetId>
/test/mini-mock/[attemptId]
/test/mock/[attemptId]
/test/review/[attemptId]

/progress
/settings/[...section]        # subjects, tiers, exam dates, availability, notifications, account
/settings/tests               # school tests (D25) — add, edit, topics covered
/settings/calendar            # term dates and holidays (D24)
/settings/rag/[topicId]       # progressive sub-topic RAG refinement
/finished                     # end-of-exam-season congratulations (D27)

# API route handlers (streaming / non-form work only)
POST /api/ai/mark                  Single open-response marking
POST /api/ai/mark-batch            Mock submission — all answers in one call
POST /api/ai/blurt                 Semi-blurt coverage scoring
POST /api/ai/tutor                 Streaming in-lesson tutor
POST /api/plan/regenerate          "I've only got N minutes"
POST /api/cron/daily-plan          Vercel Cron — nightly plan generation
POST /api/cron/reminders           Vercel Cron — push/email reminders
```

Everything else (RAG updates, task completion, settings, availability) uses **Server Actions**.

---

## Folder layout

```
/app
  (auth)/                  signup, login, reset, verify
  (onboarding)/            the four onboarding steps
  (app)/                   authenticated shell: today, learn, revise, test, progress, settings
  api/
/components
  ui/                      shadcn primitives
  learn/                   block renderers, one per block type
  diagrams/                hand-built SVG components (D18), registry-keyed
  widgets/                 interactive Learn widgets (D13), registry-keyed
  test/                    question renderers, mark breakdown, exam runner
  revise/                  notes, flashcard review, formula sheet, blurt
  today/                   task cards, plan list, quick-session control
/lib
  auth/                    auth.ts, auth.config.ts, guards
  db/                      prisma client, query helpers
  ai/                      gemini client, prompts, schemas, cache, quota, cost
  today/                   ← the scheduler. Pure, dependency-free, heavily tested
  fsrs/                    ts-fsrs wrapper
  mastery/                 mastery estimation from attempts
  content/                 zod schemas, loaders, validators
/content
  biology/
    taxonomy.ts            topics → sub-topics → spec points
    lessons/               *.mdx
    notes/                 *.mdx
    questions/             *.ts (question + mark scheme pairs)
    practicals/            *.mdx
    blurts/                *.ts
    formulae.ts
  chemistry/ physics/      same shape
/prisma
  schema.prisma
  seed.ts                  content files → database
/scripts
  content-validate.ts      zod + coverage checks, runs in CI
  content-seed.ts
/docs/plan                 this plan
/tests
  unit/  e2e/
```

---

## Environment variables

```bash
# Database
DATABASE_URL=                   # Neon pooled connection
DIRECT_URL=                     # Neon direct, for migrations

# Auth
AUTH_SECRET=
AUTH_URL=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=

# AI  (D8)
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.8-flash   # pinned here so a model bump is config, not code
AI_DAILY_MARK_LIMIT=60          # per student, per day
AI_DAILY_TUTOR_LIMIT=25
AI_MONTHLY_COST_CEILING_USD=    # global kill switch

# Email
RESEND_API_KEY=
EMAIL_FROM=

# Push
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=

# App
NEXT_PUBLIC_APP_URL=
CRON_SECRET=
SENTRY_DSN=
```

A `env.ts` module validates all of these with Zod at boot and fails fast — no `process.env.X!`
scattered through the codebase.

---

## Security

| Concern                              | Control                                                                                                                                                                                                                           |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authorisation                        | Every query filtered by `userId` from the session. A `withStudent()` wrapper makes forgetting it a type error.                                                                                                                    |
| Prompt injection via student answers | Student text is passed as clearly delimited, untrusted data; the model is instructed that it can never change the mark scheme or instructions. Response is schema-validated; anything off-schema is rejected, not parsed loosely. |
| AI cost abuse                        | Per-user daily quotas (`AI_DAILY_*`), per-request token ceilings, a global monthly ceiling that degrades to deterministic fallback marking.                                                                                       |
| Rate limiting                        | Postgres token bucket on auth endpoints, AI endpoints, and plan regeneration.                                                                                                                                                     |
| Secrets                              | Vercel encrypted env vars. `GEMINI_API_KEY` is **never** exposed to the client — all AI calls are server-side.                                                                                                                    |
| Headers                              | Strict CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, frame-ancestors none.                                                                                                                                              |
| PII                                  | Minimal by design: email, display name, date of birth (for the age gate), study data. No address, phone, school, or photo.                                                                                                        |
| Data residency                       | EU/UK Postgres region. Gemini API calls send answer text only — never name, email, or DOB.                                                                                                                                        |
| Deletion                             | Cascading hard delete from the settings page, completed within 30 days. See doc 09.                                                                                                                                               |

---

## Performance targets

- Today page fully interactive in **< 1.5 s** on a mid-range laptop — the single most-visited screen.
- Flashcard flip/grade response **< 100 ms**; the FSRS calculation is local and the write is optimistic.
- AI marking of a single open response: **< 4 s** p95, with a skeleton and a "marking…" state.
- Batched mock marking: **< 30 s** for a full paper, run as a background job with the results page
  polling, so the student is never staring at a spinner for half a minute.
- Content pages are statically rendered where possible and revalidated on content deploys.

---

## CI

GitHub Actions on every PR to `arena/01a0de94-reviseiq-student-hub`:

1. `typecheck` — `tsc --noEmit`
2. `lint` — ESLint + Prettier
3. `test:unit` — Vitest, with the Today engine and FSRS wrapper required to stay at 100% branch coverage
4. `content:validate` — Zod schema validation **plus the coverage check**: every spec point must have
   lesson coverage, notes coverage, and a minimum question count per tier
5. `test:e2e` — Playwright against a preview deploy: signup → onboarding → a lesson → a marked
   question → a card review → a Today task completion
6. `build`
