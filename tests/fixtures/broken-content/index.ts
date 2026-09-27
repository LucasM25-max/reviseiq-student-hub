/**
 * Deliberately broken content.
 *
 * Phase 3's exit criterion is that **CI fails on a deliberately broken content file**.
 * These fixtures are that file. They are permanently broken on purpose, and
 * tests/content-cli.test.ts runs the real validator over each of them in a subprocess,
 * asserting a non-zero exit code and the specific complaints listed below.
 *
 * Doing it this way means the proof runs through the identical code path as
 * `npm run content:validate` without ever mutating real content — so an interrupted test
 * run cannot leave the repository broken.
 *
 * There are three fixtures because the validator has three layers and stops at the first
 * that fails: a schema error makes ids unreliable, so cross-referencing is skipped; and
 * cross-reference errors make counting meaningless, so the coverage gates are skipped.
 * One fixture per layer proves all three actually block.
 *
 * If you add a check to the validator, add a defect to the matching fixture.
 */

// ---------------------------------------------------------------------------
// Layer 1 — schema violations
// ---------------------------------------------------------------------------

export const schemaBroken = {
  taxonomies: [
    {
      subjectId: "aqa-biology",
      topicCode: "4.1",
      subTopics: [
        {
          id: "aqa-biology-4.1.1",
          code: "4.1.1",
          title: "Cell structure",
          order: 0,
          specPoints: [
            {
              id: "sp-ok",
              code: "4.1.1.2",
              statement: "A perfectly valid spec point, so the failures below stand alone.",
            },
          ],
        },
      ],
    },
  ],
  practicals: [],
  lessons: [
    {
      id: "broken-lesson",
      subTopicId: "aqa-biology-4.1.1",
      slug: "broken-lesson",
      title: "A lesson with several problems",
      summary: "Every block below trips a different check.",
      order: 0,
      estMinutes: 20,
      blocks: [
        { type: "prose", specPoints: ["sp-ok"], body: "Valid." },
        {
          type: "check",
          prompt: "Which option is correct?",
          options: [
            { key: "A", text: "First" },
            { key: "B", text: "Second" },
          ],
          // DEFECT — the answer key is not one of the options, so every attempt is wrong.
          correctKey: "D",
          explanation: "The key does not match any option.",
        },
        {
          type: "check",
          prompt: "Which option is correct?",
          options: [
            { key: "A", text: "First" },
            // DEFECT — duplicate option keys.
            { key: "A", text: "Also first" },
          ],
          correctKey: "A",
          explanation: "Two options share a key.",
        },
      ],
    },
    {
      id: "recap-only-lesson",
      subTopicId: "aqa-biology-4.1.1",
      slug: "recap-only-lesson",
      title: "A lesson made entirely of recap",
      summary: "Prior-stage material is not GCSE teaching (D39).",
      order: 1,
      estMinutes: 10,
      // DEFECT — no block teaches a spec point; recap alone cannot carry a lesson.
      blocks: [{ type: "prose", recap: true, specPoints: ["sp-ok"], body: "Recap only." }],
    },
  ],
  notes: [
    {
      subTopicId: "aqa-biology-4.1.1",
      // DEFECT — a notes page with no sections.
      sections: [],
    },
  ],
  questions: [
    {
      id: "broken-q01",
      subjectId: "aqa-biology",
      primarySubTopicId: "aqa-biology-4.1.1",
      type: "SHORT",
      paper: 1,
      // DEFECT — mark points total 2 but the question claims 3 marks.
      marks: 3,
      commandWord: "State",
      ao: "AO1",
      difficulty: 2,
      estSeconds: 120,
      stem: "A question whose mark scheme does not add up.",
      specPoints: [{ code: "sp-ok" }],
      markScheme: {
        points: [
          { id: "mp1", text: "First point", marks: 1 },
          { id: "mp2", text: "Second point", marks: 1 },
        ],
      },
    },
    {
      id: "broken-q02",
      subjectId: "aqa-biology",
      primarySubTopicId: "aqa-biology-4.1.1",
      type: "MCQ",
      paper: 1,
      marks: 1,
      commandWord: "Tick one box",
      ao: "AO1",
      difficulty: 1,
      estSeconds: 45,
      // DEFECT — MCQ with neither options nor a correct key.
      stem: "An MCQ with no options at all.",
      specPoints: [{ code: "sp-ok" }],
      markScheme: { points: [{ id: "mp1", text: "The answer", marks: 1 }] },
    },
    {
      id: "broken-q03",
      subjectId: "aqa-biology",
      primarySubTopicId: "aqa-biology-4.1.1",
      type: "CALCULATION",
      paper: 1,
      marks: 2,
      commandWord: "Calculate",
      ao: "AO2",
      difficulty: 3,
      estSeconds: 150,
      stem: "A calculation whose method marks point at nothing.",
      specPoints: [{ code: "sp-ok" }],
      markScheme: {
        points: [
          { id: "mp1", text: "Method", marks: 1 },
          { id: "mp2", text: "Answer", marks: 1 },
        ],
        numericAnswer: {
          // DEFECT — tolerance band is inverted.
          accept: { min: 10, max: 5 },
          unit: "µm",
          // DEFECT — method mark id that is not on this question.
          methodPointIds: ["mp9"],
        },
      },
    },
    {
      id: "broken-q04",
      subjectId: "aqa-biology",
      primarySubTopicId: "aqa-biology-4.1.1",
      type: "PRACTICAL",
      paper: 1,
      marks: 1,
      commandWord: "Describe",
      ao: "AO1",
      difficulty: 2,
      estSeconds: 60,
      // DEFECT — PRACTICAL type with no practicalId.
      stem: "A practical question that names no practical.",
      specPoints: [{ code: "sp-ok" }],
      markScheme: { points: [{ id: "mp1", text: "A point", marks: 1 }] },
    },
    {
      id: "broken-q05",
      subjectId: "aqa-biology",
      primarySubTopicId: "aqa-biology-4.1.1",
      type: "EXTENDED",
      paper: 1,
      marks: 2,
      commandWord: "Evaluate",
      ao: "AO3",
      difficulty: 4,
      estSeconds: 180,
      stem: "An extended question carrying options it should not have.",
      // DEFECT — options on a non-MCQ question.
      options: [
        { key: "A", text: "One" },
        { key: "B", text: "Two" },
      ],
      specPoints: [{ code: "sp-ok" }],
      markScheme: {
        points: [
          { id: "mp1", text: "One", marks: 1 },
          // DEFECT — duplicate mark point id.
          { id: "mp1", text: "Two", marks: 1 },
        ],
      },
    },
  ],
  blurtPrompts: [],
};

