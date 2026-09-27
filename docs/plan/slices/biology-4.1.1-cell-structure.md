# Content slice — Biology `4.1.1.1` + `4.1.1.2`

> **Status:** specified, not authored. This document is the agreed build sheet for the first real
> content in ReviseIQ. Nothing here is finished content; it is the list of what gets written, what
> gets built, and how we will know it is done.

**Source material supplied:** AQA GCSE Biology (8461) specification text for `4.1.1.1` and
`4.1.1.2`, plus two extracts from AQA's official scheme of work covering the same two sub-topics.

**Decisions in play:** D3 (AI-written, human-reviewed, from supplied source), D5 (original
questions), D7 (both tiers), D9/D30 (Biology `4.1.1` is the vertical slice), D13 (Learn format),
D18 (hand-built SVG), D29 (Learn before Test), and the new D36–D43 recorded in the
[decision log](../README.md#decision-log).

---

## 1. Scope

### In scope

| Sub-topic | Title                      | Spec points | SoW classroom time |
| --------- | -------------------------- | ----------- | ------------------ |
| `4.1.1.1` | Eukaryotes and prokaryotes | 3           | 1 hour             |
| `4.1.1.2` | Animal and plant cells     | 4           | 2 hours            |

### Explicitly out of scope, and why

| Excluded                                     | Reason                                                                |
| -------------------------------------------- | --------------------------------------------------------------------- |
| **Required practical 1 (microscopy)**        | Deferred at your instruction (D43). See the seam warning below.       |
| **Magnification equation**                   | Belongs to `4.1.1.5 Microscopy`, not here. Verified against the spec. |
| Light vs electron microscopes, resolution    | `4.1.1.5`.                                                            |
| Cell specialisation, differentiation         | `4.1.1.3`, `4.1.1.4`.                                                 |
| Binary fission, culturing, aseptic technique | `4.1.1.6` (biology only).                                             |

> ### ⚠️ The required-practical seam
>
> In the published specification, **Required practical activity 1 is printed directly after
> `4.1.1.2`** — it is part of this sub-topic's territory, not `4.1.1.5`'s. I had this wrong until I
> checked the spec page directly; the AQA required-practical handbook lists it against `4.1.1.5`,
> which is the _Combined Science Trilogy_ numbering and does not apply to us.
>
> Practical questions are **≥15% of total marks**, so leaving RP1 out means `4.1.1.2` is knowingly
> incomplete against the real exam. Consequences we are accepting for now:
>
> - `4.1.1.2` stays `status: draft`, so the coverage checker warns rather than fails (doc 04 §4).
> - The `AT 7` skill code is recorded in the taxonomy but has **no** covering artefact. The coverage
>   report will show this honestly rather than hiding it.
> - Notes and lesson pages get a visible **"required practical: coming soon"** stub, not silence.
>   A student must never conclude from our page that there is nothing else to learn here.
>
> This is the first thing to pick up when you want to extend the slice.

### What this slice does _not_ exercise

Doc 04 claimed `4.1.1` was well chosen because it carries Higher-tier material and a practical.
Checking the spec, **neither `4.1.1.1` nor `4.1.1.2` contains any Higher-only content** — the only
HT-only line in the whole of `4.1.1` is standard form for bacterial populations in `4.1.1.6`. With
RP1 also deferred, this slice therefore does not test:

- tier filtering (no HT content to hide from Foundation students)
- required-practical sheets
- the `givenInExam` formula split

It does exercise everything else: taxonomy, lessons, notes, blurting, questions, AI marking,
flashcard generation, SVG diagrams, interactive widgets, maths rendering and Today deep links.
Worth knowing so we don't mistake a green build for proof that tier handling works.

---

## 2. Taxonomy (authored first, before any prose)

Per doc 04 step 2, spec point codes are the join key for the whole application. Seven assessable
points, all `tier: "BOTH"`:

| ID                | Code      | Assessable statement (paraphrased)                                                                                                                                                                         | Skills                |
| ----------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| `bio-4111-euk`    | `4.1.1.1` | Plant and animal cells are eukaryotic: cell membrane, cytoplasm, genetic material enclosed in a nucleus                                                                                                    | —                     |
| `bio-4111-pro`    | `4.1.1.1` | Bacterial cells are prokaryotic: much smaller; cytoplasm and cell membrane surrounded by a cell wall; genetic material not enclosed in a nucleus; a single DNA loop; there **may be** one or more plasmids | —                     |
| `bio-4111-scale`  | `4.1.1.1` | Understand the scale and size of cells; make order-of-magnitude calculations; use standard form                                                                                                            | MS 1b, 2a, 2h; WS 4.4 |
| `bio-4112-animal` | `4.1.1.2` | Most animal cells have: nucleus, cytoplasm, cell membrane, mitochondria, ribosomes                                                                                                                         | WS 1.2                |
| `bio-4112-plant`  | `4.1.1.2` | Plant cells **often** additionally have chloroplasts and a permanent vacuole of cell sap; plant and algal cells also have a cellulose cell wall which strengthens the cell                                 | WS 1.2                |
| `bio-4112-func`   | `4.1.1.2` | Explain how the main sub-cellular structures — nucleus, cell membranes, mitochondria, chloroplasts, plasmids — relate to their functions                                                                   | WS 1.2                |
| `bio-4112-est`    | `4.1.1.2` | Use estimations, and explain when to use them, to judge the relative size or area of sub-cellular structures                                                                                               | MS 1d, 3a; AT 7       |

**Skill codes decoded** (needed so authors tag correctly rather than copying letters around):

| Code   | Meaning                                                                            |
| ------ | ---------------------------------------------------------------------------------- |
| MS 1b  | Recognise and use expressions in standard form                                     |
| MS 1d  | Make estimates of the results of simple calculations                               |
| MS 2a  | Use an appropriate number of significant figures                                   |
| MS 2h  | Make order of magnitude calculations                                               |
| MS 3a  | Understand and use the symbols `=`, `<`, `<<`, `>>`, `>`, `∝`, `~`                 |
| WS 1.2 | Use models; recognise, draw and interpret diagrams and images                      |
| WS 4.4 | Use prefixes and powers of ten for orders of magnitude (centi, milli, micro, nano) |
| AT 7   | Use microscopes to observe specimens and produce labelled scientific drawings      |

Two wording notes for authors:

- The spec says plasmids "**may be** one or more" and plant cells "**often** have" chloroplasts.
  Both hedges are load-bearing and are the source of two of our misconceptions (§8). Do not
  simplify them away.
- AQA's web specification and its PDF differ by one word on `bio-4112-est` ("explain **what** they
  should be used to judge" vs "explain **when**"). We follow the sense of the PDF — _when_ to use an
  estimate — because that is what the SoW learning outcomes and past questions actually assess.

---

## 3. Learn — three lessons (D38)

The SoW budgets three classroom hours. We are not building a classroom hour: no equipment, no
class discussion, no settling time, and RP1 is deferred. Three self-study lessons of **~20 minutes**
each is the target — short enough for Today to pack into a real revision slot, long enough to teach
properly.

**KS3 recap handling (D39):** you chose _teach everything, make recap skippable_. Implemented as a
block-level flag, not a separate lesson:

```ts
{ type: "prose", recap: true, priorStage: "KS3", ... }
```

- Default: **expanded**. A student who needs it never has to find it.
- Collapsible by the student, with the choice remembered per lesson.
- Auto-collapsed when the student rated the parent topic `GREEN`.
- Today **skips** `recap` blocks when estimating duration for a `GREEN` or `AMBER` topic, so a
  confident student gets a 12-minute task and a struggling one gets the full 20.
- Recap blocks never carry a `check`, and never contribute to coverage — a spec point cannot be
  satisfied by recap material alone.

### Lesson 1 — Two kinds of cell (~20 min)

Covers `bio-4111-euk`, `bio-4111-pro`, `bio-4111-scale`.

| #   | Block             | Content                                                                               | Spec point         |
| --- | ----------------- | ------------------------------------------------------------------------------------- | ------------------ |
| 1   | `prose` (recap)   | What a cell is; that living things are made of them                                   | —                  |
| 2   | `keyIdea`         | The single dividing line: is the genetic material enclosed in a nucleus?              | `bio-4111-euk`     |
| 3   | `definition`      | Eukaryotic                                                                            | `bio-4111-euk`     |
| 4   | `diagram`         | `bio-animal-cell`, minimal labels — membrane, cytoplasm, nucleus                      | `bio-4111-euk`     |
| 5   | `check`           | MCQ: which feature makes a cell eukaryotic                                            | `bio-4111-euk`     |
| 6   | `definition`      | Prokaryotic                                                                           | `bio-4111-pro`     |
| 7   | `diagram`         | `bio-bacterial-cell`, full labels                                                     | `bio-4111-pro`     |
| 8   | `prose`           | Bacterial structure: cell wall, membrane, cytoplasm, single DNA loop, plasmids        | `bio-4111-pro`     |
| 9   | `misconception`   | "Bacteria have no DNA"                                                                | `bio-4111-pro`     |
| 10  | `misconception`   | "All bacteria have plasmids"                                                          | `bio-4111-pro`     |
| 11  | `check`           | Short answer: where is a bacterium's genetic material                                 | `bio-4111-pro`     |
| 12  | `widget`          | `comparison-table` — eukaryotic vs prokaryotic, student-completed                     | `bio-4111-euk/pro` |
| 13  | `prose`           | How much smaller "much smaller" is; prefixes centi/milli/micro/nano                   | `bio-4111-scale`   |
| 14  | `widget`          | `scale-explorer` — cell vs bacterium, standard form and prefix practice               | `bio-4111-scale`   |
| 15  | `example`         | Worked order-of-magnitude comparison, revealed step by step                           | `bio-4111-scale`   |
| 16  | `misconception`   | "10× narrower means 10× smaller" (it is ~1000× by volume)                             | `bio-4111-scale`   |
| 17  | `summary`         | Recap, linked to the matching notes sections                                          | all three          |
|     | **mastery check** | 4 questions drawn from the live bank — Test context, so wrong answers make flashcards |                    |

### Lesson 2 — Inside animal and plant cells (~20 min)

Covers `bio-4112-animal`, `bio-4112-plant`.

| #   | Block             | Content                                                               | Spec point        |
| --- | ----------------- | --------------------------------------------------------------------- | ----------------- |
| 1   | `prose` (recap)   | KS3 recall of cell parts                                              | —                 |
| 2   | `widget`          | `label-the-diagram` — animal cell, from memory first                  | `bio-4112-animal` |
| 3   | `prose`           | The five parts of most animal cells                                   | `bio-4112-animal` |
| 4   | `definition` ×5   | Nucleus, cytoplasm, cell membrane, mitochondria, ribosomes            | `bio-4112-animal` |
| 5   | `check`           | Which of these is **not** found in most animal cells                  | `bio-4112-animal` |
| 6   | `diagram`         | `bio-plant-cell`, full labels                                         | `bio-4112-plant`  |
| 7   | `prose`           | What plant cells add: chloroplasts, permanent vacuole, cellulose wall | `bio-4112-plant`  |
| 8   | `keyIdea`         | "Often", not "always" — and algal cells have walls too                | `bio-4112-plant`  |
| 9   | `misconception`   | "Every plant cell has chloroplasts" (root hair cells)                 | `bio-4112-plant`  |
| 10  | `misconception`   | "The cell wall controls what enters the cell"                         | `bio-4112-plant`  |
| 11  | `widget`          | `comparison-table` — animal vs plant vs bacterial, three columns      | both              |
| 12  | `check`           | Short answer: two structures in a plant cell but not an animal cell   | `bio-4112-plant`  |
| 13  | `summary`         | Recap + notes links                                                   | both              |
|     | **mastery check** | 4 questions from the live bank                                        |                   |

### Lesson 3 — Why each part is there (~20 min)

Covers `bio-4112-func`, `bio-4112-est`. This is the AO2 lesson and the one that most directly
earns marks, because the spec verb is **explain**, not _name_.

| #   | Block             | Content                                                                          | Spec point      |
| --- | ----------------- | -------------------------------------------------------------------------------- | --------------- |
| 1   | `keyIdea`         | Structure → function: naming a part is one mark, linking it to a job is the rest | `bio-4112-func` |
| 2   | `prose`           | Nucleus and the control of cell activities                                       | `bio-4112-func` |
| 3   | `prose`           | Cell membrane and controlling what enters and leaves                             | `bio-4112-func` |
| 4   | `prose`           | Mitochondria and aerobic respiration                                             | `bio-4112-func` |
| 5   | `misconception`   | "Powerhouse of the cell" — why that phrase scores nothing                        | `bio-4112-func` |
| 6   | `prose`           | Chloroplasts, chlorophyll and photosynthesis                                     | `bio-4112-func` |
| 7   | `prose`           | Plasmids and the extra genes they carry                                          | `bio-4112-func` |
| 8   | `widget`          | `card-sort` — organelle → function                                               | `bio-4112-func` |
| 9   | `check`           | Explain why a muscle cell has many mitochondria                                  | `bio-4112-func` |
| 10  | `prose`           | When an estimate is the right tool, and when it is not                           | `bio-4112-est`  |
| 11  | `widget`          | `scale-explorer` in nested mode — cell → nucleus → chromosome → gene             | `bio-4112-est`  |
| 12  | `example`         | Estimating the fraction of a cell's area taken by its nucleus                    | `bio-4112-est`  |
| 13  | `prose`           | Using `<<` and `>>` to state relative size                                       | `bio-4112-est`  |
| 14  | `summary`         | Recap + notes links                                                              | both            |
|     | **mastery check** | 5 questions from the live bank, weighted to extended response                    |                 |

---

## 4. Diagrams and widgets

You chose **all four widgets**. That is affordable only because none of them is bespoke to cells —
each is a **generic engine configured by data** (D40), registered by ID and reused for the rest of
the specification. A card sort for organelles and a card sort for enzymes are the same component
with different props. This is the single biggest reason to build them now rather than later: the
cost is paid once, on the first slice, and never again.

### SVG diagrams (D18)

| ID                     | Used by                                     |
| ---------------------- | ------------------------------------------- |
| `bio-animal-cell`      | Lessons 1–3, notes, label widget, questions |
| `bio-plant-cell`       | Lessons 2–3, notes, label widget, questions |
| `bio-bacterial-cell`   | Lesson 1, notes, label widget, questions    |
| `bio-cell-scale-strip` | `scale-explorer` backing graphic            |

Each must satisfy the doc 04 contract: pure SVG, colour from CSS custom properties, a
`labels: "all" | "none" | string[]` prop, a real `description` text alternative, and
`prefers-reduced-motion` respected.

### Widget engines

| Widget              | Generic contract                                                                                                       | Configured here as                                                                                                                       |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `label-the-diagram` | `{ diagramId, labels[], mode: "drag" \| "type", tolerance }`                                                           | Animal, plant and bacterial cells                                                                                                        |
| `comparison-table`  | `{ rows[], columns[], cells: "tick" \| "text", revealMode }`                                                           | Euk vs pro; animal vs plant vs bacterial (incl. a process row for respiration / photosynthesis / protein synthesis, as the SoW suggests) |
| `scale-explorer`    | `{ items: [{label, metres}], mode: "linear" \| "nested", practise: "prefix" \| "standardForm" \| "orderOfMagnitude" }` | Cell vs bacterium; cell → nucleus → chromosome → gene                                                                                    |
| `card-sort`         | `{ items[], buckets[], allowMultiple }`                                                                                | Organelle → function                                                                                                                     |

All four report a result to the lesson runtime in one shape, so progress, mastery and Today's
duration estimates do not need to know which widget ran:

```ts
type WidgetResult = {
  widgetId: string;
  specPoints: string[];
  score: number;
  max: number;
  ms: number;
};
```

**Widget outcomes feed mastery at the same reduced weight as inline `check` blocks, and never
create flashcards** — cards come only from Test-context mistakes (D11).

### Accessibility

Drag-and-drop is not usable for everyone, so `label-the-diagram` and `card-sort` both ship a
keyboard path (tab to item, enter to pick up, arrows to move, enter to drop) and a typed-answer
fallback. A widget that only works with a mouse fails the lesson, not just the student.

---

## 5. Revise — notes and blurting

### Notes

One page per sub-topic. Section slugs are **permanent** once shipped — Today deep-links to
`#anchors` and a renamed slug is a broken link in a student's plan.

`/revise/biology/notes/4-1-1-1`

| Slug              | Section                           | Spec point       |
| ----------------- | --------------------------------- | ---------------- |
| `#eukaryotic`     | What makes a cell eukaryotic      | `bio-4111-euk`   |
| `#prokaryotic`    | What makes a cell prokaryotic     | `bio-4111-pro`   |
| `#comparison`     | Side-by-side comparison table     | both             |
| `#scale`          | Sizes, prefixes and standard form | `bio-4111-scale` |
| `#exam-technique` | What "compare" questions demand   | all              |

`/revise/biology/notes/4-1-1-2`

| Slug              | Section                                   | Spec point        |
| ----------------- | ----------------------------------------- | ----------------- |
| `#animal-cells`   | Parts of an animal cell                   | `bio-4112-animal` |
| `#plant-cells`    | What plant and algal cells add            | `bio-4112-plant`  |
| `#functions`      | Structure → function table                | `bio-4112-func`   |
| `#estimating`     | Judging relative size and area            | `bio-4112-est`    |
| `#practical`      | RP1 stub — declared missing, not omitted  | (AT 7)            |
| `#exam-technique` | Why naming a part rarely earns full marks | all               |

### Semi-blurt prompts (D15)

Six prompts, three per sub-topic:

| Prompt intent                                                    | `expectedPoints` count |
| ---------------------------------------------------------------- | ---------------------- |
| Everything you know about bacterial cell structure               | 6                      |
| The differences between eukaryotic and prokaryotic cells         | 5                      |
| How you'd compare the size of a bacterium and an animal cell     | 4                      |
| Every part of an animal cell and what it does                    | 5                      |
| What plant and algal cells have that animal cells don't, and why | 5                      |
| Argue whether bacteria should be classified as plants or animals | 5                      |

The last one is lifted straight from the SoW's scientific-communication column. It is deliberately
a **blurt prompt and not an exam question** — it is a genuinely good thinking task with no clean
mark scheme, and forcing it into a marked question would mean inventing marks AQA would not award.

---

## 6. Test — question blueprint

You chose the **scalable standard** (D42): ~10 per sub-topic, a little over the CI floor of 8.
**20 questions, ≈50 marks** — about a quarter of a real Paper 1.

All questions are original (D5). AQA stems, mark schemes and examiner-report text are copyright and
are never reproduced; style and structure are matched, wording is ours.

### `4.1.1.1` — 10 questions, ~23 marks

| #   | Type            | Marks | Command word | AO      | Spec points           |
| --- | --------------- | ----- | ------------ | ------- | --------------------- |
| 1   | `MCQ`           | 1     | —            | AO1     | `euk`                 |
| 2   | `MCQ`           | 1     | —            | AO1     | `pro`                 |
| 3   | `SHORT`         | 2     | Name         | AO1     | `pro`                 |
| 4   | `SHORT`         | 2     | Describe     | AO1     | `euk`, `pro`          |
| 5   | `CALCULATION`   | 2     | Calculate    | AO2     | `scale`               |
| 6   | `CALCULATION`   | 3     | Calculate    | AO2     | `scale`               |
| 7   | `DATA_RESPONSE` | 3     | Compare      | AO2     | `scale`               |
| 8   | `SHORT`         | 2     | Give         | AO1     | `euk`, `pro`          |
| 9   | `SHORT`         | 3     | Suggest      | AO3     | `euk`, `pro`          |
| 10  | `EXTENDED`      | 4     | Describe     | AO1/AO2 | `euk`, `pro`, `scale` |

### `4.1.1.2` — 10 questions, ~27 marks

| #   | Type            | Marks | Command word | AO      | Spec points               |
| --- | --------------- | ----- | ------------ | ------- | ------------------------- |
| 11  | `MCQ`           | 1     | —            | AO1     | `plant`                   |
| 12  | `MCQ`           | 1     | —            | AO1     | `func`                    |
| 13  | `SHORT`         | 3     | Label        | AO1     | `animal`, `plant`         |
| 14  | `SHORT`         | 2     | State        | AO1     | `func`                    |
| 15  | `SHORT`         | 2     | Explain      | AO2     | `func`                    |
| 16  | `SHORT`         | 3     | Explain      | AO2     | `func`                    |
| 17  | `DATA_RESPONSE` | 3     | Estimate     | AO2     | `est`                     |
| 18  | `SHORT`         | 3     | Suggest      | AO3     | `func`                    |
| 19  | `SHORT`         | 3     | Compare      | AO2     | `animal`, `plant`         |
| 20  | `EXTENDED`      | 6     | Explain      | AO2/AO3 | `animal`, `plant`, `func` |

### Targets the bank must hit

- **AO balance across the pair:** AO1 ≈ 40%, AO2 ≈ 40%, AO3 ≈ 20%, matching AQA's overall weighting.
- **Types:** 6 distinct types used, against a floor of 3.
- **Extended response:** 2, against a floor of 1.
- **Command words:** name, state, give, describe, explain, calculate, compare, suggest, label —
  used exactly as AQA uses them, because the difference between _describe_ and _explain_ is a
  routine source of lost marks.
- **Tier (D41):** every question is `tier: "BOTH"`, since neither sub-topic has HT-only content.
  Foundation/Higher differentiation is done by **capping `difficulty` in the selector**, never by
  hiding a question. Tagging a hard question `HIGHER` would wrongly deny it to a Foundation student
  who is entitled to the content.

### Flashcard yield

At ~2.5 atomic mark points per question, the bank supports roughly **50 `CardTemplate`s** (capped
at 3 per question, doc 07). That is a healthy deck for one sub-topic pair and enough to see whether
FSRS behaves sensibly on real data.

---

## 7. Mark-scheme conventions for this content

Generic rules live in doc 04. These are specific to cells, and each one exists because it is a
known, repeated source of lost marks:

1. **A comparison must compare.** For _compare_ and _give the differences_ questions, a list of one
   cell type's features scores **zero**, however correct. Mark points are written as paired
   statements ("prokaryotes … whereas eukaryotes …") and `guidance` states this explicitly. This is
   the single most common failure on this topic.
2. **Right + wrong = wrong.** A correct statement contradicted by an incorrect one in the same
   answer negates the mark — AQA's stated convention. The marker prompt must implement it, or we
   will be more generous than the real exam and give students false confidence.
3. **Hedges are marked.** Reject "all bacteria have plasmids" and "all plant cells have
   chloroplasts". Accept "may have" / "often have" / "most".
4. **Cell wall ≠ cell membrane.** "The cell wall controls what enters the cell" is rejected
   wherever it appears, including as a throwaway clause in an otherwise good answer.
5. **"No nucleus" is not "no DNA".** Accept "DNA free in the cytoplasm", "not enclosed in a
   nucleus", "single loop of DNA". Reject "bacteria have no genetic material".
6. **Vague function language earns nothing.** "Powerhouse", "controls the cell", "brain of the
   cell" are all rejected; "site of aerobic respiration", "contains the genetic material that
   controls the cell's activities" are credited.
7. **Units and prefixes are marked.** A numerically correct answer with the wrong prefix or no unit
   loses the mark on calculation questions. Error carried forward applies to the second step.
8. **`modelAnswer` is never sent to the marker** (doc 04). Restated here because this is the first
   slice where it could actually happen.

---

## 8. Misconception register

These drive four things at once: `misconception` blocks in lessons, MCQ distractors, `reject` lists
in mark schemes, and the tutor's grounding context.

| #   | Misconception                                  | Why it is wrong                                                       | Handled in                             |
| --- | ---------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------- |
| 1   | Bacteria have no DNA                           | They do — a single loop, free in the cytoplasm, just not in a nucleus | L1 block 9; Q2 distractor; reject list |
| 2   | Bacteria have mitochondria                     | No membrane-bound organelles. They still respire, by other means      | L1; Q4 reject                          |
| 3   | All bacteria have plasmids                     | Spec says there **may be** one or more                                | L1 block 10; Q3 reject                 |
| 4   | Plasmids are the bacterium's main chromosome   | Plasmids are extra small rings, separate from the single DNA loop     | L1; Q3 distractor                      |
| 5   | The cell wall controls what enters and leaves  | The membrane does that; the wall gives strength                       | L2 block 10; reject list               |
| 6   | Every plant cell has chloroplasts              | Spec says **often**; root hair cells have none                        | L2 block 9; Q11 distractor             |
| 7   | Animal cells have a cell wall                  | They do not                                                           | L2; Q19 reject                         |
| 8   | Only plant cells have vacuoles                 | The spec's claim is about the **permanent** vacuole                   | L2; notes                              |
| 9   | Mitochondria are "the powerhouse"              | Not creditworthy language — say _site of aerobic respiration_         | L3 block 5; reject list                |
| 10  | Ten times narrower means ten times smaller     | Volume scales with the cube — roughly 1000×                           | L1 block 16; Q7                        |
| 11  | µm and mm are interchangeable in an answer     | A prefix error is a lost mark                                         | L1 block 13; Q5, Q6                    |
| 12  | Chlorophyll and chloroplast are the same thing | Chlorophyll is the pigment **inside** the chloroplast                 | L3 block 6; reject list                |

---

## 9. Beyond-spec exclusion list (D37)

Widely taught elsewhere, **not on AQA GCSE Biology 8461**, and therefore never presented as
examinable by us:

`peptidoglycan` / `murein` · `70S` / `80S` ribosomes · capsule · flagellum · pili · nucleoid ·
tonoplast · Golgi apparatus · endoplasmic reticulum · lysosome · chitin · binary fission
(`4.1.1.6`) · magnification formula, resolution, SEM/TEM (`4.1.1.5`)

Policy:

- **Never required** by a mark point. A student cannot lose a mark for not knowing these.
- **Accepted** in `alternatives` where a student volunteers them correctly, so wider reading is
  never punished.
- Not taught in lesson prose.

Students meet these terms constantly in third-party revision resources and then panic about whether
they need them. We plan to answer that directly with a single collapsed _"Seen this elsewhere? Not
needed for AQA GCSE"_ aside in the notes — see the open question in §13, as this is a genuine
product-voice decision and not mine to make alone.

---

## 10. Scheme-of-work traceability

Where each of AQA's suggested classroom activities landed, so nothing you sent is silently dropped:

| SoW suggestion                                                                  | What we build                                          |
| ------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Recap KS3 by drawing animal and plant cells on mini whiteboards                 | `recap` blocks (D39) + `label-the-diagram` from memory |
| Label diagrams of plant, animal and bacterial cells                             | `label-the-diagram` widget + Q13                       |
| Card sort matching organelle to function                                        | `card-sort` widget, L3 block 8                         |
| Construct a table comparing plant, animal and bacterial cells                   | `comparison-table` widget, L2 block 11                 |
| Include processes in the table (respiration, photosynthesis, protein synthesis) | A dedicated process row in the comparison config       |
| Display two diagrams — students spot the difference                             | Comparison table in `revealMode: "spotTheDifference"`  |
| Argue for/against classifying bacteria as plants or animals                     | Blurt prompt 6                                         |
| Classify images of cells as plant / animal / bacterial                          | `card-sort` with three buckets; Q1, Q2                 |
| Describe the order of size of cell, nucleus, chromosome, gene                   | `scale-explorer` in nested mode, L3 block 11           |
| Observe under a microscope; prepare slides                                      | **Deferred with RP1** (D43)                            |
| Video clips, bioviewers, AQA PowerPoints                                        | Out of scope — we do not embed third-party media       |
| Suggested timing 1 h + 2 h                                                      | Three ~20 min self-study lessons (D38)                 |

---

## 11. Today integration

What this slice makes schedulable, and the deep links Today generates:

| Task                                     | Target                                                    |
| ---------------------------------------- | --------------------------------------------------------- |
| Learn a lesson                           | `/learn/biology/cell-biology/two-kinds-of-cell?task=<id>` |
| Read the notes                           | `/revise/biology/notes/4-1-1-1#prokaryotic?task=<id>`     |
| Practise N exam questions on a sub-topic | `/test/practice?set=<snapshotId>&task=<id>`               |
| Blurt a sub-topic                        | `/revise/blurt/bio-4111?task=<id>`                        |
| Review due flashcards                    | `/revise/flashcards?deck=bio-4111&task=<id>`              |

The question set is **snapshotted when the plan is generated**, so "complete 5 exam questions on
cell structure" stays the same 5 questions if the student comes back tomorrow.

With RP1 deferred, Today has **no practical task type available** for this slice. The packer must
degrade cleanly rather than emitting an empty task — worth an explicit test, because a practical
task is a first-class type everywhere else in the design.

---

## 12. Files to be created

```
content/biology/taxonomy.ts                      # 4.1.1.1 + 4.1.1.2 spec points
content/biology/lessons/4-1-1-1-two-kinds-of-cell.mdx
content/biology/lessons/4-1-1-2-inside-cells.mdx
content/biology/lessons/4-1-1-2-structure-and-function.mdx
content/biology/notes/4-1-1-1.mdx
content/biology/notes/4-1-1-2.mdx
content/biology/questions/4-1-1-1.ts             # 10 questions + mark schemes
content/biology/questions/4-1-1-2.ts             # 10 questions + mark schemes
content/biology/blurts/4-1-1.ts                  # 6 prompt sets

src/components/diagrams/biology/AnimalCell.tsx
src/components/diagrams/biology/PlantCell.tsx
src/components/diagrams/biology/BacterialCell.tsx
src/components/diagrams/biology/CellScaleStrip.tsx
src/components/diagrams/registry.ts

src/components/widgets/LabelTheDiagram.tsx
src/components/widgets/ComparisonTable.tsx
src/components/widgets/ScaleExplorer.tsx
src/components/widgets/CardSort.tsx
src/components/widgets/registry.ts

src/lib/content/schema.ts                        # zod schemas for every content type
src/lib/content/coverage.ts                      # the coverage checker
scripts/content-validate.mjs
scripts/content-seed.mjs
scripts/content-report.mjs
```

---

## 13. Acceptance criteria

This slice is done when all of the following are true and demonstrated, not asserted:

- [ ] `npm run content:validate` passes — every file zod-parses, no dangling diagram or widget IDs,
      no duplicate question IDs
- [ ] `npm run content:report` shows all **7** spec points with lesson, notes, question and blurt
      coverage, and shows `AT 7` as **uncovered** rather than quietly passing
- [ ] 20 questions, ≈50 marks, AO split within ±5% of 40/40/20, ≥6 question types, 2 extended
- [ ] Every mark point is atomic and independently awardable
- [ ] All 12 misconceptions appear in at least one of: lesson block, distractor, reject list
- [ ] No term from the §9 exclusion list appears in any lesson, note or required mark point
- [ ] All four diagrams render in light and dark mode, at 320px and 1440px, and expose a real text
      alternative
- [ ] All four widgets are fully keyboard-operable and pass an axe check
- [ ] The three lessons resume correctly at `lastBlockIndex`
- [ ] A wrong answer in a mastery check creates a flashcard; a wrong answer in an inline `check`
      does **not**
- [ ] AI marking golden set: ≥60 graded answers for this slice, ≥90% within ±1 mark of a human
- [ ] The marker correctly awards **zero** to a one-sided answer on a _compare_ question — an
      explicit golden-set case, because this is the failure mode most likely to slip through
- [ ] Today can generate and deep-link every task type in §11, and degrades cleanly with no
      practical available
- [ ] RP1 stub visible in notes and lesson 2 — the gap is declared to the student

---

## 14. Open questions

1. **The "seen this elsewhere" aside** (§9) — do you want the app to actively tell students that
   peptidoglycan, flagella and capsules are not needed for AQA GCSE? It reduces overload and calms
   students using mixed resources, but it does put non-examinable words on the page.
2. **RP1** — is deferring it a "not in this slice" or a "not until much later"? It changes whether
   `4.1.1.2` can ever be marked `status: complete`, and whether practical task types get exercised
   before Phase 8.
3. **Source material for the rest of `4.1.1`** — you described this as "the start of the content".
   Sending `4.1.1.3`–`4.1.1.5` together would let the diagrams and widgets be designed once for the
   whole sub-topic rather than extended twice.
4. **Estimation questions** (`bio-4112-est`) are the least well-defined part of the spec and the
   hardest to write a fair mark scheme for. If you have any past questions that assess it, they
   would be worth more than anything else you could send.
