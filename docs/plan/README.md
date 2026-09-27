# ReviseIQ — Build Plan

A GCSE revision hub for UK secondary students. AQA separate sciences (Biology, Chemistry, Physics),
Foundation and Higher tier. Four surfaces — **Learn**, **Revise**, **Test**, **Today** — with Today
acting as the brain that decides what a student does next and deep-links them into the other three.

> **Status:** planning only. No application code has been written yet. This directory is the agreed
> plan; it is meant to be edited as decisions change.

---

## Read in this order

| #   | Document                                                     | What it covers                                                         |
| --- | ------------------------------------------------------------ | ---------------------------------------------------------------------- |
| 00  | **README.md** (this file)                                    | Decision log, principles, scope boundaries, glossary                   |
| 01  | [`01-product-spec.md`](./01-product-spec.md)                 | Auth, onboarding/RAG, and the full spec for Learn, Revise, Test, Today |
| 02  | [`02-architecture.md`](./02-architecture.md)                 | Stack, hosting, routes, folder layout, env vars, security              |
| 03  | [`03-data-model.md`](./03-data-model.md)                     | Prisma schema sketch, curriculum taxonomy, user-state tables           |
| 04  | [`04-content-pipeline.md`](./04-content-pipeline.md)         | How your source material becomes reviewed, versioned content           |
| 05  | [`05-today-engine.md`](./05-today-engine.md)                 | The scheduling algorithm — the hardest and most valuable part          |
| 06  | [`06-ai-services.md`](./06-ai-services.md)                   | Gemini marking, semi-blurt scoring, AI tutor, cost & safety controls   |
| 07  | [`07-flashcards-fsrs.md`](./07-flashcards-fsrs.md)           | FSRS-6 scheduling and mistake-driven card generation                   |
| 08  | [`08-roadmap.md`](./08-roadmap.md)                           | Phased delivery, exit criteria, what ships in the vertical slice       |
| 09  | [`09-risks-open-questions.md`](./09-risks-open-questions.md) | Risks, legal/safeguarding, and what we still need to decide            |
| 10  | [`slices/`](./slices/)                                       | Per-sub-topic build sheets — what actually gets authored, and when     |

---

## Decision log

Every decision below was made explicitly during planning. Where a decision is later reversed, strike
it through and add the replacement rather than deleting — the history matters.

