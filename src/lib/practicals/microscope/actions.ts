/**
 * Everything a student can do at the bench, one variant per AQA student-sheet step.
 *
 * The union is deliberately 1:1 with the printed method. That is what lets the rubric
 * mark a *method trace* — if the actions were a convenient abstraction over the method
 * rather than a transcription of it, "did they blot the slide" would not be answerable
 * from the log, and the whole assessable artefact would be guesswork.
 */
import type {
  CoverslipMethod,
  Point,
  Stroke,
  Surface,
  TotalMagnification,
  Viewing,
} from "./state";

export type MicroscopeAction =
  // ── A. Prepare the slide (steps 1–9) ──
  | { t: "wearGoggles" }
  | { t: "pipetteWater" }
  | { t: "peelEpidermis"; surface: Surface }
  | { t: "placeSpecimen" }
  | { t: "flattenSpecimen" }
  | { t: "addStain"; drops: number }
  | { t: "placeCoverslip"; method: CoverslipMethod }
  | { t: "blotExcess" }
  | { t: "mountSlide" }
  // ── B. Find the cells (steps 10–15) ──
  | { t: "selectObjective"; total: TotalMagnification }
  | { t: "coarseFocus"; delta: number; viewing: Viewing }
  | { t: "fineFocus"; delta: number }
  | { t: "setIris"; value: number }
  | { t: "panStage"; dx: number; dy: number }
  // ── C. Draw and label (step 16) ──
  | { t: "drawStroke"; stroke: Stroke }
  | { t: "undoStroke" }
  | { t: "placeLabel"; id: string; at: Point; target: Point }
  | { t: "removeLabel"; id: string }
  // ── D. Measure (steps 17–20) ──
  | { t: "calibrateGraticule"; divisions: number; micrometres: number }
  | { t: "readGraticule"; divisions: number }
  | { t: "measureDrawing"; lengthMm: number }
  | { t: "submitMagnification"; value: number }
  // ── Recovery ──
  | { t: "freshSlide" };

export type ActionType = MicroscopeAction["t"];

/** The four phases of the practical, in the order the student sheet runs. */
export type Phase = "prepare" | "find" | "draw" | "measure";

export const PHASE_OF: Record<ActionType, Phase | "recovery"> = {
  wearGoggles: "prepare",
  pipetteWater: "prepare",
  peelEpidermis: "prepare",
  placeSpecimen: "prepare",
  flattenSpecimen: "prepare",
  addStain: "prepare",
  placeCoverslip: "prepare",
  blotExcess: "prepare",
  mountSlide: "prepare",
  selectObjective: "find",
  coarseFocus: "find",
  fineFocus: "find",
  setIris: "find",
  panStage: "find",
  drawStroke: "draw",
  undoStroke: "draw",
  placeLabel: "draw",
  removeLabel: "draw",
  calibrateGraticule: "measure",
  readGraticule: "measure",
  measureDrawing: "measure",
  submitMagnification: "measure",
  freshSlide: "recovery",
};

/**
 * Short, plain descriptions used by the trace view and the screen-reader live region.
 *
 * Written the way a lab partner would narrate it, because that is what a student
 * reading their own method trace needs — not a serialised action name.
 */
export function describeAction(action: MicroscopeAction): string {
  switch (action.t) {
    case "wearGoggles":
      return "Put on eye protection";
    case "pipetteWater":
      return "Placed a drop of water on the slide";
    case "peelEpidermis":
      return `Peeled epidermis from the ${action.surface} surface`;
    case "placeSpecimen":
      return "Placed the epidermis on the slide";
    case "flattenSpecimen":
      return "Unfolded the epidermis so it lay flat";
    case "addStain":
      return action.drops === 0
        ? "Added no iodine solution"
        : `Added ${action.drops} drop${action.drops === 1 ? "" : "s"} of iodine solution`;
    case "placeCoverslip":
      return action.method === "lowerWithNeedle"
        ? "Lowered the coverslip from one edge with a mounted needle"
        : "Dropped the coverslip flat onto the specimen";
    case "blotExcess":
      return "Blotted the excess liquid";
    case "mountSlide":
      return "Put the slide on the stage";
    case "selectObjective":
      return `Switched to the ×${action.total / 10} objective (×${action.total} total)`;
    case "coarseFocus":
      return `Turned the coarse focus ${action.delta < 0 ? "down" : "up"} while looking ${
        action.viewing === "side" ? "from the side" : "down the eyepiece"
      }`;
    case "fineFocus":
      return `Adjusted the fine focus ${action.delta < 0 ? "down" : "up"}`;
    case "setIris":
      return `Set the iris to ${Math.round(action.value * 100)}%`;
    case "panStage":
      return "Moved the stage";
    case "drawStroke":
      return "Drew a line";
    case "undoStroke":
      return "Undid the last line";
    case "placeLabel":
      return `Labelled the ${action.id.replace(/-/g, " ")}`;
    case "removeLabel":
      return "Removed a label";
    case "calibrateGraticule":
      return `Calibrated: ${action.divisions} divisions measured ${action.micrometres} µm`;
    case "readGraticule":
      return `Read the cell as ${action.divisions} graticule divisions`;
    case "measureDrawing":
      return `Measured the drawing at ${action.lengthMm} mm`;
    case "submitMagnification":
      return `Stated the drawing's magnification as ×${action.value}`;
    case "freshSlide":
      return "Started again with a fresh slide";
    default: {
      const never: never = action;
      void never;
      return "Did something";
    }
  }
}