// ---------------------------------------------------------------------------
// Layer 2 — schema-valid, but every reference dangles
// ---------------------------------------------------------------------------

export const referencesBroken = {
  taxonomies: [
    {
      subjectId: "aqa-biology",
      topicCode: "4.1",
      subTopics: [
        {
          id: "aqa-biology-4.1.1",
          code: "4.1.1",
          title: "Cell structure",
          order: 0,
          specPoints: [
            {
              id: "sp-full-but-blocked",
              code: "4.1.1.2",
              statement: "Coverage says FULL but something is recorded as blocking it.",
              // DEFECT — FULL coverage with a non-empty blockedBy is self-contradictory.
              coverage: "FULL" as const,
              blockedBy: ["this should not be here"],
            },
            {
              id: "sp-partial-no-reason",
              code: "4.1.1.2",
              statement: "Declared partial without saying what is missing.",
              // DEFECT — a PARTIAL gap with no stated reason is a hidden gap.
              coverage: "PARTIAL" as const,
              blockedBy: [],
            },
            {
              id: "sp-dangling-practical",
              code: "4.1.1.2",
              statement: "Points at a required practical that does not exist.",
              // DEFECT — dangling practical reference.
              practicalIds: ["bio-rp-99"],
            },
          ],
        },
      ],
    },
  ],
  practicals: [
    {
      id: "bio-rp-broken",
      subjectId: "aqa-biology",
      number: 1,
      title: "A practical with a broken fault table",
      requirement: "Something a student must be able to do.",
      aim: "Demonstrate the checks below.",
      apparatus: ["A thing"],
      method: [
        { n: 1, text: "First step." },
        // DEFECT — method steps are not numbered consecutively.
        { n: 3, text: "Third step, with the second missing." },
      ],
      safety: ["Be careful."],
      faults: [
        {
          id: "fault-a",
          trigger: "Something goes wrong.",
          effect: "Something visible happens.",
          reason: "The correct technique exists for a reason.",
          // DEFECT — the fault table points at a question that does not exist.
          questionIds: ["bio-question-that-was-deleted"],
        },
      ],
      // DEFECT — sub-topic that does not exist.
      subTopicIds: ["aqa-biology-9.9.9"],
      atSkills: ["AT 1"],
    },
  ],
  lessons: [
    {
      id: "dangling-lesson",
      subTopicId: "aqa-biology-4.1.1",
      slug: "dangling-lesson",
      title: "A lesson full of dangling references",
      summary: "Everything here parses, and none of it resolves.",
      order: 0,
      estMinutes: 20,
      blocks: [
        {
          type: "prose",
          // DEFECT — spec point that is not in the taxonomy.
          specPoints: ["bio-does-not-exist"],
          body: "Refers to a spec point that was renamed.",
        },
        {
          type: "diagram",
          // DEFECT — diagram id that is not in the registry.
          diagramId: "bio-nonexistent-diagram",
          labels: "all" as const,
        },
        {
          type: "diagram",
          diagramId: "bio-plant-cell",
          // DEFECT — structure key that the diagram does not have.
          labels: ["not-a-real-structure"],
        },
        {
          type: "widget",
          // DEFECT — widget id that is not in the registry.
          widgetId: "widget-that-was-never-built",
        },
      ],
    },
    {
      id: "duplicate-slug-lesson",
      subTopicId: "aqa-biology-4.1.1",
      // DEFECT — slug already used by another lesson in the same sub-topic.
      slug: "dangling-lesson",
      title: "A lesson reusing another lesson's slug",
      summary: "Two lessons cannot share a URL.",
      order: 1,
      estMinutes: 20,
      blocks: [{ type: "prose", specPoints: ["sp-full-but-blocked"], body: "Valid block." }],
    },
  ],
  notes: [
    {
      subTopicId: "aqa-biology-4.1.1",
      sections: [
        { id: "dangling-n1", slug: "duplicate-slug", title: "First", body: "Body." },
        // DEFECT — duplicate anchor slug: Today's deep links would become ambiguous.
        { id: "dangling-n2", slug: "duplicate-slug", title: "Second", body: "Body." },
      ],
    },
  ],
  questions: [
    {
      id: "dangling-q01",
      subjectId: "aqa-biology",
      // DEFECT — sub-topic that does not exist.
      primarySubTopicId: "aqa-biology-9.9.9",
      type: "SHORT" as const,
      paper: 1 as const,
      marks: 1,
      commandWord: "State",
      ao: "AO1" as const,
      difficulty: 2,
      estSeconds: 60,
      stem: "A question attached to a sub-topic that does not exist.",
      assets: {
        diagramId: "bio-plant-cell",
        // DEFECT — lettering a structure the diagram does not have.
        diagramLetters: ["not-a-real-structure"],
        dataTable: {
          headers: ["A", "B"],
          // DEFECT — row has fewer cells than there are headers.
          rows: [["only one cell"]],
        },
      },
      // DEFECT — spec point that does not exist.
      specPoints: [{ code: "sp-that-was-deleted" }],
      // DEFECT — practical that does not exist.
      practicalId: "bio-rp-99",
      markScheme: { points: [{ id: "mp1", text: "A point", marks: 1 }] },
    },
  ],
  blurtPrompts: [
    {
      id: "dangling-b1",
      // DEFECT — sub-topic that does not exist.
      subTopicId: "aqa-biology-9.9.9",
      prompt: "Recall everything about a sub-topic that is not in the taxonomy.",
      expectedPoints: [
        { id: "ep1", idea: "One" },
        // DEFECT — duplicate expected point id.
        { id: "ep1", idea: "Two" },
        { id: "ep3", idea: "Three" },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Layer 3 — everything resolves, but the content is not good enough to ship
// ---------------------------------------------------------------------------

const trivialQuestion = (
  id: string,
  marks: number,
  ao: "AO1" | "AO2" | "AO3",
  specPoint = "sp-thin",
) => ({
  id,
  subjectId: "aqa-biology",
  primarySubTopicId: "aqa-biology-4.1.1",
  type: "SHORT" as const,
  paper: 1 as const,
  marks,
  commandWord: "State",
  ao,
  difficulty: 2,
  estSeconds: 60 * marks,
  stem: `A valid but unremarkable question (${id}).`,
  specPoints: [{ code: specPoint }],
  markScheme: {
    points: Array.from({ length: marks }, (_, index) => ({
      id: `mp${index + 1}`,
      text: `Point ${index + 1}`,
      marks: 1,
    })),
  },
});

export const gatesBroken = {
  taxonomies: [
    {
      subjectId: "aqa-biology",
      topicCode: "4.1",
      subTopics: [
        {
          id: "aqa-biology-4.1.1",
          code: "4.1.1",
          title: "Cell structure",
          order: 0,
          specPoints: [
            {
              id: "sp-thin",
              code: "4.1.1.2",
              statement: "Taught and tested, but the bank around it is too thin.",
            },
            {
              id: "sp-untested",
              code: "4.1.1.2",
              // DEFECT — taught by a lesson block, but no question tests it.
              statement: "Taught but never tested.",
            },
            {
              id: "sp-recap-only",
              code: "4.1.1.2",
              // DEFECT — only recap blocks relate to it, which never satisfies coverage (D39).
              statement: "Touched only by prior-stage recap material.",
            },
          ],
        },
      ],
    },
  ],
  practicals: [],
  lessons: [
    {
      id: "thin-lesson",
      subTopicId: "aqa-biology-4.1.1",
      slug: "thin-lesson",
      title: "A valid lesson",
      summary: "Parses and resolves; the bank around it does not clear the gates.",
      order: 0,
      estMinutes: 20,
      blocks: [
        { type: "prose", specPoints: ["sp-thin"], body: "Teaches the first point." },
        { type: "prose", specPoints: ["sp-untested"], body: "Teaches the second point." },
        {
          type: "prose",
          recap: true,
          specPoints: ["sp-recap-only"],
          body: "Only recaps the third point.",
        },
      ],
    },
  ],
  notes: [
    {
      subTopicId: "aqa-biology-4.1.1",
      sections: [
        {
          id: "thin-n1",
          slug: "only-section",
          title: "The only section",
          body: "Body.",
          specPointCodes: ["4.1.1.2"],
        },
      ],
    },
  ],
  // DEFECT — 4 questions (needs ≥8), 1 type (needs ≥3), 0 extended (needs ≥1),
  // and an AO split of 100/0/0 against a 40/40/20 target.
  questions: [
    trivialQuestion("thin-q01", 1, "AO1"),
    trivialQuestion("thin-q02", 1, "AO1"),
    trivialQuestion("thin-q03", 1, "AO1"),
    // Tests sp-recap-only, so that point is not a total gap — it is *tested* but only
    // *recapped*, which is precisely the case D39 says must still fail.
    trivialQuestion("thin-q04", 1, "AO1", "sp-recap-only"),
  ],
  blurtPrompts: [],
};
