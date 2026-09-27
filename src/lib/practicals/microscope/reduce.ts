/**
 * The bench, as a pure function of what has been done to it.
 *
 * Two rules hold everywhere in this file and are what make the rest of the engine
 * trustworthy:
 *
 * 1. **Mistakes are allowed to happen.** The reducer never refuses an action because it
 *    is bad technique. Dropping the coverslip flat, racking down blind, skipping the
 *    stain — all of these are accepted, and their consequences show up in the field of
 *    view. You chose consequences over warnings, and a reducer that quietly declined
 *    the wrong action would be a warning wearing a disguise.
 *
 * 2. **It only refuses the impossible.** You cannot blot a slide that has no coverslip,
 *    and you cannot focus a cracked slide. Those are not judgements about technique;
 *    they are things that cannot be done, and pretending otherwise would put the state
 *    somewhere the optics model cannot describe.
 */
import type { MicroscopeAction } from "./actions";
import { activeFaultIds } from "./faults";
import {
  freshScope,
  freshSlide,
  initialBench,
  type BenchState,
  type DrawingState,
  type MeasurementState,
  type ScopeState,
  type SlideState,
} from "./state";

/** Stage travel limits in micrometres. Far enough to lose focus, not infinite. */
export const STAGE_MIN = -400;
export const STAGE_MAX = 120;

/** How far the stage may be panned from centre before the specimen leaves the field. */
export const PAN_LIMIT_UM = 4000;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** Guards against NaN and Infinity arriving from a slider or a parsed input. */
const finite = (value: number, fallback = 0) => (Number.isFinite(value) ? value : fallback);

/**
 * Whether an action is physically possible right now.
 *
 * Deliberately permissive: this answers "can this happen at all", not "is this wise".
 * Everything it rejects is something with no coherent state on the other side.
 */
export function isPossible(state: BenchState, action: MicroscopeAction): boolean {
  // A cracked slide stops everything except starting again.
  if (state.ended !== null) return action.t === "freshSlide";

  switch (action.t) {
    case "placeSpecimen":
      // Nothing to place until something has been peeled, and it only goes on once.
      return state.peel !== null && state.slide.specimen === null && state.slide.present;
    case "flattenSpecimen":
      return state.slide.specimen !== null && !state.slide.specimen.flattened;
    case "addStain":
      // Stain goes on the open mount. Once the coverslip is down it is too late.
      return state.slide.specimen !== null && state.slide.coverslip === null;
    case "placeCoverslip":
      return state.slide.specimen !== null && state.slide.coverslip === null;
    case "blotExcess":
      return state.slide.coverslip !== null;
    case "mountSlide":
      return state.slide.coverslip !== null && !state.slide.mounted;
    case "pipetteWater":
      // Water goes down before the specimen; adding it afterwards floods the mount.
      return !state.slide.water && state.slide.specimen === null;
    case "peelEpidermis":
      // One peel at a time, and not once a specimen is already mounted.
      return state.peel === null && state.slide.specimen === null;
    case "coarseFocus":
    case "fineFocus":
    case "panStage":
    case "readGraticule":
      return state.slide.mounted;
    case "drawStroke":
    case "undoStroke":
    case "placeLabel":
    case "removeLabel":
      // You can only draw what you can see.
      return state.slide.mounted;
    default:
      return true;
  }
}

function reduceSlide(
  state: BenchState,
  action: MicroscopeAction,
  goggles: boolean,
): SlideState {
  const { slide } = state;

  switch (action.t) {
    case "pipetteWater":
      return { ...slide, water: true };
    case "peelEpidermis":
      // Peeling does not put it on the slide; `placeSpecimen` does. Keeping them apart
      // is what makes "placed on a dry slide" observable.
      return slide;
    case "placeSpecimen":
      return state.peel
        ? { ...slide, specimen: { surface: state.peel.surface, flattened: false } }
        : slide;
    case "flattenSpecimen":
      return slide.specimen
        ? { ...slide, specimen: { ...slide.specimen, flattened: true } }
        : slide;
    case "addStain": {
      const drops = clamp(Math.round(finite(action.drops)), 0, 10);
      return {
        ...slide,
        stainDrops: slide.stainDrops + drops,
        // Recorded at the moment of exposure. Putting goggles on later does not undo it.
        stainedBeforeGoggles: slide.stainedBeforeGoggles || (drops > 0 && !goggles),
      };
    }
    case "placeCoverslip":
      return { ...slide, coverslip: action.method };
    case "blotExcess":
      return { ...slide, blotted: true };
    case "mountSlide":
      return { ...slide, mounted: true };
    default:
      return slide;
  }
}

/** The peel travels from the onion, into the forceps, onto the slide. */
function reducePeel(state: BenchState, action: MicroscopeAction): BenchState["peel"] {
  switch (action.t) {
    case "peelEpidermis":
      return { surface: action.surface };
    case "placeSpecimen":
      return null;
    default:
      return state.peel;
  }
}

