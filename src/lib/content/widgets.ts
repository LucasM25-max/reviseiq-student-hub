/**
 * Widget registry (D40 — widgets are generic, data-driven engines, never per-topic
 * components).
 *
 * The registry names every engine and records which roadmap phase builds it, so
 * `npm run content:validate` can reject a typo'd `widgetId` and the lesson renderer can
 * show an honest placeholder for an engine that does not exist yet rather than crashing
 * or silently dropping the block.
 *
 * Every engine is now built, so every `plannedPhase` is `null`. The field stays because
 * the next new widget will need it, and because a placeholder is a much better failure
 * than a blank space in a lesson.
 */

export type WidgetMeta = {
  id: string;
  title: string;
  /** What the engine does, once it exists. */
  description: string;
  /** The roadmap phase that builds it. `null` once it is built. */
  plannedPhase: string | null;
};

export const WIDGETS: WidgetMeta[] = [
  {
    id: "label-the-diagram",
    title: "Label the diagram",
    description:
      "Drag or type labels onto a registered SVG diagram, optionally from memory before the content is revealed.",
    plannedPhase: null,
  },
  {
    id: "comparison-table",
    title: "Comparison table",
    description: "Fill in a tick-or-cross grid comparing two or more things across named rows.",
    plannedPhase: null,
  },
  {
    id: "scale-explorer",
    title: "Scale explorer",
    description:
      "Zoom through nested levels of scale, or place objects on a logarithmic size axis.",
    plannedPhase: null,
  },
  {
    id: "card-sort",
    title: "Card sort",
    description: "Match cards from one column to cards in another, with immediate feedback.",
    plannedPhase: null,
  },
  {
    id: "microscope-practical",
    title: "Microscope practical",
    description:
      "The Required practical 1 simulation: prepare a slide, drive the microscope, draw and measure. Consumes the fault table from the practical definition (D50).",
    plannedPhase: null,
  },
];

const byId = new Map(WIDGETS.map((widget) => [widget.id, widget]));

export const getWidget = (id: string): WidgetMeta | undefined => byId.get(id);

export const widgetIds = (): string[] => WIDGETS.map((widget) => widget.id);
