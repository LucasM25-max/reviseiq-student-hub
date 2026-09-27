/**
 * Config schemas for the four generic widget engines (D40).
 *
 * Phase 3 registered widget ids and left `config` as an untyped bag, which was enough to
 * catch a typo'd `widgetId` but let a malformed config through to the renderer. Phase 4
 * builds the engines, so each one now declares the exact shape it consumes and
 * `npm run content:validate` checks authored configs against it.
 *
 * These are plain zod schemas with no React and no database import, so the validator, the
 * seeder and the unit tests can all use them from a bare Node script.
 */
import { z } from "zod";

const text = z.string().trim().min(1);
const id = z
  .string()
  .trim()
  .regex(/^[a-z0-9][a-z0-9-]*$/, "ids are lower-case, digits and hyphens");

// ---------------------------------------------------------------------------
// label-the-diagram
// ---------------------------------------------------------------------------

/**
 * `recall-first` puts the widget *before* the teaching, so the student finds out what
 * they do not know while it still costs nothing. `reinforce` places it after, as
 * practice. The two differ only in the framing copy, but the distinction matters enough
 * pedagogically to be explicit in the content rather than inferred from position.
 */
export const labelTheDiagramConfigSchema = z.object({
  diagramId: id,
  mode: z.enum(["recall-first", "reinforce"]).default("reinforce"),
  prompt: text.optional(),
  /**
   * Structure keys to ask about, in the order the letters are assigned. Omit to ask
   * about every structure on the diagram.
   */
  structures: z.array(id).min(2).optional(),
});

// ---------------------------------------------------------------------------
// comparison-table
// ---------------------------------------------------------------------------

export const comparisonTableRowSchema = z.object({
  label: text,
  /** One boolean per column, in column order. Length is checked against `columns`. */
  answers: z.array(z.boolean()).min(2),
  /** Shown with the feedback. The place to put the hedge a tick box cannot express. */
  note: text.optional(),
});

export const comparisonTableConfigSchema = z
  .object({
    mode: z.literal("fill-in").default("fill-in"),
    instruction: text.optional(),
    /** The thing being compared, e.g. the row heading for the first column. */
    rowHeading: text.default("Feature"),
    columns: z.array(text).min(2).max(4),
    rows: z.array(comparisonTableRowSchema).min(2),
  })
  .superRefine((config, ctx) => {
    config.rows.forEach((row, index) => {
      if (row.answers.length !== config.columns.length) {
        ctx.addIssue({
          code: "custom",
          path: ["rows", index, "answers"],
          message: `expected ${config.columns.length} answers to match the columns, got ${row.answers.length}`,
        });
      }
    });

    const labels = config.rows.map((row) => row.label);
    if (new Set(labels).size !== labels.length) {
      ctx.addIssue({ code: "custom", path: ["rows"], message: "row labels must be unique" });
    }

    const columns = config.columns;
    if (new Set(columns).size !== columns.length) {
      ctx.addIssue({ code: "custom", path: ["columns"], message: "columns must be unique" });
    }
  });

// ---------------------------------------------------------------------------
// scale-explorer
// ---------------------------------------------------------------------------

export const scaleLevelSchema = z.object({
  label: text,
  /** Human-readable size, e.g. "10–100 µm". Deliberately a string: some levels are ranges. */
  size: text,
  note: text.optional(),
});

export const scaleExplorerConfigSchema = z.object({
  /** `nested` reads as a containment ladder: each level sits inside the one before it. */
  mode: z.literal("nested").default("nested"),
  instruction: text.optional(),
  /**
   * A reference diagram shown alongside the ladder. It is context, not a driver — its
   * structures do not have to correspond to the levels, because a containment ladder and
   * a logarithmic size strip are different views of the same idea.
   */
  diagramId: id.optional(),
  levels: z.array(scaleLevelSchema).min(2),
});

// ---------------------------------------------------------------------------
// card-sort
// ---------------------------------------------------------------------------

export const cardSortPairSchema = z.object({
  left: text,
  right: text,
});

