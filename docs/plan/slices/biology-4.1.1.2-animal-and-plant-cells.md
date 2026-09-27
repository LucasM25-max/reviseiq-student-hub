# Content slice — Biology `4.1.1.2` Animal and plant cells (+ Required practical 1)

> **Status:** specified, not authored. This is the build sheet for the first real content in
> ReviseIQ, and for the first interactive required practical.

**Source material supplied:** AQA GCSE Biology (8461) specification text for `4.1.1.2`; the AQA
scheme of work row for `4.1.1.2`; and the AQA _GCSE Biology required practical activities_
handbook — teachers' notes and **student sheet** for Required practical activity 1: Microscopy.

**Supersedes** the earlier `4.1.1.1` + `4.1.1.2` slice. Two things changed on your instruction:

1. **We follow the scheme of work's teaching order, not the specification's numbering** (D44). The
   SoW teaches `4.1.1.2` _before_ `4.1.1.1`. So `4.1.1.1` is out of this slice entirely.
2. **Required practical 1 is back in** (D45, superseding D43) — and built as something a student
   actually does, not something they read about.

---

## 1. Scope

| In                                                    | Out                                                |
| ----------------------------------------------------- | -------------------------------------------------- |
| `4.1.1.2` Animal and plant cells — 4 spec points      | `4.1.1.1` Eukaryotes and prokaryotes — next slice  |
| **Required practical 1: Microscopy** (AT 1, AT 7)     | `4.1.1.3`–`4.1.1.6`                                |
| Magnification _of a drawing_, as RP1 step 19 requires | Resolution, electron microscopes, `4.1.1.5` proper |

SoW classroom time: **2 hours**, including the practical.

### Two scope seams, both deliberate, both declared

**The magnification formula leaks in from `4.1.1.5`.** RP1 step 19 makes students calculate
`magnification = length of drawing ÷ actual length of cell`. That is structurally the same formula
as `4.1.1.5`'s `magnification = image size ÷ real size`. We cannot do the practical honestly and
leave it out. Resolution: teach it **here as a practical tool**, in the drawing context only. Its
formal treatment — image/real size, standard form, resolving power, light vs electron microscopes —
stays in the `4.1.1.5` slice. The taxonomy records this as a _borrowed_ skill so the coverage
report does not later think `4.1.1.5` is already done.

**`bio-4112-func` will be only partially covered** (D-answer: defer). The spec statement lists
"nucleus, cell membranes, mitochondria, chloroplasts in plant cells **and plasmids in bacterial
cells**". Bacteria are not introduced until `4.1.1.1`. Teaching plasmids here would mean explaining
prokaryotes before the lesson that exists to do that. So:

- Nucleus, cell membrane, mitochondria, chloroplasts: covered here.
- Plasmids: deferred to the `4.1.1.1` slice.
- `bio-4112-func` carries `coverage: "partial"` with `blockedBy: ["4.1.1.1"]`, so
  `npm run content:report` shows the gap rather than a false green.

### What this slice does not exercise

No Higher-only content exists in `4.1.1.2` — the only HT-only line in all of `4.1.1` is in
`4.1.1.6`. **Tier filtering is therefore still untested** after this slice, and a green build is
not evidence it works. That was true of the previous plan too and has not changed.

---

## 2. Taxonomy

Four assessable spec points, all `tier: "BOTH"`:

| ID                | Statement (paraphrased)                                                                                                                                                         | Skills          | Coverage                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ------------------------------- |
| `bio-4112-animal` | Most animal cells have: nucleus, cytoplasm, cell membrane, mitochondria, ribosomes                                                                                              | WS 1.2          | full                            |
| `bio-4112-plant`  | Plant cells **often** additionally have chloroplasts and a permanent vacuole of cell sap; plant **and algal** cells also have a cellulose cell wall, which strengthens the cell | WS 1.2          | full                            |
| `bio-4112-func`   | Explain how the main sub-cellular structures relate to their functions                                                                                                          | WS 1.2          | **partial** — plasmids deferred |
| `bio-4112-est`    | Use estimations, and explain when to use them, to judge the relative size or area of sub-cellular structures                                                                    | MS 1d, 3a; AT 7 | full                            |

