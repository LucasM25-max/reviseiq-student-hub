/**
 * How each step of AQA's student sheet is performed in the simulation.
 *
 * The method lives in `content/biology/practicals/rp-1-microscopy.ts` and this maps it,
 * step by step, onto the actions the bench accepts. It exists so the claim "every step
 * of the practical is performable" is a checked fact rather than an impression: a test
 * walks all twenty steps and fails if any of them has no way to be carried out.
 *
 * It also fails when a step is *added* to the content without anyone deciding how a
 * student would do it — which is the failure mode that would otherwise turn the
 * simulation into a slowly diverging retelling of the practical.
 */
import type { MicroscopeAction } from "./actions";

type ActionType = MicroscopeAction["t"];

export type MethodMapping = {
  /** Step number on the student sheet. */
  n: number;
  /**
   * The actions that carry the step out. Empty only for a step folded into another,
   * which must then say which one and why.
   */
  actions: ActionType[];
  /** Why this step has no action of its own. */
  foldedInto?: { step: number; reason: string };
};

export const METHOD_ACTIONS: MethodMapping[] = [
  { n: 1, actions: ["wearGoggles"] },
  { n: 2, actions: ["pipetteWater"] },
  {
    n: 3,
    actions: [],
    foldedInto: {
      step: 4,
      reason:
        "Cutting the square has no observable consequence and no fault attached to it — nothing about the slide afterwards differs according to how it was cut. It is carried out as part of peeling.",
    },
  },
  { n: 4, actions: ["peelEpidermis"] },
  { n: 5, actions: ["placeSpecimen", "flattenSpecimen"] },
  { n: 6, actions: ["addStain"] },
  { n: 7, actions: ["placeCoverslip"] },
  { n: 8, actions: ["blotExcess"] },
  { n: 9, actions: ["mountSlide"] },
  { n: 10, actions: ["selectObjective"] },
  { n: 11, actions: ["coarseFocus"] },
  { n: 12, actions: ["coarseFocus"] },
  { n: 13, actions: ["panStage"] },
  { n: 14, actions: ["selectObjective", "fineFocus"] },
  { n: 15, actions: ["selectObjective", "fineFocus"] },
  { n: 16, actions: ["drawStroke", "placeLabel"] },
  { n: 17, actions: ["readGraticule"] },
  { n: 18, actions: ["calibrateGraticule"] },
  { n: 19, actions: ["measureDrawing"] },
  { n: 20, actions: ["submitMagnification"] },
];

/** Steps that can be carried out directly. */
export const performableSteps = (): number[] =>
  METHOD_ACTIONS.filter((mapping) => mapping.actions.length > 0).map((mapping) => mapping.n);
