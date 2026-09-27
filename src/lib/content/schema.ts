/**
 * Zod schemas for everything in /content.
 *
 * These are the gate. Nothing reaches Postgres without parsing cleanly here, so a
 * malformed mark scheme, an unknown block type, a dangling diagram id or a duplicate
 * question id fails the build rather than reaching a student.
 *
 * Deliberate deviation from docs/plan/04-content-pipeline.md: content is authored as
 * typed TypeScript with **markdown** strings inside prose fields, not as .mdx files.
 * Lesson blocks were always specified as "data, not code" (doc 01 §3), and interactive
 * pieces are `widget` blocks referenced by id. Allowing arbitrary JSX inside content
 * would mean content that cannot be validated, cannot be safely seeded to a database,
 * and can execute. Markdown + KaTeX gives us the formatting and maths we need with
 * none of that. See docs/plan/04-content-pipeline.md.
 */
import { z } from "zod";

/** Non-empty, trimmed prose. Catches the "" and "   " that slip through hand-authoring. */
const text = z.string().trim().min(1);

/**
 * Markdown that will be rendered inside a page that already has its own headings.
 *
 * `#` and `##` are reserved for page structure: a lesson page owns its `<h1>`, and note
 * sections own their `<h2>`. A content body that opens with `## Something` would either
 * outrank or duplicate that, which breaks the document outline a screen-reader user
 * navigates by — and renders unstyled, because the renderer only themes `h3` and `h4`.
 * Authors should use a new block or a new note section instead; that is what blocks are
 * for. `###`/`####` are fine, since they nest correctly underneath.
 */
const markdown = text.refine(
  (value) => !/^#{1,2} /m.test(value),
  "use a new block or note section instead of a top-level '#'/'##' heading; '###' and deeper are fine",
);

const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be a lowercase kebab-case slug");

const id = z
  .string()
  .regex(/^[a-z0-9]+(?:[-:.][a-z0-9]+)*$/, "must be a lowercase id (a-z, 0-9, - : .)");

export const tierSchema = z.enum(["BOTH", "FOUNDATION", "HIGHER"]);
export const coverageSchema = z.enum(["FULL", "PARTIAL"]);
export const aoSchema = z.enum(["AO1", "AO2", "AO3"]);
export const questionTypeSchema = z.enum([
  "MCQ",
  "SHORT",
  "CALCULATION",
  "EXTENDED",
  "PRACTICAL",
  "DATA_RESPONSE",
]);

/**
 * AQA skill codes, validated by shape so a typo ("MS1b" for "MS 1b") cannot silently
 * create a skill that no report will ever match.
 */
const mathsSkill = z.string().regex(/^MS \d[a-z]$/, 'must look like "MS 1b"');
const wsSkill = z.string().regex(/^WS \d\.\d$/, 'must look like "WS 4.4"');
const atSkill = z.string().regex(/^AT \d$/, 'must look like "AT 7"');

// ---------------------------------------------------------------------------
// Taxonomy
// ---------------------------------------------------------------------------

export const specPointSchema = z.object({
  id,
  /** AQA specification code, e.g. "4.1.1.2". Several points may share one code. */
  code: z.string().regex(/^\d+(?:\.\d+)*$/, 'must look like "4.1.1.2"'),
  statement: text,
  tier: tierSchema.default("BOTH"),
  mathsSkills: z.array(mathsSkill).default([]),
  wsSkills: z.array(wsSkill).default([]),
  practicalIds: z.array(id).default([]),
  /** PARTIAL when part of the statement is knowingly deferred. Must say what blocks it. */
  coverage: coverageSchema.default("FULL"),
  blockedBy: z.array(z.string().trim().min(1)).default([]),
});

export const subTopicSchema = z.object({
  id,
  code: z.string().regex(/^\d+(?:\.\d+)*$/),
  title: text,
  /** Position in AQA scheme-of-work teaching order (D44), which is not spec order. */
  order: z.number().int().nonnegative(),
  specPoints: z.array(specPointSchema).min(1),
});

export const taxonomySchema = z.object({
  subjectId: id,
  topicCode: z.string().regex(/^\d+(?:\.\d+)*$/),
  subTopics: z.array(subTopicSchema).min(1),
});

// ---------------------------------------------------------------------------
// Lessons
// ---------------------------------------------------------------------------

const blockBase = {
  /** Spec points this block teaches. Empty is legal only for recap and summary blocks. */
  specPoints: z.array(id).default([]),
  /** Prior-stage material: taught in full by default, collapsible, Today-skippable (D39). */
  recap: z.boolean().default(false),
  priorStage: z.literal("KS3").optional(),
};