Plus one practical requirement:

| ID         | Requirement                                                                                                                      | Skills     |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `bio-rp-1` | Use a light microscope to observe, draw and label a selection of plant and animal cells. A magnification scale must be included. | AT 1, AT 7 |

**Skill codes:** MS 1d = make estimates · MS 3a = use `=`, `<`, `<<`, `>>`, `>`, `∝`, `~` ·
WS 1.2 = recognise, draw and interpret images and models · WS 4.4 = prefixes and powers of ten ·
WS 4.5 = interconvert units · AT 1 = measure length accurately · AT 7 = use a microscope and
produce labelled scientific drawings.

**Do not simplify the spec's hedges.** Plant cells "**often**" have chloroplasts; the vacuole is
the "**permanent**" one; the cell wall belongs to plant "**and algal**" cells. All three are
load-bearing and all three are examined.

---

## 3. Learn — three lessons

Following D38 (~20 minute self-study lessons; the SoW's classroom hours are guidance, not a
mapping) and D39 (KS3 recap taught in full by default, tagged `recap`, collapsible, and skipped by
Today for `GREEN` topics).

### Lesson 1 — Inside animal and plant cells (~20 min)

Covers `bio-4112-animal`, `bio-4112-plant`.

| #   | Block             | Content                                                     | Spec point |
| --- | ----------------- | ----------------------------------------------------------- | ---------- |
| 1   | `prose` (recap)   | KS3 recall of cell parts                                    | —          |
| 2   | `widget`          | `label-the-diagram` — animal cell, from memory first        | `animal`   |
| 3   | `prose`           | The five parts of most animal cells                         | `animal`   |
| 4   | `definition` ×5   | Nucleus, cytoplasm, cell membrane, mitochondria, ribosomes  | `animal`   |
| 5   | `check`           | Which of these is **not** found in most animal cells        | `animal`   |
| 6   | `diagram`         | `bio-plant-cell`, full labels                               | `plant`    |
| 7   | `prose`           | What plant cells add: chloroplasts, permanent vacuole, wall | `plant`    |
| 8   | `keyIdea`         | "Often", not "always" — and algal cells have walls too      | `plant`    |
| 9   | `misconception`   | "Every plant cell has chloroplasts" (root hair cells)       | `plant`    |
| 10  | `misconception`   | "The cell wall controls what enters the cell"               | `plant`    |
| 11  | `widget`          | `comparison-table` — animal vs plant, with a process row    | both       |
| 12  | `check`           | Two structures in a plant cell but not an animal cell       | `plant`    |
| 13  | `summary`         | Recap + notes links                                         | both       |
|     | **mastery check** | 4 questions from the live bank                              |            |

### Lesson 2 — Why each part is there, and how big it is (~20 min)

Covers `bio-4112-func` (minus plasmids), `bio-4112-est`. The AO2 lesson: the spec verb is
**explain**, and naming a part is worth one mark out of several.

| #   | Block             | Content                                                       | Spec point |
| --- | ----------------- | ------------------------------------------------------------- | ---------- |
| 1   | `keyIdea`         | Structure → function: the link is where the marks are         | `func`     |
| 2   | `prose`           | Nucleus and the control of cell activities                    | `func`     |
| 3   | `prose`           | Cell membrane and controlling what enters and leaves          | `func`     |
| 4   | `prose`           | Mitochondria and aerobic respiration                          | `func`     |
| 5   | `misconception`   | "Powerhouse of the cell" — why that phrase scores nothing     | `func`     |
| 6   | `prose`           | Chloroplasts, chlorophyll and photosynthesis                  | `func`     |
| 7   | `misconception`   | Chlorophyll is the pigment **inside** the chloroplast         | `func`     |
| 8   | `widget`          | `card-sort` — organelle → function                            | `func`     |
| 9   | `check`           | Explain why a muscle cell has many mitochondria               | `func`     |
| 10  | `prose`           | When an estimate is the right tool, and when it is not        | `est`      |
| 11  | `widget`          | `scale-explorer`, nested — cell → nucleus → chromosome → gene | `est`      |
| 12  | `example`         | Estimating the fraction of a cell's area taken by its nucleus | `est`      |
| 13  | `prose`           | Stating relative size with `<<` and `>>`                      | `est`      |
| 14  | `summary`         | Recap + notes links                                           | both       |
|     | **mastery check** | 4 questions from the live bank                                |            |