| #   | Decision                 | Chosen                                                                                                     | Notes                                                                                                                                                              |
| --- | ------------------------ | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | Platform                 | Next.js (App Router) + Auth.js v5 + Prisma + Postgres                                                      | Full control, no BaaS lock-in. Deployed on Vercel.                                                                                                                 |
| D2  | Auth methods             | Google OAuth **and** email + password                                                                      | Email verification and password reset required.                                                                                                                    |
| D3  | Content origin           | AI-written, human-reviewed, **from source material you supply**                                            | This plan deliberately specifies _no_ curriculum content — only the pipeline.                                                                                      |
| D4  | Content handover         | You paste source per topic; content files authored directly                                                | No CMS, no admin UI in v1. Revisit after the first three sub-topics.                                                                                               |
| D5  | Exam questions           | **Original** AQA-style questions with our own mark schemes                                                 | Real AQA papers are © AQA and cannot be reproduced without a licence.                                                                                              |
| D6  | Qualifications           | Biology 8461, Chemistry 8462, Physics 8463                                                                 | Combined Science Trilogy explicitly out of scope; data model leaves room.                                                                                          |
| D7  | Tiers                    | Foundation **and** Higher                                                                                  | Content tagged per tier; Foundation students never see Higher-only material.                                                                                       |
| D8  | AI provider              | Google **`gemini-3.8-flash`** via `GEMINI_API_KEY` env var on Vercel                                       | Model ID pinned in `GEMINI_MODEL` so bumps are config, not code.                                                                                                   |
| D9  | First milestone          | Vertical slice: **Biology `4.1.1 Cell structure`, all four pages working**                                 | One sub-topic, end to end. Tighter than the original "3 topics" — see D30.                                                                                         |
| D10 | Today inputs             | Recurring weekly availability + exam dates + "I have N minutes now"                                        | Plan regenerates daily and adapts to what was actually completed.                                                                                                  |
| D11 | Flashcard source         | **Only** auto-generated from questions answered wrongly                                                    | Consequence: empty deck on day one — see cold-start handling in doc 05.                                                                                            |
| D12 | Scheduler                | **FSRS-6** via `ts-fsrs`                                                                                   | Current algorithm version; optimiser binding available later.                                                                                                      |
| D13 | Learn format             | Stepped lessons + inline checks + interactive widgets + in-lesson AI tutor                                 | Sequenced: lessons → tutor → widgets.                                                                                                                              |
| D14 | Revise contents          | Concise notes, flashcards, formula sheet, required-practical sheets, **semi-blurting**                     | Practicals appear both inline in notes and as standalone sheets.                                                                                                   |
| D15 | Semi-blurting            | Guided recall prompts, looser than exam questions                                                          | e.g. "Name 3 subcellular structures found only in plant cells." AI-scored on idea coverage.                                                                        |
| D16 | Accounts                 | Students only                                                                                              | No teacher/parent/school accounts in v1.                                                                                                                           |
| D17 | Money                    | Free, with hard AI cost controls                                                                           | No Stripe in v1. Per-user quotas, caching, cost telemetry from day one.                                                                                            |
| D18 | Diagrams                 | Hand-built SVG/React components                                                                            | Double as the Learn page's interactive widgets. Slow but interactive, themeable, accessible.                                                                       |
| D19 | RAG granularity          | Topic-level at onboarding → progressive sub-topic refinement                                               | Onboarding stays under ~10 minutes.                                                                                                                                |
| D20 | Mocks                    | Both mini-mocks (20–30 min) and full AQA-structure papers                                                  | Mini-mocks schedulable by Today; full papers started deliberately.                                                                                                 |
| D21 | Habit layer              | ~~Streaks + daily goal + stats + XP/levels/badges + reminders~~ → **superseded by D35**                    |                                                                                                                                                                    |
| D22 | Device target            | **Desktop/tablet-first**, phone as a secondary responsive view                                             | Designed for sitting down to revise properly. No offline/PWA in v1.                                                                                                |
| D23 | Brand and tone           | **A serious revision tool.** Calm, editorial, high-contrast. No mascots, no confetti                       | Creates tension with D21's XP/badges — resolved as _understated progress_, not game mechanics. See doc 01 §8.                                                      |
| D24 | School calendar          | Pre-populated England term/holiday calendar, fully editable, with **separate holiday availability**        | Today shifts mode during half-terms, holidays and study leave.                                                                                                     |
| D25 | School tests             | Students add school tests with a date and the topics covered; those topics get a temporary priority boost  | Covers class tests, end-of-topic tests and school mock seasons. Optional recurrence.                                                                               |
| D26 | Year group               | **Year 10 and Year 11 behave differently**                                                                 | Y10 = keep pace with what school is teaching. Y11 = driven by exam proximity.                                                                                      |
| D27 | After the exams          | Congratulations screen, then Today and scheduling **stop**; the app stays browsable                        | Resit escape hatch. A-level, and English/Maths resits, deferred.                                                                                                   |
| D28 | PDF export               | Deferred to a later phase — print stylesheets first, real PDF generation later                             | Notes, formula sheet, practical sheets, and a "mistakes booklet" from flashcards.                                                                                  |
| D29 | Build order              | **Learn before Test**                                                                                      | Reverses the alternative sequencing floated in doc 08.                                                                                                             |
| D30 | Slice scope              | **Biology `4.1.1 Cell structure`**                                                                         | Source material supplied once the Phase 3 taxonomy is agreed.                                                                                                      |
| D31 | Tutor context            | The tutor **may see the student's marked answer** and which mark points they missed                        | Only _after_ marking, only the current question. Powers "Why did I lose this mark?"                                                                                |
| D32 | Social features          | **None**                                                                                                   | No leaderboards, friends or shared decks. Comparison is corrosive for anxious students.                                                                            |
| D33 | Notification tone        | **Gentle and invitational**                                                                                | No loss-framing, no guilt, maximum one reminder a day. Also what the ICO Children's Code expects.                                                                  |
| D34 | Target                   | **Relatively finished by September 2027**                                                                  | Aligns with the start of the 2027/28 academic year — the right launch window for a revision app.                                                                   |
| D35 | Habit layer              | **Streaks + daily goal + honest progress stats + reminders. No XP, no levels, no achievements**            | Supersedes D21. Resolves the tension with D23: a serious tool shows evidence of progress, not prizes.                                                              |
| D36 | Content slices           | Every source handover gets a **slice build sheet** in `slices/` before a word of content is authored       | Makes scope, exclusions and acceptance criteria explicit up front. First one: Biology `4.1.1.1`–`4.1.1.2`.                                                         |
| D37 | Beyond-spec terms        | Per-slice **exclusion list**. Never required by a mark point, never taught, but **accepted** if offered    | Students meet these in other resources; they must never lose a mark for knowing more, or feel obliged to.                                                          |
| D38 | Lesson sizing            | **~20 minute self-study lessons.** AQA's scheme-of-work classroom hours are guidance, not a mapping        | A 2-hour classroom block is unusable for solo revision and unpackable by Today.                                                                                    |
| D39 | KS3 recap                | Taught **in full by default**, tagged `recap`, collapsible, and skipped by Today for `GREEN` topics        | Comprehensive for the weak student, skippable for the confident one. Recap alone never satisfies coverage.                                                         |
| D40 | Widgets                  | Interactive widgets are **generic data-driven engines** in a registry — never per-topic bespoke components | Cost is paid once on the first slice. A card sort for organelles and one for enzymes are the same component.                                                       |
| D41 | Tier and questions       | For non-HT content every question is `tier: BOTH`; F/H differ by a **difficulty cap in the selector**      | Tagging a hard question `HIGHER` would wrongly deny a Foundation student content they are entitled to.                                                             |
| D42 | Question depth           | **~10 questions per sub-topic** (CI floor is 8)                                                            | Scalable standard, chosen over a showcase bank so the per-sub-topic cost model stays truthful.                                                                     |
| D43 | Required practical 1     | ~~**Deferred** out of the first slice~~ → **superseded by D45**                                            | Reversed 27 Sep 2026.                                                                                                                                              |
| D44 | Teaching order           | Slices are built in **AQA scheme-of-work order, not specification numbering**                              | The SoW teaches `4.1.1.2` before `4.1.1.1`. Consequence: forward references must be deferred and reported.                                                         |
| D45 | Required practicals      | Built as **interactive simulations** a student actually performs. RP1 microscopy is the first              | Supersedes D43. Practical questions are ≥15% of marks and are far better learnt by doing than by reading.                                                          |
| D46 | Practical engines        | Simulation logic is a **pure, DOM-free state machine**; React is a thin renderer over derived state        | No headless browser is available to us, so browser-only logic is untestable logic. Also keeps faults honest.                                                       |
| D47 | Drawing marking          | Strokes captured as **vectors**: rubric checked deterministically, AI narrowly scoped, marks **advisory**  | Pixel-marking a drawing is unreliable. Drawing marks never alter mastery and never create a flashcard.                                                             |
| D48 | RP1 specimens            | **Onion only**, matching AQA's student sheet                                                               | Confirmed 27 Sep 2026. The practical says "plant **and** animal cells", so `bio-rp-1` is reported partial.                                                         |
| D49 | Numeric marking          | Questions may carry a **tolerance band** plus independent **method marks**, marked **deterministically**   | Estimation cannot be marked against one value. A range check is a comparison, not a language judgement — the model would cost more and be less reliable.           |
| D50 | Practical data vs engine | A practical's **fault table is content data** (P3); the **simulation that renders it is an engine** (P4b)  | Lets the practical question bank ship months before the simulation, while still sharing one source so they cannot drift.                                           |
| D51 | Content markup           | **Markdown + KaTeX, not MDX.** No `rehype-raw`; interactivity only via typed `widget`/`diagram` blocks     | MDX allows arbitrary JSX, which zod cannot validate and Postgres cannot store inert. Keeps a lesson body data rather than code.                                    |
| D52 | Diagram lettering        | Lettering a structure **replaces** its name on the figure; it never appends to it                          | q03 asks "name the structures labelled A, B and C" — a figure reading "A — Cell wall" prints its own answer. Replacing makes the giveaway unreachable.             |
| D53 | Validator layering       | `content:validate` runs **schema → cross-reference → coverage** and stops at the first layer that fails    | References are meaningless until parsing succeeds. Costs one thing: proving all three layers needs three broken fixtures, not one.                                 |
| D54 | Heading depth            | Bodies author `##` as their top heading; `Markdown` takes a `headingOffset` from its container             | The same body renders in a lesson (under an h1) and in a note section (under an h2). Fixing the depth at authoring time guarantees a skipped level in one of them. |

