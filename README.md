# ReviseIQ

A GCSE revision hub for UK secondary school students.

AQA separate sciences — **Biology (8461)**, **Chemistry (8462)**, **Physics (8463)** — at both
Foundation and Higher tier. Four surfaces:

- **Learn** — interactive, spec-tagged lessons covering the whole curriculum
- **Revise** — concise notes, FSRS-scheduled flashcards built from your own mistakes, formula
  sheets, required-practical sheets and guided semi-blurting
- **Test** — original AQA-style exam questions and mock papers, with open answers marked by AI
  against structured mark schemes
- **Today** — the core: turns your RAG ratings, performance, availability and exam dates into a
  ranked, deep-linked revision plan for the day

---

## Status

**Phases 0–3 are built.** You can create an account, complete onboarding, and read the first
real topic — three lessons, revision notes and a required-practical sheet for AQA Biology
`4.1.1.2 Animal and plant cells`, rendered from authored content files. There is no lesson
runner, no interactive widgets, no scheduling engine and no AI marking yet — those are
Phases 4–7.

| Phase                    |     | What it gave us                                                                         |
| ------------------------ | --- | --------------------------------------------------------------------------------------- |
| **0** Foundations        | ✅  | Next.js 16, TypeScript, Tailwind v4, Prisma + Postgres, design system, CI               |
| **1** Accounts           | ✅  | Email/password + Google, email verification, password reset, age gate, sessions         |
| **2** Onboarding & shell | ✅  | Subjects → tier & exam dates → RAG ratings → availability, plus Learn/Revise/Test/Today |
| **3** Content spine      | ✅  | Authoring format, validation, seeding, diagrams, and the first Biology topic            |
| **4–13**                 | ⬜  | See the [roadmap](./docs/plan/08-roadmap.md)                                            |

Today currently renders a **preview plan** built from your real ratings and availability. It is
clearly labelled as such in the UI; the real engine lands in Phase 7.

The first topic is one sub-topic of one subject — 3 lessons, 7 note sections, 17 exam questions
(45 marks) and Required practical 1. `npm run content:report` prints what is covered and, more
usefully, what is not: two spec points are reported as **partial** rather than rounded up to
green, because plasmids cannot be taught before bacterial cells exist and the practical is
onion-only for now.

---

## Getting started

Requires **Node 22+**. No Docker, no system Postgres — development uses an embedded
PostgreSQL that `npm run db:start` downloads and runs for you.

```bash
git clone https://github.com/LucasM25-max/reviseiq-student-hub.git
cd reviseiq-student-hub
npm install

npm run setup            # writes .env, starts Postgres, migrates, seeds
npm run dev              # http://localhost:3000
```

`npm run setup` is safe to re-run: an existing `.env` is left alone and a database that
is already running is reused. The development database lives in `.devdb/`, so accounts
and progress survive a restart. `npm run db:reset` throws it away and starts over.

Sign up with any email address. Without `RESEND_API_KEY` nothing is actually emailed: the
verification and reset links are printed to the server console, saved as HTML in `./.mail`, and
surfaced directly in the page, so both flows are fully usable offline.

### Configuration

Every variable is validated at boot by `src/lib/env.ts`, which fails fast with a readable
message rather than letting `undefined` propagate. Only `DATABASE_URL` and `AUTH_SECRET` are
required — see [`.env.example`](./.env.example) for the rest.

Optional integrations degrade gracefully rather than breaking:

| Missing                                 | Behaviour                                                     |
| --------------------------------------- | ------------------------------------------------------------- |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | The Google provider is omitted; email/password still works    |
| `RESEND_API_KEY`                        | Email goes to the console and `./.mail` instead of a provider |
| `GEMINI_API_KEY`                        | Nothing — AI marking arrives in Phase 5                       |

---

## Commands

| Command               | What it does                                                      |
| --------------------- | ----------------------------------------------------------------- |
| `npm run dev`         | Development server                                                |
| `npm run build`       | Production build                                                  |
| `npm start`           | Serve the production build                                        |
| `npm test`            | Unit tests plus schema tests against a real database              |
| `npm run test:watch`  | Tests in watch mode                                               |
| `npm run smoke`       | End-to-end walk-through of a running server (see below)           |
| `npm run typecheck`   | `tsc --noEmit`                                                    |
| `npm run lint`        | ESLint                                                            |
| `npm run format`      | Prettier, writing in place (`format:check` to verify only)        |
| `npm run db:setup`    | `db:start` + `db:migrate` + `db:seed`                             |
| `npm run db:start`    | Start the embedded Postgres on port 55432 (`db:stop`, `db:reset`) |
| `npm run db:migrate`  | Apply pending migrations (`db:status` to list them)               |
| `npm run db:seed`     | Seed subjects and topics — idempotent, safe to re-run             |
| `npm run db:generate` | Regenerate the Prisma client (also runs on `npm install`)         |
| `npm run audit:prod`  | Audit production dependencies only                                |