The `scale-explorer` in nested mode is exactly the SoW learning outcome _"describe the order of
size of: cell, nucleus, chromosome and gene"_.

### Lesson 3 — Required practical: microscopy (~30 min)

Covers `bio-rp-1`, reinforces `animal`/`plant`/`est`. Structurally different from lessons 1 and 2:
a short framing, then the simulation, then the write-up. Specified in full in §4.

| #   | Block             | Content                                                               |
| --- | ----------------- | --------------------------------------------------------------------- |
| 1   | `keyIdea`         | What this practical is for and what the exam asks about it            |
| 2   | `prose`           | Apparatus, and the safety point: goggles before iodine                |
| 3   | `widget`          | **`microscope-practical`** — the simulation, phases A–D               |
| 4   | `prose`           | Rules of a good biological drawing                                    |
| 5   | `misconception`   | The drawing's magnification is **not** the microscope's magnification |
| 6   | `example`         | Worked graticule → actual size → drawing magnification                |
| 7   | `summary`         | Method recap in the exam's language, linked to the practical sheet    |
|     | **mastery check** | 5 questions, weighted to the practical sub-bank                       |

---

## 4. The interactive required practical

The centrepiece. A student prepares a slide, drives a microscope, draws what they see, measures it
and calculates a magnification — following AQA's own 20-step student sheet, with realistic
consequences for bad technique.

### 4.1 Design principle

**The simulation and the question bank are generated from the same fault table.** Every way the
practical can go wrong is a row in one table, and that row produces three things: the visible
consequence in the sim, the mark-scheme point in the question bank, and the feedback text. They
cannot drift apart, because there is only one source.

This is also why the practical is worth building rather than describing. "Explain why the coverslip
is lowered with a mounted needle" is an abstract recall question after reading a method. It is a
memory after you have trapped five air bubbles across your only good specimen.

### 4.2 Architecture — a pure state machine

```
src/lib/practicals/microscope/
  state.ts     # SlideState | ScopeState | BenchState
  actions.ts   # discriminated union, 1:1 with the AQA student sheet steps
  reduce.ts    # pure (state, action) => state
  faults.ts    # derives active faults from state — never stored
  optics.ts    # derives focus error, field diameter, brightness, contrast
  graticule.ts # calibration and measurement arithmetic
  rubric.ts    # scores a method trace
  trace.ts     # the ordered action log — the assessable artefact
```

Everything above is **pure, DOM-free and unit-testable**. That is not a style preference. We have
no headless browser available in this environment — Playwright cannot be installed — so any logic
that only runs in a browser is logic we cannot test. Putting the entire simulation behind a pure
reducer means the hard part is covered by `vitest` and the React layer is a thin renderer over
derived state.

```ts
type Action =
  | { t: "wearGoggles" }
  | { t: "pipetteWater" }
  | { t: "peelEpidermis"; surface: "inner" | "outer" }
  | { t: "placeSpecimen" }
  | { t: "flattenSpecimen" }
  | { t: "addStain"; drops: number }
  | { t: "placeCoverslip"; method: "drop" | "lowerWithNeedle" }
  | { t: "blotExcess" }
  | { t: "mountSlide" }
  | { t: "selectObjective"; total: 40 | 100 | 400 }
  | { t: "coarseFocus"; delta: number; viewing: "side" | "eyepiece" }
  | { t: "fineFocus"; delta: number }
  | { t: "setIris"; value: number }
  | { t: "panStage"; dx: number; dy: number }
  | { t: "drawStroke"; points: Point[] }
  | { t: "placeLabel"; id: string; at: Point }
  | { t: "readGraticule"; divisions: number }
  | { t: "submitMagnification"; value: number };
```

