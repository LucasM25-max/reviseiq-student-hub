/**
 * Widget registry (D40 — widgets are generic, data-driven engines, never per-topic
 * components).
 *
 * Phase 3 registers the ids and records which phase builds each engine. That is enough
 * for `npm run content:validate` to reject a typo'd `widgetId` today, and for the lesson
 * renderer to show an honest placeholder for an engine that has not been built yet
 * rather than crashing or silently dropping the block.
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
    plannedPhase: "Phase 4",
  },
  {
    id: "comparison-table",
    title: "Comparison table",
    description: "Fill in a tick-or-cross grid comparing two or more things across named rows.",
    plannedPhase: "Phase 4",
  },
  {
    id: "scale-explorer",
    title: "Scale explorer",
    description:
      "Zoom through nested levels of scale, or place objects on a logarithmic size axis.",
    plannedPhase: "Phase 4",
  },
  {
    id: "card-sort",
    title: "Card sort",
    description: "Match cards from one column to cards in another, with immediate feedback.",
    plannedPhase: "Phase 4",
  },
  {
    id: "microscope-practical",
    title: "Microscope practical",
    description:
      "The Required practical 1 simulation: prepare a slide, drive the microscope, draw and measure. Consumes the fault table from the practical definition (D50).",
    plannedPhase: "Phase 4b",
  },
];

const byId = new Map(WIDGETS.map((widget) => [widget.id, widget]));

export const getWidget = (id: string): WidgetMeta | undefined => byId.get(id);

export const widgetIds = (): string[] => WIDGETS.map((widget) => widget.id);