---

## Testing

Three layers, all run in CI:

**Unit tests** cover the logic worth protecting on its own — password policy, age checks, exam
date arithmetic, onboarding step transitions, redirect safety, form parsing, RAG metadata.

**Schema tests** run against a real PostgreSQL database inside a rolled-back transaction, so
they are exhaustive without leaving anything behind. They check every model, every enum value,
the cascade behaviour of account deletion, and that foreign keys actually reject bad data. The
rate limiter is tested the same way, including a concurrency check that proves ten simultaneous
requests against a limit of five let exactly five through.

**The smoke test** (`npm run smoke`, against a running `npm run dev` or `npm start`) drives the
real HTTP application the way a browser with JavaScript disabled would: it reads each page,
extracts the hidden Server Action fields React renders for progressive enhancement, and posts
them back. Sixty-eight checks take a new account from sign-up through all four onboarding steps
to Today, then through email verification, settings, sign-out, sign-in and password reset.
Because it never executes any client JavaScript, passing it is also proof that the whole product
works without it.

```bash
npm run dev        # terminal 1
npm run smoke      # terminal 2
```

### A note on migrations

`prisma migrate` is not used. Migrations are hand-authored SQL in `prisma/migrations/` and
applied by `scripts/db-migrate.mjs`, which maintains the same `_prisma_migrations` ledger Prisma
reads. This keeps schema changes reviewable and avoids depending on Prisma's engine downloads.
`prisma/schema.prisma` remains the source of truth for the generated client.

### A note on the two dependency overrides

`package.json` pins `deepmerge-ts` and `mysql2` through `overrides`. Neither is a direct
dependency. `@prisma/client` depends on the `prisma` CLI, which pulls in `@prisma/config`
(→ `deepmerge-ts`) and every database driver Prisma supports (→ `mysql2`), so both land in the
**production** tree even though this app only ever talks to Postgres and never runs the CLI in
production. When advisories were published against the versions Prisma 7.10.0 resolves,
`npm run audit:prod` went red with four high-severity findings and no upgrade available —
`npm audit fix --force` wanted to downgrade to Prisma 6.

The overrides pull both to their patched releases. `npm audit` reports zero vulnerabilities, and
`npm run db:generate` plus `npm run db:status` both confirm `@prisma/config` still loads
`prisma.config.ts` correctly across the `deepmerge-ts` 7 → 8 major bump. Remove them once Prisma
ships a release that resolves the patched versions itself.

---

## The plan

📋 **[Read the build plan →](./docs/plan/README.md)** — around 22,000 words covering every
decision made so far.

| Document                                                            | Covers                                                       |
| ------------------------------------------------------------------- | ------------------------------------------------------------ |
| [Plan index & decision log](./docs/plan/README.md)                  | All agreed decisions, principles, scope, glossary            |
| [01 Product spec](./docs/plan/01-product-spec.md)                   | Auth, onboarding, RAG, and all four pages                    |
| [02 Architecture](./docs/plan/02-architecture.md)                   | Next.js + Auth.js + Prisma + Postgres, routes, env, security |
| [03 Data model](./docs/plan/03-data-model.md)                       | Prisma schema                                                |
| [04 Content pipeline](./docs/plan/04-content-pipeline.md)           | Source material → reviewed, versioned content                |
| [05 Today engine](./docs/plan/05-today-engine.md)                   | The scheduling algorithm                                     |
| [06 AI services](./docs/plan/06-ai-services.md)                     | Gemini marking, blurt scoring, tutor, cost & safety          |
| [07 Flashcards & FSRS](./docs/plan/07-flashcards-fsrs.md)           | FSRS-6 and mistake-driven cards                              |
| [08 Roadmap](./docs/plan/08-roadmap.md)                             | Phased delivery and exit criteria                            |
| [09 Risks & open questions](./docs/plan/09-risks-open-questions.md) | Risks, UK GDPR, what's still undecided                       |