### 4.3 The four phases (AQA student sheet steps 1–20)

| Phase                    | Steps | What the student does                                                                                                                              |
| ------------------------ | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Prepare the slide** | 1–9   | Water, peel the epidermis from the inner surface, flatten, two drops of iodine, lower the coverslip with a mounted needle, blot, mount             |
| **B. Find the cells**    | 10–15 | Lowest power first · rack down **while looking from the side** · focus _upwards_ through the eyepiece · switch objective · fine focus · go to ×400 |
| **C. Draw and label**    | 16    | Freehand drawing on canvas, then place labels                                                                                                      |
| **D. Measure**           | 17–20 | Read the eyepiece graticule · convert to µm · measure the drawing · calculate and state the drawing's magnification                                |

### 4.4 Fault model

Faults are **derived from state, never stored**. Each is a visible consequence _and_ a mark-scheme
point.

| Fault               | Trigger                                               | What the student sees                  | Question it licenses                             |
| ------------------- | ----------------------------------------------------- | -------------------------------------- | ------------------------------------------------ |
| `airBubbles`        | coverslip `"drop"` instead of `"lowerWithNeedle"`     | 2–5 dark-rimmed circles over the field | Why lower the coverslip with a mounted needle?   |
| `noStain`           | 0 drops of iodine                                     | Almost no contrast; nuclei invisible   | Why is iodine solution added?                    |
| `overStained`       | > 3 drops                                             | Opaque; structures merge               | Suggest why the student could not see the nuclei |
| `tooThick`          | peeled from the outer surface, or not flattened       | Several focal planes; never all sharp  | Why must the layer be thin and flat?             |
| `dryMount`          | no water before the specimen                          | Shrivelled cells, dark edges           | Why is a drop of water used?                     |
| `driftingCoverslip` | excess liquid not blotted                             | Field slowly drifts                    | Why blot around the coverslip?                   |
| `crackedSlide`      | coarse focus **downwards** while viewing the eyepiece | Run ends — slide broken, start again   | Why rack down while looking from the side?       |
| `lostAtHighPower`   | first objective is not ×40                            | Dark, empty field                      | Why start on the lowest power objective?         |
| `noGoggles`         | iodine added before goggles                           | Safety flag on the trace               | State one safety precaution and why              |

You chose **consequences, not warnings**: mistakes are allowed to happen and are shown. The only
affordance is a one-click _"start a fresh slide"_, and the trace records that a restart happened —
because on the real bench you would have to start again too.

### 4.5 Optics model

Enough realism to make the technique matter, no more.

```
fieldDiameterUm = 18000 / objectiveMag        // ×4 → 4500 µm, ×10 → 1800 µm, ×40 → 450 µm
focusError      = |stageHeight − focalPlane(objective, specimenThickness)|
blurPx          = clamp(focusError × depthFactor(objective), 0, 12)
```

`depthFactor` rises sharply with magnification, so depth of field shrinks and ×400 is genuinely
twitchy — which is exactly why AQA step 14 calls for the **fine** adjustment. Brightness follows
the iris, contrast follows stain quantity.

**Real dimensions**, so the maths in phase D comes out sensibly:

| Object                | Real size                             |
| --------------------- | ------------------------------------- |
| Onion epidermal cell  | 250–350 µm long, 60–100 µm wide       |
| Its nucleus           | 5–10 µm                               |
| Field of view at ×400 | 450 µm — one cell nearly fills it     |
| Field of view at ×40  | 4500 µm — around fifteen cells across |

That progression is the pedagogical point of steps 10–15: you find cells at low power because at
high power there is nothing to aim at.

**Rendering:** one SVG cell field per specimen, seeded so a student's slide is reproducible;
a circular field mask; `blur()`, `contrast()` and `brightness()` CSS filters over it; bubbles as
overlay circles. No canvas except the drawing layer, no WebGL, no physics engine.