---

## Timeline

Planning started **27 Sep 2026**. Target: **relatively finished by Sep 2027** (D34) — roughly twelve
months, landing at the start of the 2027/28 academic year, which is exactly when a Year 11 cohort
starts looking for a revision tool.

The honest read: **the software is comfortably achievable in that window; the content is the risk.**
Doc 08 maps the phases onto a calendar with software feature-complete around May 2027 and everything
after that going into content. If content falls behind, the right call is one subject at 100% rather
than three at 60%.

---

## Product principles

1. **Today is the product.** Every other page is a destination Today links to. If a student only ever
   opens Today and does what it says, the app has worked.
2. **Never ask the student to decide what to revise.** Choice paralysis is the main failure mode of
   every revision app. Offer a ranked plan, allow a swap, never present a blank slate.
3. **Everything is tagged to a spec point.** Lessons, notes, cards, questions, practicals. A spec
   point code is the join key that makes Today possible.
4. **Earn trust on marking.** An AI mark that is obviously wrong destroys credibility permanently.
   Always show the mark scheme after marking, always allow "I think this is wrong", always log it.
5. **Honest progress.** No fake green. If a student is weak, the app says so kindly and does
   something about it.
6. **Content is data, not code.** Adding a topic must never require a code change.
7. **Cheap by default.** Cache aggressively, batch AI calls, and know the per-student cost before
   any decision about pricing.