function reduceScope(
  scope: ScopeState,
  action: MicroscopeAction,
  mounted: boolean,
): ScopeState {
  switch (action.t) {
    case "selectObjective":
      return {
        ...scope,
        objective: action.total,
        // Switching lenses while a slide is on the stage counts as viewing through it.
        firstObjectiveViewed: scope.firstObjectiveViewed ?? (mounted ? action.total : null),
      };
    case "coarseFocus": {
      const delta = finite(action.delta);
      return {
        ...scope,
        stageHeight: clamp(scope.stageHeight + delta, STAGE_MIN, STAGE_MAX),
        firstObjectiveViewed: scope.firstObjectiveViewed ?? (mounted ? scope.objective : null),
        // Racking *down* while looking through the eyepiece is the blind descent that
        // drives the objective into the slide. Upwards is safe — that is the whole
        // point of AQA step 13.
        blindDescent: scope.blindDescent || (delta < 0 && action.viewing === "eyepiece"),
      };
    }
    case "fineFocus":
      return {
        ...scope,
        stageHeight: clamp(scope.stageHeight + finite(action.delta), STAGE_MIN, STAGE_MAX),
        firstObjectiveViewed: scope.firstObjectiveViewed ?? (mounted ? scope.objective : null),
      };
    case "setIris":
      return { ...scope, iris: clamp(finite(action.value, scope.iris), 0, 1) };
    case "panStage":
      return {
        ...scope,
        panX: clamp(scope.panX + finite(action.dx), -PAN_LIMIT_UM, PAN_LIMIT_UM),
        panY: clamp(scope.panY + finite(action.dy), -PAN_LIMIT_UM, PAN_LIMIT_UM),
      };
    default:
      return scope;
  }
}

function reduceDrawing(drawing: DrawingState, action: MicroscopeAction): DrawingState {
  switch (action.t) {
    case "drawStroke": {
      const points = action.stroke.points.filter(
        (point) => Number.isFinite(point.x) && Number.isFinite(point.y),
      );
      // A stroke of one point is a stray tap, not a line.
      if (points.length < 2) return drawing;
      return { ...drawing, strokes: [...drawing.strokes, { points }] };
    }
    case "undoStroke":
      return { ...drawing, strokes: drawing.strokes.slice(0, -1) };
    case "placeLabel":
      return {
        ...drawing,
        labels: [
          ...drawing.labels.filter((label) => label.id !== action.id),
          { id: action.id, at: action.at, target: action.target },
        ],
      };
    case "removeLabel":
      return { ...drawing, labels: drawing.labels.filter((label) => label.id !== action.id) };
    case "measureDrawing":
      return { ...drawing, drawnLengthMm: Math.max(0, finite(action.lengthMm)) };
    case "submitMagnification":
      return { ...drawing, statedMagnification: finite(action.value) };
    default:
      return drawing;
  }
}

function reduceMeasurement(
  measurement: MeasurementState,
  action: MicroscopeAction,
): MeasurementState {
  switch (action.t) {
    case "calibrateGraticule": {
      const divisions = finite(action.divisions);
      const micrometres = finite(action.micrometres);
      if (divisions <= 0 || micrometres <= 0) return measurement;
      return { ...measurement, calibratedUmPerDivision: micrometres / divisions };
    }
    case "readGraticule":
      return { ...measurement, divisionsRead: Math.max(0, finite(action.divisions)) };
    default:
      return measurement;
  }
}

/**
 * Applies one action.
 *
 * Returns the state unchanged — by identity — when the action is impossible, so a
 * caller can cheaply tell whether anything happened.
 */
export function reduce(state: BenchState, action: MicroscopeAction): BenchState {
  if (!isPossible(state, action)) return state;

  if (action.t === "freshSlide") {
    // A restart is honest, not a reset. The faults already earned are carried forward,
    // the count is kept, and the drawing and measurements survive — on the real bench
    // you would not un-see what you had already drawn.
    return {
      ...state,
      slide: freshSlide(),
      scope: freshScope(),
      ended: null,
      restarts: state.restarts + 1,
      historicFaults: Array.from(new Set([...state.historicFaults, ...activeFaultIds(state)])),
    };
  }

  const goggles = state.goggles || action.t === "wearGoggles";

  const next: BenchState = {
    ...state,
    goggles,
    peel: reducePeel(state, action),
    slide: reduceSlide(state, action, goggles),
    scope: reduceScope(state.scope, action, state.slide.mounted),
    drawing: reduceDrawing(state.drawing, action),
    measurement: reduceMeasurement(state.measurement, action),
  };

  // The slide cracks the instant the blind descent actually reaches it, not merely
  // because the student turned the wrong knob the wrong way with their eye down.
  const cracked =
    next.scope.blindDescent && next.slide.mounted && next.scope.stageHeight >= CRACK_HEIGHT;

  return cracked ? { ...next, ended: "cracked-slide" } : next;
}

/**
 * Stage height at which a blind descent drives the objective into the coverslip.
 *
 * Above the focal plane rather than at it: the lens meets glass slightly before the
 * specimen would be sharp, which is exactly why focusing upwards is safe.
 */
export const CRACK_HEIGHT = 60;

/** Applies a whole trace from the initial bench. Useful for fixtures and for the rubric. */
export function reduceAll(
  actions: readonly MicroscopeAction[],
  from: BenchState = initialBench(),
): BenchState {
  return actions.reduce<BenchState>((state, action) => reduce(state, action), from);
}