### 4.6 Graticule and the magnification calculation

Using AQA's own calibration figures from the teachers' notes: **90 divisions = 240 µm at ×400**,
so 1 division = 2.67 µm. Scaled per objective:

| Total magnification | µm per graticule division |
| ------------------- | ------------------------- |
| ×40                 | 26.7                      |
| ×100                | 10.67                     |
| ×400                | 2.67                      |

The student measures the cell in divisions, converts to µm, measures their own drawing with an
on-screen ruler in mm, converts, and computes
`magnification = drawing length ÷ actual length`. Multi-step, unit-converting, and exercising
MS 1a, MS 1b, MS 2a, WS 4.4 and WS 4.5 in one task.

A virtual **stage micrometer** is available as an optional calibration path, for the same reason
AQA offers it: it turns "you are told a division is worth 2.67 µm" into something the student
derives.

### 4.7 Freehand drawing (your call — and how we de-risk it)

You chose a real freehand canvas, AI-marked. I advised against it because marking a drawing from
pixels is unreliable and a wrong mark destroys trust faster than almost anything else. Since you
want it, here is how we make it defensible rather than hoping:

**1. Capture vectors, never a bitmap.** Strokes are stored as point arrays from pointer events.
This single decision moves most of the rubric out of AI's hands and into arithmetic:

| Rubric point                             | How it is checked                                              |
| ---------------------------------------- | -------------------------------------------------------------- |
| Single clear lines, not sketchy          | Overlapping-short-stroke count per outline — **deterministic** |
| No shading                               | Stroke density inside closed regions — **deterministic**       |
| Drawn large enough to see                | Bounding box vs canvas area — **deterministic**                |
| Label lines straight, not crossing       | Segment intersection test — **deterministic**                  |
| Magnification stated below the drawing   | Field present and numeric — **deterministic**                  |
| Cells look like onion epidermal cells    | Narrow AI judgement                                            |
| Each label points at the right structure | Narrow AI judgement, one label at a time                       |

**2. Shrink the AI's question.** It is never asked to "mark this drawing". It is asked one narrow,
structured question per item — _"is this pin on a cell wall?"_ — with a `responseSchema`, at
`temperature: 0`.

**3. Drawing marks are advisory.** They never lower a mastery estimate, never create a flashcard,
and always show the rubric with the existing _"this mark looks wrong"_ appeal button. If the AI is
wrong, the cost is a wrong tick on a practice drawing, not a corrupted revision plan.

**4. The guided-labelling path survives as the accessible alternative** (§4.8) — which also means
anyone who wants deterministic marking can have it.

### 4.8 Accessibility

A drag-heavy microscope is a wall for keyboard and screen-reader users, and this is the most
interaction-dense thing in the product.

- Every bench action exists as a labelled button. Drag is an enhancement, never the only route.
- Focus and iris controls are ARIA sliders, arrow-key operable, with a live region announcing
  state changes: _"blurred"_, _"nearly focused"_, _"in focus"_.
- The field of view carries a continuously updated text description — _"Rectangular cells in rows,
  blurred. Two air bubbles present."_ — so the simulation is followable without sight.
- Freehand drawing is the one irreducibly visual task. Guided labelling on the observed field is
  the documented equivalent, and earns the same credit.
- `prefers-reduced-motion` disables the drift animation.

### 4.9 Testing

The whole point of §4.2. With no browser available, coverage comes from the reducer:

- **Reducer:** every action from every relevant state.
- **Faults:** one test per row of §4.4 proving the trigger fires it — and, just as importantly, one
  proving it does _not_ fire otherwise.
- **Optics:** property tests — blur is monotonic in focus error; field diameter is inversely
  proportional to magnification.
- **Graticule:** AQA's own numbers as fixtures (90 div = 240 µm ⇒ 2.67 µm/div).
- **Rubric:** golden method traces — one perfect run, one per fault — asserting the exact score.
- **Geometry checks:** synthetic stroke sets for sketchy lines, shading, undersized drawings and
  crossing label lines.