export const cardSortConfigSchema = z
  .object({
    instruction: text,
    leftHeading: text.default("Structure"),
    rightHeading: text.default("Function"),
    pairs: z.array(cardSortPairSchema).min(3),
  })
  .superRefine((config, ctx) => {
    const lefts = config.pairs.map((pair) => pair.left);
    if (new Set(lefts).size !== lefts.length) {
      ctx.addIssue({ code: "custom", path: ["pairs"], message: "left cards must be unique" });
    }

    // Two identical right-hand cards would make one of the matches genuinely ambiguous,
    // and the student would be marked wrong for an answer that is defensible.
    const rights = config.pairs.map((pair) => pair.right);
    if (new Set(rights).size !== rights.length) {
      ctx.addIssue({ code: "custom", path: ["pairs"], message: "right cards must be unique" });
    }
  });

// ---------------------------------------------------------------------------
// microscope-practical
// ---------------------------------------------------------------------------

/**
 * The Required practical 1 simulation.
 *
 * The config names the practical rather than restating it: the method, the fault table
 * and the safety notes all live in the practical definition, and the engine reads them
 * from there (D50). Duplicating them here would create a second copy to drift.
 *
 * `phases` exists so a lesson can run part of the practical — the drawing conventions
 * alone, say — without the whole bench.
 */
export const microscopePracticalConfigSchema = z.object({
  /** The practical whose method and fault table drive the simulation. */
  practicalId: id,
  specimen: z.literal("onion-epidermis"),
  phases: z
    .array(z.enum(["prepare", "find", "draw", "measure"]))
    .min(1)
    .default(["prepare", "find", "draw", "measure"]),
  /**
   * `freehand` gives a drawing canvas; `guided-labelling` places labels on a supplied
   * outline instead. The second is the equal-credit alternative for anyone who cannot
   * draw with a pointer (D48), so it is a config option and not a hidden fallback.
   */
  drawing: z.enum(["freehand", "guided-labelling"]).default("freehand"),
  instruction: text.optional(),
});

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/** Engines that exist. */
export const WIDGET_CONFIG_SCHEMAS = {
  "label-the-diagram": labelTheDiagramConfigSchema,
  "comparison-table": comparisonTableConfigSchema,
  "scale-explorer": scaleExplorerConfigSchema,
  "card-sort": cardSortConfigSchema,
  "microscope-practical": microscopePracticalConfigSchema,
} as const;

export type BuiltWidgetId = keyof typeof WIDGET_CONFIG_SCHEMAS;

export type LabelTheDiagramConfig = z.output<typeof labelTheDiagramConfigSchema>;
export type ComparisonTableConfig = z.output<typeof comparisonTableConfigSchema>;
export type ScaleExplorerConfig = z.output<typeof scaleExplorerConfigSchema>;
export type CardSortConfig = z.output<typeof cardSortConfigSchema>;
export type MicroscopePracticalConfig = z.output<typeof microscopePracticalConfigSchema>;

export type WidgetConfigFor<Id extends BuiltWidgetId> = z.output<
  (typeof WIDGET_CONFIG_SCHEMAS)[Id]
>;

export const isBuiltWidget = (widgetId: string): widgetId is BuiltWidgetId =>
  widgetId in WIDGET_CONFIG_SCHEMAS;

/**
 * Parses an authored config for a built engine.
 *
 * Returns a discriminated result rather than throwing: the validator wants to collect
 * every problem in the content at once, and the renderer wants to degrade to a visible
 * note instead of taking the page down.
 */
export function parseWidgetConfig(
  widgetId: string,
  config: unknown,
):
  | { ok: true; widgetId: BuiltWidgetId; config: WidgetConfigFor<BuiltWidgetId> }
  | { ok: false; issues: { path: string; message: string }[] } {
  if (!isBuiltWidget(widgetId)) {
    return {
      ok: false,
      issues: [{ path: "", message: `no engine for widget "${widgetId}"` }],
    };
  }

  const parsed = WIDGET_CONFIG_SCHEMAS[widgetId].safeParse(config);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    };
  }

  return { ok: true, widgetId, config: parsed.data as WidgetConfigFor<BuiltWidgetId> };
}
