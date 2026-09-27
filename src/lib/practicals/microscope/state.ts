/**
 * Required practical 1 — the bench, the slide and the microscope, as plain data.
 *
 * Everything the simulation knows lives in one serialisable object. Nothing here is a
 * fault, a score or a rendering decision: those are all *derived* (see `faults.ts`,
 * `rubric.ts`, `optics.ts`). Keeping the state to bare facts is what makes the derived
 * layers testable without a browser (D46) and what stops the same truth being stored
 * twice and drifting.
 *
 * The one subtlety: some faults are about *history*, not the current arrangement —
 * racking down blind cracks the slide even though nothing about the slide afterwards
 * records how it broke. Those get an explicit boolean here recording the event, and the
 * fault is still derived from it. The rule is "no fault is stored", not "no history is".
 */

/** Which side of the onion square the epidermis was peeled from. */
export type Surface = "inner" | "outer";

/** How the coverslip was put on. */
export type CoverslipMethod = "drop" | "lowerWithNeedle";

/** Total magnification: a ×10 eyepiece against a ×4, ×10 or ×40 objective. */
export type TotalMagnification = 40 | 100 | 400;

/** Where the student's eye is while they turn the coarse focus. */
export type Viewing = "side" | "eyepiece";

export const OBJECTIVES: readonly TotalMagnification[] = [40, 100, 400] as const;

/** The objective lens alone, which is what the field-of-view maths uses. */
export const objectiveOf = (total: TotalMagnification): 4 | 10 | 40 =>
  (total / 10) as 4 | 10 | 40;

export type SlideState = {
  /** A clean slide is on the bench. False only before the first one is taken. */
  present: boolean;
  /** A drop of water has been placed. */
  water: boolean;
  /** The epidermis, once peeled and placed. */
  specimen: { surface: Surface; flattened: boolean } | null;
  /** Drops of iodine solution. Two is right; zero and four or more are faults. */
  stainDrops: number;
  coverslip: CoverslipMethod | null;
  /** Excess liquid blotted from around the coverslip. */
  blotted: boolean;
  /** The slide is on the stage and can be viewed. */
  mounted: boolean;
  /**
   * Iodine went on before eye protection. Recorded at the moment it happens: putting
   * the goggles on afterwards does not undo having handled a stain without them.
   */
  stainedBeforeGoggles: boolean;
};

export type ScopeState = {
  objective: TotalMagnification;
  /**
   * Height of the stage in micrometres against an arbitrary datum. The specimen sits at
   * 0, so this doubles as the focus error.
   */
  stageHeight: number;
  /** Condenser iris, 0 (shut) to 1 (open). Around 0.6 is right for a stained mount. */
  iris: number;
  /** Stage position in micrometres from the centre of the specimen. */
  panX: number;
  panY: number;
  /**
   * The objective the student first looked down. Anything but ×40 total means they
   * skipped the low-power search, which is the `lost-at-high-power` fault.
   */
  firstObjectiveViewed: TotalMagnification | null;
  /**
   * They turned the coarse focus *downwards* while looking through the eyepiece — the
   * blind descent AQA step 12 exists to prevent. This is what cracks the slide.
   */
  blindDescent: boolean;
};

export type Point = { x: number; y: number };

/** One freehand stroke, captured as points rather than pixels (D47). */
export type Stroke = { points: Point[] };

/** A label the student has placed, with the line from text to structure. */
export type PlacedLabel = { id: string; at: Point; target: Point };

export type DrawingState = {
  strokes: Stroke[];
  labels: PlacedLabel[];
  /** The magnification written under the drawing. Null until they state one. */
  statedMagnification: number | null;
  /** The drawing's own length in millimetres, as measured on screen. */
  drawnLengthMm: number | null;
};

export type MeasurementState = {
  /** Eyepiece graticule divisions the cell spans, as read by the student. */
  divisionsRead: number | null;
  /** Micrometres per division, if they calibrated against the stage micrometer. */
  calibratedUmPerDivision: number | null;
};

/** Why a run ended. Only the cracked slide ends one. */
export type RunEnd = "cracked-slide";

export type BenchState = {
  goggles: boolean;
  /**
   * The peel held in the forceps, before it reaches the slide.
   *
   * Peeling and placing are separate because the gap between them is where the water
   * is supposed to go. Collapsing them would make "placed on a dry slide" unobservable
   * and would fire `dry-mount` the moment the onion was touched.
   */
  peel: { surface: Surface } | null;
  slide: SlideState;
  scope: ScopeState;
  drawing: DrawingState;
  measurement: MeasurementState;
  /** Non-null once the run is over and only a fresh slide can continue it. */
  ended: RunEnd | null;
  /** How many times a fresh slide was started. On the real bench this costs you too. */
  restarts: number;
  /** Faults from earlier attempts, kept so a restart cannot launder a mistake. */
  historicFaults: string[];
};

/**
 * A slide as it comes out of the box.
 *
 * `present` starts true — there is a slide on the bench — but nothing has been done to
 * it. The distinction matters for `dry-mount`: placing a specimen on a dry slide is a
 * fault, and that is only detectable if "has water" and "has a slide" are separate.
 */
export const freshSlide = (): SlideState => ({
  present: true,
  water: false,
  specimen: null,
  stainDrops: 0,
  coverslip: null,
  blotted: false,
  mounted: false,
  stainedBeforeGoggles: false,
});

/**
 * The microscope as the previous class left it: lowest power, stage racked well down,
 * iris part open. Starting at ×40 is not a gift — the student still has to *view*
 * through it before switching up, and `firstObjectiveViewed` records whether they did.
 */
export const freshScope = (): ScopeState => ({
  objective: 40,
  stageHeight: -400,
  iris: 0.6,
  panX: 0,
  panY: 0,
  firstObjectiveViewed: null,
  blindDescent: false,
});

export const initialBench = (): BenchState => ({
  goggles: false,
  peel: null,
  slide: freshSlide(),
  scope: freshScope(),
  drawing: { strokes: [], labels: [], statedMagnification: null, drawnLengthMm: null },
  measurement: { divisionsRead: null, calibratedUmPerDivision: null },
  ended: null,
  restarts: 0,
  historicFaults: [],
});

/** True once there is something on the stage worth looking at. */
export const hasViewableSlide = (state: BenchState): boolean =>
  state.slide.mounted && state.slide.specimen !== null && state.ended === null;