### 4.10 Effort and roadmap impact

This is the largest single component in the product after the Today engine, and it is not in the
current roadmap at all. It needs its own phase rather than being absorbed into Phase 3's content
pipeline. Rough shape of the work, largest first: the SVG cell fields and their focus/stain states;
the freehand capture and geometry rubric; the reducer, fault and optics model; the AI drawing
judgement, which is the only genuinely uncertain piece.

The honest risk: **it is the kind of component that is 80% done for a long time.** It should be
built against a fixed fault table and acceptance list (§9) rather than polished open-endedly, and
`4.1.1.2` should not be blocked on it — lessons 1 and 2, the notes and the content questions can
all ship first.

---

## 5. Diagrams and widgets

Per D40, widgets are generic data-driven engines, not per-topic components. Reused as configured:

| Widget                 | Configured here as                                                                                       |
| ---------------------- | -------------------------------------------------------------------------------------------------------- |
| `label-the-diagram`    | Animal and plant cells                                                                                   |
| `comparison-table`     | Animal vs plant, with a process row (respiration, photosynthesis, protein synthesis) as the SoW suggests |
| `scale-explorer`       | Nested: cell → nucleus → chromosome → gene                                                               |
| `card-sort`            | Organelle → function                                                                                     |
| `microscope-practical` | **New.** RP1, as specified in §4                                                                         |

| SVG diagram            | Used by                                                                                       |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| `bio-animal-cell`      | L1, notes, label widget, questions                                                            |
| `bio-plant-cell`       | L1, notes, label widget, questions                                                            |
| `bio-cell-scale-strip` | `scale-explorer`                                                                              |
| `bio-onion-field-x40`  | Microscope sim, low power                                                                     |
| `bio-onion-field-x100` | Microscope sim, medium power                                                                  |
| `bio-onion-field-x400` | Microscope sim, high power — cytoplasm, cell wall, nucleus, vacuole visible, per the handbook |
| `bio-microscope-parts` | Labelled microscope diagram, from the student sheet                                           |

`bio-bacterial-cell` is **not** needed until the `4.1.1.1` slice.

---

## 6. Revise

### Notes — `/revise/biology/notes/4-1-1-2`

Section slugs are permanent once shipped; Today deep-links to them.

| Slug              | Section                                      |
| ----------------- | -------------------------------------------- |
| `#animal-cells`   | Parts of an animal cell                      |
| `#plant-cells`    | What plant and algal cells add               |
| `#functions`      | Structure → function table                   |
| `#estimating`     | Judging relative size and area               |
| `#practical`      | RP1 method, in the exam's language           |
| `#drawing-rules`  | What makes a biological drawing creditworthy |
| `#exam-technique` | Why naming a part rarely earns full marks    |

### Required practical sheet — `/revise/biology/practicals/rp-1`

Per doc 01 §4.4: aim, apparatus, method, variables, results handling, sources of error, safety,
typical exam questions. Appears standalone **and** inline at `#practical` in the notes (D14). Every
error in §4.4's fault table appears in the "sources of error" section, and each links back into the
simulation at the phase where it happens.

### Blurt prompts

| Prompt intent                                                    | `expectedPoints` |
| ---------------------------------------------------------------- | ---------------- |
| Every part of an animal cell and what it does                    | 5                |
| What plant and algal cells have that animal cells don't, and why | 5                |
| The method for preparing and viewing an onion cell slide         | 8                |
| Everything that can go wrong with a slide, and why               | 6                |

---

## 7. Test — question blueprint

Per D42, ~10 content questions. The practical adds a sub-bank of **5**, because practical questions
are ≥15% of real exam marks and this slice now owns a required practical.

**15 questions, ≈41 marks**, of which **14 marks (34%) are practical** — comfortably above the
exam's ≥15%.

### Content — 10 questions, ~27 marks

