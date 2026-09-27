/**
 * Marking a method trace.
 *
 * Each point is worth exactly one mark and is independently awardable, matching the
 * rule the question bank already follows — so a student who does eight of the twelve
 * things right scores eight, and can see precisely which four they missed.
 *
 * Nothing here is a judgement call. Every point is decidable from the trace and the
 * final state, which is what lets the whole rubric be tested without a browser and
 * without a language model.
 */
import { drawingRubric, type DrawingRubricResult } from "./drawing";
import { activeFaultIds, type FaultId } from "./faults";
import { checkStatedMagnification, magnificationWorking } from "./graticule";
import type { BenchState } from "./state";
import { actionsOfType, didPerform, happenedBefore, type Run, type TraceEntry } from "./trace";

export type RubricPoint = {
  id: string;
  /** What the student had to do, phrased as the exam would ask for it. */
  text: string;
  awarded: boolean;
  /** Shown when the point is missed: why the step exists. */
  why: string;
  /** The fault this point guards against, if any. */
  fault?: FaultId;
};

export type RubricResult = {
  points: RubricPoint[];
  awarded: number;
  total: number;
  /** Faults that fired, in fault-table order. */
  faults: FaultId[];
  /** The drawing is marked separately, and advisorily (D47). */
  drawing: DrawingRubricResult;
  restarts: number;
};

/** Iodine drops that count as correctly stained. */
const CORRECT_STAIN = { min: 1, max: 3 };

/**
 * Scores a run.
 *
 * `total` is fixed at the number of points, not at what the student attempted, so a
 * half-finished run scores out of the same denominator as a complete one. Marking
 * someone out of what they got round to would flatter an abandoned attempt.
 */
export function scoreRun(run: Run): RubricResult {
  const { state, trace } = run;
  const faults = activeFaultIds(state);
  const everFaulted = new Set<FaultId>([...faults, ...(state.historicFaults as FaultId[])]);
  const seen = (id: FaultId) => everFaulted.has(id) || traceEverHad(trace, id);

  const stainDrops = actionsOfType(trace, "addStain").reduce(
    (sum, action) => sum + Math.max(0, Math.round(action.drops)),
    0,
  );

  const points: RubricPoint[] = [
    {
      id: "goggles-first",
      text: "Put on eye protection before handling the iodine solution",
      awarded:
        didPerform(trace, "wearGoggles") &&
        (!didPerform(trace, "addStain") || happenedBefore(trace, "wearGoggles", "addStain")),
      why: "Iodine solution is an irritant and stains skin and clothing. A precaution taken after the risk has started is not a precaution.",
      fault: "no-goggles",
    },
    {
      id: "water-first",
      text: "Placed a drop of water on the slide before the specimen",
      awarded: happenedBefore(trace, "pipetteWater", "placeSpecimen"),
      why: "The water supports the specimen and stops the cells drying out and shrivelling.",
      fault: "dry-mount",
    },
    {
      id: "inner-epidermis",
      text: "Peeled the epidermis from the inner surface of the onion",
      awarded: actionsOfType(trace, "peelEpidermis").some(
        (action) => action.surface === "inner",
      ),
      why: "The inner epidermis peels away as a single layer of cells, thin enough for light to pass through.",
      fault: "too-thick",
    },
    {
      id: "flattened",
      text: "Laid the epidermis flat, with no folds",
      awarded: didPerform(trace, "flattenSpecimen"),
      why: "A folded specimen has cells at several depths, so they cannot all be in focus at once.",
      fault: "too-thick",
    },
    {
      id: "stained",
      text: "Added iodine solution to increase contrast, without over-staining",
      awarded: stainDrops >= CORRECT_STAIN.min && stainDrops <= CORRECT_STAIN.max,
      why: "Iodine stains the cell contents so structures can be told apart. Too much absorbs the light and nothing is resolvable.",
    },
    {
      id: "coverslip-lowered",
      text: "Lowered the coverslip from one edge with a mounted needle",
      awarded: actionsOfType(trace, "placeCoverslip").some(
        (action) => action.method === "lowerWithNeedle",
      ),
      why: "Lowering slowly from one edge pushes the air out ahead of the glass, so no bubbles are trapped.",
      fault: "air-bubbles",
    },
    {
      id: "blotted",
      text: "Blotted the excess liquid from around the coverslip",
      awarded: didPerform(trace, "blotExcess"),
      why: "Liquid spreading beyond the coverslip lets it float and drift, so the field will not stay still.",
      fault: "drifting-coverslip",
    },
    {
      id: "lowest-power-first",
      text: "Started the search on the lowest power objective",
      awarded: state.scope.firstObjectiveViewed === 40,
      why: "At ×40 the field is 4500 µm across and about fifteen cells are visible; at ×400 it is 450 µm and there is nothing to aim at.",
      fault: "lost-at-high-power",
    },
    {
      id: "focused-safely",
      text: "Racked the objective down while looking from the side, then focused upwards",
      awarded: !state.scope.blindDescent,
      why: "Focusing by increasing the gap means the lens can never be driven into the slide.",
      fault: "cracked-slide",
    },
    {
      id: "read-graticule",
      text: "Measured the cell against the eyepiece graticule",
      awarded: state.measurement.divisionsRead !== null && state.measurement.divisionsRead > 0,
      why: "The graticule is how a length is got out of the eyepiece at all.",
    },
    {
      id: "measured-drawing",
      text: "Measured the drawing itself",
      awarded: state.drawing.drawnLengthMm !== null && state.drawing.drawnLengthMm > 0,
      why: "The magnification of a drawing is its own length divided by the real length, so both have to be measured.",
    },
    {
      id: "magnification-correct",
      text: "Stated the magnification of the drawing, not of the microscope",
      awarded: magnificationCorrect(state),
      why: "×400 is what the microscope did. The number under the drawing is how many times larger the drawing is than the real cell, and it takes no unit.",
    },
  ];

  return {
    points,
    awarded: points.filter((point) => point.awarded).length,
    total: points.length,
    faults: [...everFaulted].filter((id) => seen(id)),
    drawing: drawingRubric(state.drawing),
    restarts: state.restarts,
  };
}

const traceEverHad = (trace: readonly TraceEntry[], id: FaultId): boolean =>
  trace.some((entry) => entry.faults.includes(id));

function magnificationCorrect(state: BenchState): boolean {
  const { divisionsRead, calibratedUmPerDivision } = state.measurement;
  const { drawnLengthMm, statedMagnification } = state.drawing;
  if (divisionsRead === null || drawnLengthMm === null || statedMagnification === null) {
    return false;
  }

  const working = magnificationWorking(
    divisionsRead,
    state.scope.objective,
    drawnLengthMm,
    calibratedUmPerDivision,
  );
  if (!working) return false;

  return checkStatedMagnification(statedMagnification, working).correct;
}

/** A one-line summary for the trace header. */
export function summarise(result: RubricResult): string {
  const faultCount = result.faults.length;
  return [
    `${result.awarded} of ${result.total} method marks`,
    faultCount === 0
      ? "no technique faults"
      : `${faultCount} technique fault${faultCount === 1 ? "" : "s"}`,
    result.restarts > 0
      ? `${result.restarts} fresh slide${result.restarts === 1 ? "" : "s"}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