const checkOptionSchema = z.object({
  key: z.string().regex(/^[A-D]$/),
  text,
});

export const lessonBlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("prose"), body: markdown, ...blockBase }),
  z.object({ type: z.literal("keyIdea"), body: markdown, ...blockBase }),
  z.object({ type: z.literal("definition"), term: text, body: markdown, ...blockBase }),
  z.object({
    type: z.literal("example"),
    title: text,
    steps: z.array(text).min(1),
    ...blockBase,
  }),
  z.object({
    type: z.literal("diagram"),
    diagramId: id,
    labels: z.union([z.literal("all"), z.literal("none"), z.array(z.string().min(1))]),
    caption: text.optional(),
    ...blockBase,
  }),
  z.object({
    type: z.literal("widget"),
    widgetId: id,
    config: z.record(z.string(), z.unknown()).default({}),
    ...blockBase,
  }),
  z.object({
    type: z.literal("check"),
    prompt: text,
    options: z.array(checkOptionSchema).min(2).max(4),
    correctKey: z.string().regex(/^[A-D]$/),
    explanation: text,
    ...blockBase,
  }),
  z.object({
    type: z.literal("misconception"),
    claim: text,
    correction: text,
    ...blockBase,
  }),
  z.object({ type: z.literal("summary"), body: markdown, ...blockBase }),
]);

export const lessonSchema = z
  .object({
    id,
    subTopicId: id,
    slug,
    title: text,
    summary: text,
    order: z.number().int().nonnegative(),
    estMinutes: z.number().int().positive().max(60),
    tier: tierSchema.default("BOTH"),
    blocks: z.array(lessonBlockSchema).min(1),
  })
  .superRefine((lesson, ctx) => {
    // A check block's answer key must actually be one of its options, or the lesson
    // silently marks every attempt wrong.
    lesson.blocks.forEach((block, index) => {
      if (block.type !== "check") return;
      if (!block.options.some((option) => option.key === block.correctKey)) {
        ctx.addIssue({
          code: "custom",
          path: ["blocks", index, "correctKey"],
          message: `correctKey "${block.correctKey}" is not one of the options`,
        });
      }
      const keys = block.options.map((option) => option.key);
      if (new Set(keys).size !== keys.length) {
        ctx.addIssue({
          code: "custom",
          path: ["blocks", index, "options"],
          message: "option keys must be unique",
        });
      }
    });

    // D39: recap blocks may *relate* to a spec point — that is useful for reporting —
    // but they never *satisfy* it. Prior-stage material is not GCSE teaching, so the
    // coverage gate in ./coverage.ts excludes recap blocks when deciding whether a spec
    // point is taught. Enforcing it there rather than here keeps the relationship
    // visible instead of throwing it away.
    if (
      lesson.blocks.length > 0 &&
      lesson.blocks.every((block) => block.recap || block.specPoints.length === 0)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["blocks"],
        message:
          "no block in this lesson teaches a spec point — recap and untagged blocks do not count (D39)",
      });
    }
  });

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

export const noteSectionSchema = z.object({
  id,
  /** Becomes the #anchor Today deep-links to. Permanent once shipped. */
  slug,
  title: text,
  body: markdown,
  tier: tierSchema.default("BOTH"),
  specPointCodes: z.array(z.string()).default([]),
});

export const notesPageSchema = z.object({
  subTopicId: id,
  sections: z.array(noteSectionSchema).min(1),
});

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------

export const markPointSchema = z.object({
  id: z.string().regex(/^mp\d+$/, 'must look like "mp1"'),
  text,
  marks: z.number().int().positive(),
  alternatives: z.array(text).default([]),
  reject: z.array(text).default([]),
});

/**
 * D49: numeric answers carry a tolerance band and independent method marks, and are
 * marked deterministically in the app — never by the model. Checking whether a number
 * falls inside a range is a comparison, not a language judgement.
 *
 * Refinement on doc 04's sketch: method marks are stored as *references* to ids in
 * `markScheme.points` rather than as duplicate mark-point objects. One source of truth,
 * so the method marks cannot drift away from the mark scheme they belong to. The
 * reference is checked in `markSchemeSchema` below.
 */
export const numericAnswerSchema = z
  .object({
    accept: z.object({ min: z.number(), max: z.number() }),
    /** Omit for dimensionless quantities — magnification is a ratio and takes no unit. */
    unit: z.string().trim().min(1).optional(),
    significantFigures: z.number().int().positive().optional(),
    /** Mark point ids awarded even when the final value misses the tolerance window. */
    methodPointIds: z.array(z.string()).default([]),
    /** Whether a wrong value carries forward into later steps without further penalty. */
    ecf: z.boolean().default(false),
  })
  .refine((n) => n.accept.min <= n.accept.max, {
    message: "accept.min must not exceed accept.max",
    path: ["accept"],
  });