| #   | Type            | Marks | Command  | AO      | Spec points               |
| --- | --------------- | ----- | -------- | ------- | ------------------------- |
| 1   | `MCQ`           | 1     | —        | AO1     | `plant`                   |
| 2   | `MCQ`           | 1     | —        | AO1     | `func`                    |
| 3   | `SHORT`         | 3     | Label    | AO1     | `animal`, `plant`         |
| 4   | `SHORT`         | 2     | State    | AO1     | `func`                    |
| 5   | `SHORT`         | 2     | Explain  | AO2     | `func`                    |
| 6   | `SHORT`         | 3     | Explain  | AO2     | `func`                    |
| 7   | `DATA_RESPONSE` | 3     | Estimate | AO2     | `est`                     |
| 8   | `SHORT`         | 3     | Suggest  | AO3     | `func`                    |
| 9   | `SHORT`         | 3     | Compare  | AO2     | `animal`, `plant`         |
| 10  | `EXTENDED`      | 6     | Explain  | AO2/AO3 | `animal`, `plant`, `func` |

### Practical — 5 questions, ~14 marks

| #   | Type          | Marks | Command   | AO  | Drawn from                                      |
| --- | ------------- | ----- | --------- | --- | ----------------------------------------------- |
| 11  | `PRACTICAL`   | 4     | Describe  | AO1 | Student sheet steps 1–9                         |
| 12  | `PRACTICAL`   | 2     | Explain   | AO2 | Fault `airBubbles`                              |
| 13  | `PRACTICAL`   | 2     | Explain   | AO2 | Fault `noStain`                                 |
| 14  | `PRACTICAL`   | 3     | Suggest   | AO3 | Faults `lostAtHighPower` / `overStained`        |
| 15  | `CALCULATION` | 3     | Calculate | AO2 | Graticule → actual size → drawing magnification |

Targets: AO1/AO2/AO3 within ±5% of 40/40/20 across the whole bank · ≥5 question types · ≥1 extended
response · every question `tier: "BOTH"` with Foundation/Higher separated by a difficulty cap in
the selector, never by hiding questions (D41).

---

## 8. Mark schemes, misconceptions and exclusions

### Conventions specific to this content

1. **A comparison must compare.** Listing one cell type's features scores zero on _compare_ and
   _give the differences_ questions, however correct. Mark points are written as paired statements.
2. **Right + wrong = wrong.** A correct statement contradicted by an incorrect one in the same
   answer negates the mark — AQA's stated convention. The marker must implement it or we will be
   more generous than the real exam and manufacture false confidence.
3. **Hedges are marked.** Reject "all plant cells have chloroplasts". Accept "often" / "most".
4. **Cell wall ≠ cell membrane.** "The cell wall controls what enters" is rejected wherever it
   appears, including as a throwaway clause in an otherwise strong answer.
5. **Vague function language earns nothing.** "Powerhouse", "brain of the cell", "controls the
   cell" are rejected; "site of aerobic respiration" is credited.
6. **Units and prefixes are marked.** A numerically correct magnification with the wrong prefix or
   no unit loses the mark. Error carried forward applies to the second step of §4.6's calculation.
7. **`modelAnswer` is never sent to the marker** (doc 04).

### Misconception register

| #   | Misconception                                            | Why it is wrong                                                     | Handled in                |
| --- | -------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------- |
| 1   | Every plant cell has chloroplasts                        | Spec says **often**; root hair cells have none                      | L1 block 9; Q1 distractor |
| 2   | The cell wall controls what enters and leaves            | The membrane does; the wall gives strength                          | L1 block 10; reject list  |
| 3   | Animal cells have a cell wall                            | They do not                                                         | L1; Q9 reject             |
| 4   | Only plant cells have vacuoles                           | The spec's claim is about the **permanent** vacuole                 | L1; notes                 |
| 5   | Mitochondria are "the powerhouse"                        | Not creditworthy — _site of aerobic respiration_                    | L2 block 5; reject list   |
| 6   | Chlorophyll and chloroplast are the same thing           | Chlorophyll is the pigment inside the chloroplast                   | L2 block 7; reject list   |
| 7   | Ribosomes are too small to matter                        | They are on the spec list for animal cells                          | L1 block 4                |
| 8   | **Air bubbles are cells**                                | Perfectly round with a thick dark rim — students draw them as cells | Sim fault; L3; Q12        |
| 9   | **The drawing's magnification is the microscope's**      | The drawing magnification is drawing ÷ actual size                  | L3 block 5; Q15           |
| 10  | Staining makes the cells bigger or changes them          | It increases contrast only                                          | L3; Q13                   |
| 11  | Start on high power to see more detail                   | You will never find the cells                                       | Sim fault; Q14            |
| 12  | Focus by racking down while looking through the eyepiece | You crack the slide — hence step 11                                 | Sim fault; L3             |

