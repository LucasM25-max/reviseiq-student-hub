# 04 — Content pipeline

> **This document deliberately contains no curriculum content.** It defines the machinery that turns
> source material you supply into reviewed, versioned, queryable content. What actually goes into
> Biology Topic 1 is decided when you hand over the source material for Biology Topic 1.

Decisions in play: **D3** (AI-written, human-reviewed, from your source material), **D4** (handed
over per topic in conversation; files authored directly — no CMS), **D5** (original questions),
**D18** (hand-built SVG diagrams).

---

## The loop

```
   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
   │ 1. You supply│ →  │ 2. Taxonomy  │ →  │ 3. Authoring │ →  │ 4. Validate  │
   │    source    │    │    first     │    │    per type  │    │    + cover   │
   └──────────────┘    └──────────────┘    └──────────────┘    └──────┬───────┘
                                                                      ↓
   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
   │ 8. Live      │ ←  │ 7. Seed to   │ ←  │ 6. Merge to  │ ←  │ 5. You review│
   │              │    │    Postgres  │    │    branch    │    │    the diff  │
   └──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
```

Files in `/content` are the **source of truth**. Postgres is a **query layer** rebuilt from them by
`npm run content:seed`. Nothing in the content tables is ever edited by hand or by the app.

---

## Step 1 — Source handover (D4)

Per topic, you provide whatever you have: spec extracts, your own notes, textbook structure, past
question styles, worked examples, mark-scheme conventions. Useful things to flag when you hand over:

- Which parts are **Higher tier only**
- Which **required practicals** attach to which sub-topics
- Anything examiners reliably penalise (the "must say _rate of_" class of thing)
- Common misconceptions you want called out explicitly

The unit of handover is one topic. Smaller is fine; larger tends to lose fidelity.

## Step 2 — Taxonomy first, always

Before any prose is written, the topic's `taxonomy.ts` is authored and agreed:

```ts
// /content/biology/taxonomy.ts   (shape only — no real content)
export const topics: TopicDef[] = [
  {
    id: "bio-t<n>",
    number: <n>,
    title: "<topic title>",
    paper: 1,
    subTopics: [
      {
        id: "bio-t<n>-<slug>",
        code: "<AQA sub-topic code>",
        title: "<sub-topic title>",
        specPoints: [
          {
            code: "<AQA spec point code>",
            statement: "<verbatim-ish assessable statement>",
            tier: "BOTH" | "HIGHER",
            mathsSkills: ["MS1a"],
            wsSkills: ["WS2.1"],
            practicalIds: ["bio-rp-<n>"],
          },
        ],
      },
    ],
  },
];
```

Why first: spec point codes are the join key for the entire application (doc 03). Writing prose
before the taxonomy exists produces content that cannot be scheduled, tested for coverage, or linked
to from Today.

## Step 3 — Authoring, per content type

| Artefact      | File                                         | Notes                                                                                                |
| ------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Lesson        | `/content/<subject>/<subtopic>/lessons/*.ts` | Typed block array (doc 01 §3). Every block carries spec point codes.                                 |
| Notes         | `/content/<subject>/<subtopic>/notes.ts`     | Sectioned with stable slugs — the slugs become Today's `#anchor` deep links, so they must not churn. |
| Questions     | `/content/<subject>/<subtopic>/questions.ts` | Question + structured mark scheme, co-located.                                                       |
| Blurt prompts | `/content/<subject>/<subtopic>/blurt.ts`     | 3–6 guided prompts with `expectedPoints`.                                                            |
| Practicals    | `/content/<subject>/practicals/rp-<n>-*.ts`  | One per required practical, including its fault table (D50).                                         |
| Formulae      | `/content/<subject>/formulae.ts`             | Includes the `givenInExam` flag. _Not yet needed — 4.1.1.2 has no given formulae._                   |
| Diagrams      | `/src/components/content/diagrams/*.tsx`     | Hand-built SVG (D18), registered in `/src/lib/content/diagrams.ts` with a text alternative.          |

