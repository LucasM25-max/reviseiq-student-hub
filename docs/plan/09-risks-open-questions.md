# 09 — Risks, compliance and open questions

---

## 1. Top risks

| #   | Risk                                                                                                                                                                                                                | Severity     | Mitigation                                                                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | **Content volume dwarfs the software.** Three subjects × two tiers × the whole spec is hundreds of lessons, thousands of questions and mark schemes. This, not the code, is what determines whether ReviseIQ ships. | **Critical** | Vertical slice first (D9). Coverage reporting so progress is measurable rather than felt. Revisit the authoring pipeline (D4) after the first three sub-topics. Be willing to ship one subject properly rather than three badly. |
| R2  | **AI marking is wrong in a way the student notices.** One absurd mark on a 6-marker destroys trust permanently.                                                                                                     | **Critical** | Structured per-mark-point output; arithmetic and evidence post-checks; mark scheme always shown; dispute button; golden-set agreement ≥90% within ±1 mark enforced in CI; weekly live sampling.                                  |
| R3  | **Copyright.** Reproducing AQA questions, mark schemes or examiner reports is infringement.                                                                                                                         | **High**     | D5 — everything original. An explicit authoring rule (doc 04) and a review checklist item. No past-paper PDFs hosted or bundled.                                                                                                 |
| R4  | **Children's data.** Users are 14–16. UK GDPR plus the ICO Children's Code apply, and the app profiles students by design.                                                                                          | **High**     | See §2. DPIA before any real student uses it. Data minimisation, EU/UK data residency, no marketing to under-16s, clear child-readable privacy explanations.                                                                     |
| R5  | **Safeguarding via free-text AI.** A student can type anything into the tutor or a blurt box, including disclosures of harm.                                                                                        | **High**     | Crisis-phrase detection that surfaces UK support resources (Childline, Samaritans) and never attempts counselling; tutor logs retained and reviewable; clear "this is not a person" framing.                                     |
| R6  | **AI cost at scale**, worsened by the Jan 2027 doubling of `gemini-3.8-flash` pricing.                                                                                                                              | **Medium**   | Caching, global card templates, deterministic marking for objective types, batching, per-user quotas, global ceiling, full cost telemetry from day one (doc 06 §6).                                                              |
| R7  | **Cold start.** D11 means an empty deck and no mastery data on day one.                                                                                                                                             | **Medium**   | First-week diagnostics (doc 05 §7) and honest empty-state copy that explains the mechanic.                                                                                                                                       |
| R8  | **RAG ratings are dishonest or stale.** Students over-rate themselves; ratings decay.                                                                                                                               | **Medium**   | Honest framing copy; mastery evidence tracked separately; `RagSuggestion` prompts; diagnostics that quietly expose over-confidence.                                                                                              |
| R9  | **The plan feels wrong** and the student stops trusting Today.                                                                                                                                                      | **Medium**   | A rationale sentence on every task; swap; "only got N minutes"; stable plans that don't reshuffle mid-day; `algoVersion` so changes can be evaluated against completion rates.                                                   |
| R10 | **Hand-built SVG diagrams (D18) are slow.** Science content is diagram-dense.                                                                                                                                       | **Medium**   | Build on demand only; one component serves illustration, labelling widget and question asset; if it becomes the bottleneck, revisit D18 for supplied images on static-only diagrams.                                             |
| R11 | **Single-provider dependency** on Gemini.                                                                                                                                                                           | **Low**      | All calls behind `/lib/ai` with a thin adapter; deterministic fallback already exists for outages. Swapping providers is a file, not a project.                                                                                  |
| R12 | **Academic integrity.** Students using the tutor to do homework, or the marker to write answers.                                                                                                                    | **Low**      | Tutor refuses to answer questions it is being asked to complete; it explains, it does not supply.                                                                                                                                |
| R13 | **Grade estimates misread as official.**                                                                                                                                                                            | **Low**      | Always labelled "estimate, based on previous years' boundaries"; boundary table configurable and versioned; never shown as a prediction of a real result.                                                                        |
| R14 | **Accessibility and SEND.** Revision tools are disproportionately used by students with additional needs.                                                                                                           | **Medium**   | WCAG 2.2 AA target from Phase 0 rather than retrofitted; colour never the sole carrier of meaning (especially in a RAG UI); dyslexia font and text sizing; full keyboard operation.                                              |
| R15 | **The Sep 2027 target is a content deadline, not a software one.** The build fits; a full spec across three subjects and two tiers very likely does not.                                                            | **High**     | Decide go-deep vs go-wide by ~March 2027 on real authoring-rate data (doc 08). Coverage reporting makes the rate measurable from Phase 3 onward.                                                                                 |
| R16 | ~~D23 and D21 pull against each other~~                                                                                                                                                                             | **Closed**   | Resolved by **D35**: XP, levels and achievements removed entirely. Streaks and honest progress stats remain.                                                                                                                     |
| R17 | **Answer-aware tutoring (D31) widens the safeguarding and privacy surface** — the model now sees what a student wrote, not just what a lesson says.                                                                 | **Medium**   | After-marking only, current question only, never a history dump, no PII in prompts, every turn logged. Covered in the DPIA.                                                                                                      |
| R18 | **Default term dates will be wrong for some students.** Term dates vary by local authority and academy trust, and a wrong calendar silently mis-plans.                                                              | **Low**      | Defaults are a convenience, everything is editable, and the app shows the period it thinks you're in on Today ("Half term starts Mon") so an error is visible rather than silent.                                                |
| R19 | **School tests could crowd out GCSE preparation** — optimising for Friday at the expense of June.                                                                                                                   | **Low**      | Hard allocation caps (doc 05 §5a): 40% normally, 60% in the final three days, 80% for a school mock, and always at least one non-test task.                                                                                      |