---

## Explicit non-goals for v1

- Combined Science Trilogy/Synergy, and any board other than AQA
- Any subject beyond Biology, Chemistry, Physics — English and Maths resit support is a **later**
  idea attached to D27, not a v1 feature
- A-level content (D27 — eventually, not now)
- Teacher, parent, school or MAT accounts; class codes; SSO
- Payments, subscriptions, entitlements
- Native mobile apps, offline mode, PWA install
- **Social features of any kind** (D32)
- Hosting or reproducing real AQA past papers or mark schemes
- Student-authored flashcards, or a pre-authored core deck (D11)
- PDF export in v1 (D28 — print stylesheets are cheap and ship earlier)

---

## Glossary

| Term                | Meaning                                                                                                                                        |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Spec point**      | A single assessable statement from the AQA specification, identified by its code (e.g. `4.1.1.2`). The atomic unit everything hangs off.       |
| **Topic**           | A numbered top-level spec section (e.g. Biology Topic 1). RAG-rated at onboarding.                                                             |
| **Sub-topic**       | A child of a topic. RAG-rated progressively, once the student starts working in that topic.                                                    |
| **RAG**             | The student's self-rating: `NOT_LEARNT`, `RED`, `AMBER`, `GREEN`. Drives Today.                                                                |
| **Mastery**         | A _computed_ 0–1 estimate per spec point from question performance. Distinct from RAG.                                                         |
| **Task**            | One unit of work in a day's plan, with a type, an estimated duration, and a deep link.                                                         |
| **Semi-blurt**      | Guided free recall — a prompt asks for specific ideas; AI scores idea coverage, not exam precision.                                            |
| **Mini-mock**       | 20–30 minute mixed-topic timed assessment.                                                                                                     |
| **Full mock**       | A complete paper matching AQA structure: 1h45, 100 marks, correct topic and AO balance.                                                        |
| **School test**     | A real assessment at the student's school, entered by them with a date and the topics it covers (D25). Distinct from a mock the app generates. |
| **Calendar period** | A stretch of the school year — term, half-term, holiday, study leave or exam season — that changes how Today plans (D24).                      |
| **Study leave**     | The period from the first exam to the last, when students are off timetable. Its own plan mode.                                                |

---

## Reference facts (verified 27 Sep 2026)

Structural constants used across the plan. Re-verify against the live specification before building
the Test blueprints.

- **Biology 8461**, **Chemistry 8462**, **Physics 8463** — each assessed by two written papers,
  **1 hour 45 minutes, 100 marks, 50% of the GCSE** each, sat at either Foundation or Higher tier.
  ([AQA 8461 spec](https://filestore.aqa.org.uk/resources/biology/specifications/AQA-8461-SP-2016.PDF),
  [AQA 8462 spec](https://filestore.aqa.org.uk/resources/chemistry/specifications/AQA-8462-SP-2016.PDF))
- Paper splits: Biology P1 = Topics 1–4, P2 = Topics 5–7. Chemistry P1 = Topics 1–5, P2 = Topics 6–10
  (P2 may also draw on fundamentals from 4.1–4.3). Physics P1 = Topics 1–4, P2 = Topics 5–8.
- **Assessment objectives:** AO1 ≈ 40%, AO2 ≈ 40%, AO3 ≈ 20% overall (roughly 37–43 / 37–43 / 17–23
  per paper).
- **Required practicals** account for **at least 15%** of the marks for each qualification.
  Biology has 10 required practicals; Chemistry has 8; Physics has 10 (confirm during Phase 2).
  ([AQA practical assessment](https://www.aqa.org.uk/subjects/biology/gcse/biology-8461/specification/practical-assessment))
- **Question styles in scope:** multiple choice, structured, closed short answer, open response.
- **`gemini-3.8-flash`** launched 2 Sep 2026 at an introductory **$0.75 / $3.75** per 1M input/output
  tokens ($0.075 cached input), rising to **$1.50 / $7.50 on 1 Jan 2027**.
- **FSRS-6** is the current algorithm version; `ts-fsrs` (v5.4.x, MIT) implements it, with
  `@open-spaced-repetition/binding` available server-side for parameter optimisation.