export const markSchemeSchema = z
  .object({
    points: z.array(markPointSchema).min(1),
    guidance: text.optional(),
    ecfRules: text.optional(),
    /** Shown after marking. Never sent to the marker (doc 04). */
    modelAnswer: text.optional(),
    numericAnswer: numericAnswerSchema.optional(),
  })
  .superRefine((scheme, ctx) => {
    if (!scheme.numericAnswer) return;
    const known = new Set(scheme.points.map((point) => point.id));
    scheme.numericAnswer.methodPointIds.forEach((pointId, index) => {
      if (!known.has(pointId)) {
        ctx.addIssue({
          code: "custom",
          path: ["numericAnswer", "methodPointIds", index],
          message: `"${pointId}" is not a mark point on this question`,
        });
      }
    });
  });

const questionOptionSchema = z.object({ key: z.string().regex(/^[A-D]$/), text });

export const questionSchema = z
  .object({
    id,
    subjectId: id,
    primarySubTopicId: id,
    type: questionTypeSchema,
    tier: tierSchema.default("BOTH"),
    paper: z.union([z.literal(1), z.literal(2)]),
    marks: z.number().int().positive().max(6),
    commandWord: text,
    ao: aoSchema,
    difficulty: z.number().int().min(1).max(5),
    estSeconds: z.number().int().positive(),
    stem: text,
    assets: z
      .object({
        diagramId: id.optional(),
        /**
         * Structure keys on the referenced diagram to mark A, B, C… in order, for
         * exam-style "name the structure labelled B" questions. Checked against the
         * diagram registry at validate time, so a renamed structure breaks the build
         * rather than the question.
         */
        diagramLetters: z.array(z.string().min(1)).optional(),
        figureCaption: text.optional(),
        dataTable: z
          .object({ headers: z.array(text).min(1), rows: z.array(z.array(text)).min(1) })
          .optional(),
      })
      .optional(),
    options: z.array(questionOptionSchema).min(2).max(4).optional(),
    correctKey: z
      .string()
      .regex(/^[A-D]$/)
      .optional(),
    specPoints: z
      .array(z.object({ code: id, weight: z.number().positive().default(1) }))
      .min(1),
    /** Set when the question assesses a required practical. Checked against the registry. */
    practicalId: id.optional(),
    /**
     * Retired questions stay in the bank so past attempts still resolve, but are never
     * served again and are excluded from coverage. Meaning-changing edits get a new id
     * instead of mutating an existing one (doc 04).
     */
    retired: z.boolean().default(false),
    markScheme: markSchemeSchema,
  })
  .superRefine((question, ctx) => {
    // MCQs are marked deterministically, so they need options and a key that matches.
    if (question.type === "MCQ") {
      if (!question.options) {
        ctx.addIssue({ code: "custom", path: ["options"], message: "MCQ requires options" });
      }
      if (!question.correctKey) {
        ctx.addIssue({
          code: "custom",
          path: ["correctKey"],
          message: "MCQ requires a correctKey",
        });
      }
      if (
        question.options &&
        question.correctKey &&
        !question.options.some((option) => option.key === question.correctKey)
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["correctKey"],
          message: `correctKey "${question.correctKey}" is not one of the options`,
        });
      }
    } else if (question.options) {
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: `options are only valid on MCQ, not ${question.type}`,
      });
    }

    // The mark points must add up to the marks on offer, or the student is told they
    // scored 3/4 on a question where only 3 marks were ever available.
    const pointTotal = question.markScheme.points.reduce((sum, p) => sum + p.marks, 0);
    if (pointTotal !== question.marks) {
      ctx.addIssue({
        code: "custom",
        path: ["markScheme", "points"],
        message: `mark points total ${pointTotal} but the question is worth ${question.marks}`,
      });
    }

    const pointIds = question.markScheme.points.map((p) => p.id);
    if (new Set(pointIds).size !== pointIds.length) {
      ctx.addIssue({
        code: "custom",
        path: ["markScheme", "points"],
        message: "mark point ids must be unique",
      });
    }

    if (question.type === "PRACTICAL" && !question.practicalId) {
      ctx.addIssue({
        code: "custom",
        path: ["practicalId"],
        message: "PRACTICAL questions must name the required practical they assess",
      });
    }

    if (question.assets?.diagramLetters && !question.assets.diagramId) {
      ctx.addIssue({
        code: "custom",
        path: ["assets", "diagramLetters"],
        message: "diagramLetters needs a diagramId to letter",
      });
    }

    // A numeric answer is the deterministic path; it only makes sense where a number
    // is actually being asked for.
    if (
      question.markScheme.numericAnswer &&
      question.type !== "CALCULATION" &&
      question.type !== "DATA_RESPONSE" &&
      question.type !== "SHORT"
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["markScheme", "numericAnswer"],
        message: `numericAnswer is not meaningful on a ${question.type} question`,
      });
    }
  });