---

## 2. UK GDPR and the ICO Children's Code

Not legal advice — this is the engineering plan for compliance, and it should be reviewed by someone
qualified before real students use the product.

**Age.** 13 is the UK age at which a child can consent to information society services. Under-13s are
blocked at signup. Date of birth is collected solely for the age gate and to set age-appropriate
defaults.

**Lawful basis.** _Performance of a contract_ for delivering the revision service; _consent_ for
optional extras (push notifications, non-essential analytics). Consent must be as easy to withdraw
as to give.

**Profiling.** Today profiles students to build plans. That is core functionality rather than
marketing, but the Children's Code expects it to be explained in language a 14-year-old actually
understands, and expects no detrimental use of children's data. Practical consequences:

- A plain-English "how ReviseIQ decides what to show you" page, linked from Today
- No nudge techniques that push students to share more data or revise longer than they chose
- Streaks designed to encourage consistency, with a streak freeze so they cannot become coercive
- Absolutely no selling, sharing or ad-targeting of student data

**Data minimisation.** Email, display name, DOB, subject/tier choices and study data. No address,
phone number, school, photo or contacts. Analytics pseudonymised.

**Third-country transfers.** Gemini API calls send answer text, question text and mark schemes.
They must never include name, email or date of birth. Disclose the processor in the privacy policy
and confirm the paid-tier data-usage terms (that submitted data is not used to train models) before
launch.

**Rights.** Self-service data export (JSON) and hard deletion from settings, cascading across all
tables, completed within 30 days. Retention: inactive accounts warned at 24 months and deleted at 30.

**DPIA.** Required — children's data plus profiling. Do it in Phase 11, before any external user.

**Documents needed before launch:** privacy notice (adult version + child-friendly version), terms
of use, cookie notice, DPIA, and a records-of-processing entry.

---

## 3. Decisions deliberately deferred

| Deferred                                  | Revisit when                                                                                                                                    |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Combined Science: Trilogy                 | After the three separate sciences are covered. Data model already allows it (doc 03 §7).                                                        |
| Other exam boards (Edexcel, OCR)          | The UI already shows a board selector, so the concept is established.                                                                           |
| Teacher / parent / school accounts        | Only if schools become the route to market. Significant additional build and safeguarding obligation.                                           |
| Payments and entitlements                 | When there is enough content to justify charging. Cost telemetry from day one will make the pricing decision evidence-based.                    |
| PWA / offline / native                    | D22 is desktop-first. Revisit when there is evidence of phone-dominant usage.                                                                   |
| Per-user FSRS parameter optimisation      | ≥400 reviews per student; pooled optimisation first (doc 07 §7).                                                                                |
| An admin CMS for content                  | After the first three sub-topics, per D4's review trigger.                                                                                      |
| **English and Maths resit support** (D27) | After the first exam season produces real resit demand. Two new subjects and, for Maths, a genuinely different content model — its own project. |
| **A-level pathway** (D27)                 | Same architecture, entirely new content. The natural way to keep an account alive past the congratulations screen.                              |
| **Real PDF generation** (D28)             | Print stylesheets first. The "mistakes booklet" is the piece worth building properly.                                                           |
| **Social features** (D32)                 | Not deferred — ruled out.                                                                                                                       |