Content is grouped **by sub-topic, not by kind**: everything for `4.1.1.2` lives under one
directory. Authoring a topic means touching one folder, and reviewing one means reading one folder,
which is the unit content actually gets written and reviewed in. `/content/index.ts` is the only
barrel — the loader imports that and nothing else reaches into the tree, so adding a sub-topic is
one import line and the validator immediately covers it.

Diagrams are the exception: they are components, not data, so they live in `/src`. The registry in
`/src/lib/content/diagrams.ts` is deliberately **JSX-free data**, which is what lets
`content:validate` check every `diagramId` and `diagramLetters` reference from a plain Node script
without pulling React in. A unit test asserts the registry and the component table list exactly the
same diagrams, so one cannot exist without the other.

### Question and mark scheme shape (D5 — original questions)

```ts
{
  id: "bio-<subtopic>-q<n>",
  type: "EXTENDED",
  tier: "BOTH",
  paper: 1,
  marks: 4,
  commandWord: "explain",
  ao: "AO2",
  difficulty: 3,
  estSeconds: 300,
  specPoints: [{ code: "<code>", weight: 1 }],
  stemMdx: "<question stem>",
  assets: { diagramId: "<optional>", dataTable: null },
  markScheme: {
    points: [
      { id: "mp1", text: "<credit-worthy point>", marks: 1,
        alternatives: ["<accepted alternative wording>"],
        reject: ["<explicitly not creditworthy>"] },
    ],
    guidance: "<how an examiner applies this>",
    ecfRules: "<error carried forward, if applicable>",
    modelAnswer: "<full-mark answer, shown to the student AFTER marking>",
  },
}
```

### Numeric answers with a tolerance band (D49)

Calculation and **estimation** questions cannot be marked against a single expected value. AQA's
convention is to accept a range and to credit the method independently, so a question may carry a
`numericAnswer` alongside its mark points:

```ts
numericAnswer: {
  accept: { min: 4, max: 6 },        // tolerance window, not a point value
  unit: "µm",
  significantFigures: 1,
  methodPoints: [                     // awarded even when the final value misses the window
    { id: "mp1", text: "<the judgement or step being credited>", marks: 1 },
  ],
  ecf: true,                          // a wrong value carries forward into later parts
}
```

**Anything with a `numericAnswer` is marked deterministically in the app, never by the model.**
Checking whether a number falls in a range is a comparison, not a language judgement — it is
instant, free and exactly right every time. Sending it to Gemini would cost money to become less
reliable. The AI marker is for open prose, which is where it earns its keep.

Two rules that matter downstream:

1. **Mark points must be atomic and independently awardable.** The AI marker returns a verdict per
   mark point; a mark scheme written as one blob cannot be marked reliably, cannot produce targeted
   feedback, and cannot generate a useful flashcard.
2. **`modelAnswer` is never sent to the marker.** It is shown to the student afterwards. Including it
   in the marking prompt makes the model grade similarity-to-the-model rather than
   satisfaction-of-the-mark-scheme, and it punishes correct answers phrased differently.

### Authoring rules

- Write to the spec point, not to a topic in general. Every artefact declares its codes.
- Higher-only material is tagged `tier: "HIGHER"`, never merely mentioned as "(HT only)" in prose.
- Command words match AQA usage exactly; marks allocated as AQA would allocate them.
- Questions are **original** (D5). Never reproduce an AQA question, mark scheme, or examiner report,
  verbatim or lightly reworded. Style and structure may be matched; text may not be copied.
- Minimum bank per sub-topic before it counts as "covered" (enforced in CI):
  **≥ 8 questions**, spanning at least 3 question types, with ≥ 1 extended response and ≥ 1
  practical-linked question where the spec attaches a practical.

## Step 4 — Validation (CI, doc 02)

`npm run content:validate` runs two layers:

**Schema** — Zod-parses every content file; unknown block types, missing spec point codes,
malformed mark schemes, duplicate IDs and dangling diagram references all fail the build.

**Coverage** — the check that turns "comprehensive" into a testable property:

```
for each spec point in the taxonomy:
  ✓ appears in ≥1 lesson block
  ✓ appears in ≥1 notes section
  ✓ has ≥ MIN_QUESTIONS questions available at each tier it applies to
  ✓ appears in ≥1 blurt prompt's expectedPoints
  ✓ if it references a practical, that practical file exists
```

Coverage failures are warnings while a subject is `status: draft` and hard errors once it is marked
`status: complete`. A `npm run content:report` command prints a per-subject coverage table — that is
the honest answer to "how much of the spec is actually done".

## Step 5 — Human review (D3)

Generated content lands as a pull request on the working branch. Review checklist:

- [ ] **Scientific accuracy** — no wrong statements, no oversimplifications that become wrong at GCSE
- [ ] **Spec alignment** — nothing beyond the spec presented as examinable; nothing on the spec missing
- [ ] **Tier tagging** — Higher-only content is tagged, not just mentioned
- [ ] **Mark schemes** — atomic points, credible alternatives, sensible reject lists
- [ ] **Reading level** — written for 14–16 year olds, not for a graduate
- [ ] **Originality** — no copied AQA text

Nothing merges without this pass. The risk of AI-generated science content is not that it is
obviously wrong; it is that it is _subtly_ wrong in ways that cost marks.

## Steps 6–8 — Merge, seed, ship

- Merge to the working branch → CI validates → Vercel preview built with the seeded content.
- `npm run content:seed` is idempotent and diff-based: it upserts by stable ID and marks removed
  content as `retired` rather than deleting it, because student attempts reference question IDs.
- **Content versioning:** a change to a question that alters its meaning gets a **new ID**, not an
  edit. Editing a question under existing attempts silently corrupts historical mastery data.
  Typos and formatting may be edited in place with a `version` bump.

---

## Diagrams (D18)

Hand-built SVG React components, in a registry keyed by ID so content references them by string:

```
/components/diagrams/registry.ts   →  { "bio-animal-cell": AnimalCellDiagram, ... }
```

Requirements for every diagram component:

- Pure SVG, no raster assets; scales cleanly and stays crisp at any size
- Reads colour from CSS custom properties so dark mode and the per-subject accent work automatically
- Accepts `labels: "all" | "none" | string[]` — the same component then serves as the notes diagram,
  the lesson diagram, **and** a label-the-diagram interactive widget
- Ships a `description` string used as the text alternative (a real description, never `alt=""`)
- Respects `prefers-reduced-motion` for anything animated

This is why hand-built SVG was chosen over supplied images: one component does static illustration,
interactive labelling and exam-question asset duty. It is slower per diagram, so build them
on demand — a diagram is only built when a lesson or question actually needs it.

---

## Scaling plan

The vertical slice is Biology **`4.1.1 Cell structure`** — a single sub-topic (D9, D30). It was
chosen well: diagram-dense, carries a required practical, involves a maths skill, and contains
Higher-only material, so it exercises tier filtering, practical sheets, SVG components and maths
rendering rather than just prose.

Expansion order after that:

1. The rest of Biology Topic 1, then Paper 1 topics, then Paper 2
2. Chemistry (question authoring is heavier — calculations, equations, required practicals)
3. Physics (heaviest — equation sheet handling, `givenInExam` split, more calculation questions)

Against the **Sep 2027** target (D34), this is the critical path. Doc 08 sets out the go-deep
(Biology to 100%) versus go-wide (all three subjects, Paper 1 only) decision, to be taken around
March 2027 once the real authoring rate is known.

Revisit **D4** once the third topic is done. Hand-authoring per topic in conversation works for a
slice; a generation script with a review PR (`npm run content:generate <topic>`) becomes worth
building somewhere around the point where the pattern is stable and repetitive. That is a decision
for evidence, not now.