### Beyond-spec exclusions (D37)

Not on AQA GCSE Biology 8461, therefore never required by a mark point, never taught, but always
**accepted** if a student volunteers them correctly:

Golgi apparatus · endoplasmic reticulum · lysosome · tonoplast · 70S/80S ribosomes · peptidoglycan
· resolution and resolving power (`4.1.1.5`) · electron microscopes, SEM/TEM (`4.1.1.5`) · oil
immersion · numerical aperture · the chemistry of iodine staining beyond "increases contrast"

---

## 9. Acceptance criteria

**Content**

- [ ] `npm run content:validate` passes; no dangling diagram, widget or question IDs
- [ ] `npm run content:report` shows `bio-4112-func` as **partial**, blocked by `4.1.1.1` — not green
- [ ] 15 questions, ≈41 marks, AO split within ±5% of 40/40/20, ≥5 types, ≥1 extended
- [ ] Practical questions ≥15% of the slice's marks
- [ ] Every mark point atomic and independently awardable
- [ ] All 12 misconceptions appear in a lesson block, distractor or reject list
- [ ] No excluded term appears in any lesson, note or required mark point
- [ ] Marker awards **zero** to a one-sided answer on a _compare_ question — explicit golden-set case
- [ ] AI marking golden set ≥60 answers, ≥90% within ±1 mark

**Practical simulation**

- [ ] All 20 AQA student-sheet steps are performable, in order, and out of order
- [ ] Every fault in §4.4 fires on its trigger and **only** on its trigger, proven by test
- [ ] A perfect run scores full marks on the rubric; each faulted run loses exactly the expected points
- [ ] Graticule arithmetic matches AQA's fixtures (90 div = 240 µm ⇒ 2.67 µm/div)
- [ ] Field of view visibly and correctly changes with objective, focus, stain and iris
- [ ] Cracking the slide ends the run and requires a fresh slide; the restart is recorded in the trace
- [ ] Fully keyboard-operable; field of view has a live text description; axe check clean
- [ ] Guided labelling available as the equivalent-credit alternative to freehand drawing
- [ ] Drawing marks are advisory: they never alter mastery and never create a flashcard
- [ ] Simulation logic reaches high coverage in `vitest` with **no browser required**

---

## 10. Open questions

1. **Cheek cells.** You chose onion only, matching AQA's student sheet. The required practical as
   written says "plant **and** animal cells", so onion alone does not fully satisfy it — the SoW
   adds cheek cells with methylene blue for exactly this reason. Specimens are data, so adding one
   later is cheap if we design for it now. Do you want the seam left open deliberately, and
   recorded in the coverage report the same way the plasmid gap is?
2. **Where the practical sits in the roadmap.** It does not fit inside Phase 3. My proposal is a
   dedicated phase, with lessons 1–2, notes and content questions shipping first so `4.1.1.2` is
   not blocked behind it.
3. **Source material for `4.1.1.1`.** Now the next slice rather than a prior one. It unblocks the
   deferred plasmid coverage and the bacterial cell diagram.
4. **Estimation** (`bio-4112-est`) remains the vaguest thing in this spec extract and the hardest
   to write a fair mark scheme for. Any past question that assesses it would be worth more than
   anything else you could send.