---

## 4. Questions resolved

All thirteen open questions from the first draft were answered on 27 Sep 2026 and are now recorded
as decisions **D23–D34** in the [decision log](./README.md).

| Question                               | Answer                                                           | Decision |
| -------------------------------------- | ---------------------------------------------------------------- | -------- |
| Brand and visual identity              | A serious revision app                                           | D23      |
| Term dates and holidays                | Yes — Today should know about them                               | D24      |
| Ad-hoc school tests with topic scoping | Yes, prioritised                                                 | D25      |
| Year 10 vs Year 11 behaviour           | Yes, they differ                                                 | D26      |
| What happens after the exams           | Congratulations, then scheduling stops; resits and A-level later | D27      |
| Printing and PDF export                | Yes, later                                                       | D28      |
| Test before Learn?                     | No — Learn first                                                 | D29      |
| Vertical slice scope                   | Biology `4.1.1 Cell structure`                                   | D30      |
| Should the tutor see wrong answers?    | Yes if possible                                                  | D31      |
| Social features                        | Not for now                                                      | D32      |
| Notification tone                      | Gentle                                                           | D33      |
| Target date                            | Relatively finished by Sep 2027                                  | D34      |
| Content review capacity                | Not a constraint                                                 | —        |

---

## 5. New open questions

Raised by those answers. None of them block Phases 0–2.

**Needs a decision before Phase 3 (content)**

1. **Spec-point granularity for `4.1.1`.** When you hand over the source material, do you want the
   taxonomy split to the finest AQA statement level (more precise Today targeting, more authoring)
   or grouped a little more coarsely (faster to author, blunter scheduling)? My default is finest.
2. **How many questions per spec point** counts as "enough" for the CI coverage gate? Doc 04
   proposes ≥8 per sub-topic. For a single sub-topic slice, 15–20 would make Today's question sets
   feel non-repetitive.

**Needs a decision before Phase 7 (Today)**

3. **Year 10 default exam anchor.** For a Year 10 with no GCSE dates set, should the app anchor on
   their end-of-Year-10 school exams (usually June), or run with no deadline at all and purely
   follow what school is teaching?
4. **Study leave detection.** Derive it automatically from the first and last exam dates, or let
   the student set it? Automatic is less typing but wrong for schools that keep students in.
5. **Exam-day behaviour.** Doc 05 suppresses the plan to nothing on a day with an exam. Is that
   right, or would you want a short "10-minute confidence skim" for the paper being sat that day?

**Needs a decision before Phase 9 (habit layer)**

6. ~~Does XP survive?~~ **Answered 27 Sep 2026: no.** XP, levels and achievements are scrapped
   (D35). Streaks, the daily goal and honest progress stats remain.
7. **Weekly summary email content.** Honest and factual ("4 sessions, 92 questions, Cell structure
   moved Amber → Green"), or more of a coaching note? Gentle tone either way (D33).

**Later, but shapes the architecture**

8. **Resit scope.** D27 mentions English and Maths retakes. Maths in particular needs a different
   content model — equation rendering, working-out capture, method marks. Worth knowing whether
   that's a real intention so the question model can leave room, or genuinely speculative.
9. **A-level.** Same question: if it's likely, subject/qualification modelling should stop assuming
   "GCSE" in a few places.

---

## 6. What I need to start Phase 0

Nothing — Phases 0 through 2 can be built entirely from what has already been decided.

Before **Phase 3**:

- Source material for Biology **`4.1.1 Cell structure`** (D30). I'll ask for it once the Phase 3
  scaffolding is in place and the taxonomy shape is agreed — which is the right moment, because the
  taxonomy gets written and agreed _before_ any prose (doc 04, step 2). Helpful to flag at handover:
  Higher-only material, the attached required practical, and any wording examiners are strict about.
- Answers to new open questions 1–2.

Before **Phase 5**:

- `GEMINI_API_KEY` in Vercel, and a local `.env.local` copy. Until then everything runs against the
  deterministic fallback marker.
- Google OAuth client ID and secret.
- A Neon project, or permission to create one.