// ---------------------------------------------------------------------------
// Blurt prompts
// ---------------------------------------------------------------------------

export const blurtPromptSchema = z.object({
  id,
  subTopicId: id,
  prompt: text,
  expectedPoints: z
    .array(
      z.object({
        id: z.string().regex(/^ep\d+$/, 'must look like "ep1"'),
        idea: text,
        aliases: z.array(text).default([]),
        essential: z.boolean().default(false),
      }),
    )
    .min(3)
    .max(10),
  tier: tierSchema.default("BOTH"),
  estMinutes: z.number().int().positive().max(20).default(4),
});

// ---------------------------------------------------------------------------
// Required practicals
// ---------------------------------------------------------------------------

/**
 * The fault table (D50). Authored here as content data in Phase 3; the simulation that
 * renders it arrives in Phase 4b. One source, so the questions and the simulation cannot
 * drift apart.
 */
export const practicalFaultSchema = z.object({
  id,
  /** The mistake, in the student's terms. */
  trigger: text,
  /** What they see happen as a result. */
  effect: text,
  /** Why the correct technique exists — this is what the exam asks for. */
  reason: text,
  /** Question ids that assess this fault. Checked against the real bank at validate time. */
  questionIds: z.array(id).default([]),
  /** Whether the run cannot continue (e.g. a cracked slide). */
  fatal: z.boolean().default(false),
});

export const practicalSchema = z.object({
  id,
  subjectId: id,
  number: z.number().int().positive(),
  title: text,
  /** The requirement as AQA words it. */
  requirement: text,
  aim: text,
  apparatus: z.array(text).min(1),
  method: z
    .array(z.object({ n: z.number().int().positive(), text, why: text.optional() }))
    .min(1),
  safety: z.array(text).min(1),
  faults: z.array(practicalFaultSchema).min(1),
  subTopicIds: z.array(id).min(1),
  atSkills: z.array(atSkill).min(1),
  coverage: coverageSchema.default("FULL"),
  blockedBy: z.array(z.string().trim().min(1)).default([]),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Two families of type here, and the distinction matters.
 *
 * `*Def` types are zod **output** types: every default has been applied, so `recap`,
 * `retired`, `tier` and friends are always present. These are what the validator, the
 * seeder and the app work with.
 *
 * `*Input` types are zod **input** types: fields with defaults are optional. Content
 * files are authored against these, so an author does not have to write
 * `recap: false, retired: false, alternatives: []` on every object just to satisfy the
 * compiler. Parsing turns an Input into a Def.
 */
export type TaxonomyInput = z.input<typeof taxonomySchema>;
export type LessonInput = z.input<typeof lessonSchema>;
export type NotesPageInput = z.input<typeof notesPageSchema>;
export type QuestionInput = z.input<typeof questionSchema>;
export type BlurtPromptInput = z.input<typeof blurtPromptSchema>;
export type PracticalInput = z.input<typeof practicalSchema>;

export type SpecPointDef = z.infer<typeof specPointSchema>;
export type SubTopicDef = z.infer<typeof subTopicSchema>;
export type TaxonomyDef = z.infer<typeof taxonomySchema>;
export type LessonBlock = z.infer<typeof lessonBlockSchema>;
export type LessonDef = z.infer<typeof lessonSchema>;
export type NoteSectionDef = z.infer<typeof noteSectionSchema>;
export type NotesPageDef = z.infer<typeof notesPageSchema>;
export type MarkPoint = z.infer<typeof markPointSchema>;
export type NumericAnswer = z.infer<typeof numericAnswerSchema>;
export type MarkSchemeDef = z.infer<typeof markSchemeSchema>;
export type QuestionDef = z.infer<typeof questionSchema>;
export type BlurtPromptDef = z.infer<typeof blurtPromptSchema>;
export type PracticalFault = z.infer<typeof practicalFaultSchema>;
export type PracticalDef = z.infer<typeof practicalSchema>;
