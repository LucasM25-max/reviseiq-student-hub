import { describe, expect, it } from "vitest";

import type { MicroscopeAction } from "@/lib/practicals/microscope/actions";
import {
  boundingBox,
  CANVAS,
  coverage,
  crossingLabelLines,
  drawingRubric,
  inkDensity,
  MIN_COVERAGE,
  segmentsIntersect,
  sketchiness,
  strokeLength,
} from "@/lib/practicals/microscope/drawing";
import {
  CALIBRATION,
  checkStatedMagnification,
  drawingMagnification,
  magnificationWorking,
  measuredLengthUm,
  umPerDivision,
} from "@/lib/practicals/microscope/graticule";
import {
  describeField,
  fieldDiameterUm,
  fieldOptics,
  focusDescription,
  ONION_CELL_LENGTH_UM,
} from "@/lib/practicals/microscope/optics";
import { activeFaultIds, FAULT_IDS, type FaultId } from "@/lib/practicals/microscope/faults";
import { PHASE_OF } from "@/lib/practicals/microscope/actions";
import { scoreRun, summarise } from "@/lib/practicals/microscope/rubric";
import type { DrawingState, Stroke } from "@/lib/practicals/microscope/state";
import { emptyRun, happenedBefore, runAll, step } from "@/lib/practicals/microscope/trace";

/**
 * Optics, graticule arithmetic, drawing geometry and the method rubric.
 *
 * The graticule numbers are checked against AQA's own published calibration rather than
 * against whatever this implementation happens to produce, so the test fails if the
 * model drifts away from the real practical.
 */

const PERFECT: MicroscopeAction[] = [
  { t: "wearGoggles" },
  { t: "pipetteWater" },
  { t: "peelEpidermis", surface: "inner" },
  { t: "placeSpecimen" },
  { t: "flattenSpecimen" },
  { t: "addStain", drops: 2 },
  { t: "placeCoverslip", method: "lowerWithNeedle" },
  { t: "blotExcess" },
  { t: "mountSlide" },
  { t: "selectObjective", total: 40 },
  { t: "coarseFocus", delta: 380, viewing: "side" },
  { t: "fineFocus", delta: 20 },
  { t: "selectObjective", total: 400 },
];

/** A complete run: perfect technique, measured, drawn and calculated correctly. */
const COMPLETE: MicroscopeAction[] = [
  ...PERFECT,
  { t: "readGraticule", divisions: 90 },
  { t: "measureDrawing", lengthMm: 120 },
  // 90 divisions at ×400 = 240 µm = 0.24 mm. 120 mm ÷ 0.24 mm = ×500.
  { t: "submitMagnification", value: 500 },
];

/** Replaces every action of a type across the run. */
const swapAll = (type: MicroscopeAction["t"], replacement: MicroscopeAction) =>
  PERFECT.map((action) => (action.t === type ? replacement : action));

describe("field of view", () => {
  it("is 4500, 1800 and 450 micrometres across", () => {
    expect(fieldDiameterUm(40)).toBe(4500);
    expect(fieldDiameterUm(100)).toBe(1800);
    expect(fieldDiameterUm(400)).toBe(450);
  });

  it("fits about fifteen onion cells at low power and one at high", () => {
    // This is the entire argument for searching at ×40 first, so it is worth asserting
    // rather than trusting.
    expect(Math.round(fieldDiameterUm(40) / ONION_CELL_LENGTH_UM)).toBe(15);
    expect(Math.round(fieldDiameterUm(400) / ONION_CELL_LENGTH_UM)).toBe(2);
  });

  it("shrinks as magnification rises", () => {
    expect(fieldDiameterUm(40)).toBeGreaterThan(fieldDiameterUm(100));
    expect(fieldDiameterUm(100)).toBeGreaterThan(fieldDiameterUm(400));
  });
});

describe("depth of field", () => {
  const atFocusError = (total: 40 | 100 | 400, error: number) => {
    const state = runAll([...PERFECT, { t: "selectObjective", total }]).state;
    return fieldOptics({
      ...state,
      scope: { ...state.scope, objective: total, stageHeight: error },
    });
  };

  it("makes the same stage error far worse at high power", () => {
    const error = 8;
    expect(atFocusError(40, error).blur).toBeLessThan(atFocusError(100, error).blur);
    expect(atFocusError(100, error).blur).toBeLessThan(atFocusError(400, error).blur);
  });

  it("tolerates at ×40 an error that ruins the image at ×400", () => {
    expect(atFocusError(40, 10).inFocus).toBe(true);
    expect(atFocusError(400, 10).inFocus).toBe(false);
  });

  it("is sharp when the stage is at the focal plane", () => {
    expect(atFocusError(400, 0).blur).toBe(0);
    expect(atFocusError(400, 0).sharpness).toBe(1);
  });

  it("never blurs beyond the cap, however far out the stage is", () => {
    expect(atFocusError(400, 100000).blur).toBe(12);
    expect(atFocusError(400, 100000).sharpness).toBe(0);
  });

  it("is symmetric: too high is as bad as too low", () => {
    expect(atFocusError(400, 5).blur).toBe(atFocusError(400, -5).blur);
  });

  it("describes focus in words for the live region", () => {
    expect(focusDescription(0)).toBe("in focus");
    expect(focusDescription(3)).toBe("nearly focused");
    expect(focusDescription(9)).toBe("blurred");
  });
});

describe("staining fails in two opposite directions", () => {
  const withDrops = (drops: number) =>
    fieldOptics(
      runAll(
        PERFECT.map((action) => (action.t === "addStain" ? { t: "addStain", drops } : action)),
      ).state,
    );

  it("leaves a correctly stained slide clear and unwashed", () => {
    expect(withDrops(2).wash).toBe(0);
    expect(withDrops(2).contrast).toBeGreaterThan(1);
  });

  it("makes an under-stained slide faint, not dark", () => {
    const optics = fieldOptics(runAll(PERFECT.filter((a) => a.t !== "addStain")).state);
    expect(optics.contrast).toBeLessThan(0.5);
    expect(optics.wash).toBe(0);
  });

  it("makes an over-stained slide dark, not faint", () => {
    // Modelling both failures with one "contrast" number rendered over-staining as
    // pale — the opposite of what the slide looks like, and of what the description
    // says about it.
    expect(withDrops(9).wash).toBeGreaterThan(0.5);
  });

  it("darkens further the more iodine is added, up to a limit", () => {
    expect(withDrops(6).wash).toBeGreaterThan(withDrops(4).wash);
    expect(withDrops(99).wash).toBeLessThanOrEqual(0.85);
  });
});

describe("the text description of the field", () => {
  it("says there is no slide before one is mounted", () => {
    expect(describeField(emptyRun().state)).toBe("No slide on the stage.");
  });

  it("describes a good slide as stained cells in rows", () => {
    const text = describeField(runAll(PERFECT).state);
    expect(text).toContain("rectangular cells in rows");
    expect(text).toContain("in focus");
    expect(text).toContain("450 micrometres across at ×400");
  });

  it("mentions the bubbles when the coverslip was dropped", () => {
    const state = runAll(
      PERFECT.map((action) =>
        action.t === "placeCoverslip" ? { t: "placeCoverslip", method: "drop" } : action,
      ),
    ).state;
    expect(describeField(state)).toContain("air bubble");
  });

  it("says the cells are almost transparent when unstained", () => {
    const state = runAll(PERFECT.filter((action) => action.t !== "addStain")).state;
    expect(describeField(state)).toContain("almost transparent");
  });

  it("says nothing can be separated when over-stained", () => {
    const state = runAll(
      PERFECT.map((action) => (action.t === "addStain" ? { t: "addStain", drops: 8 } : action)),
    ).state;
    expect(describeField(state)).toContain("no structures can be separated");
  });

  it("explains the cracked slide rather than describing an image", () => {
    const state = runAll([
      ...PERFECT.slice(0, 9),
      { t: "coarseFocus", delta: 500, viewing: "side" },
      { t: "coarseFocus", delta: -5, viewing: "eyepiece" },
    ]).state;
    expect(describeField(state)).toContain("cracked");
  });
});

describe("graticule calibration", () => {
  it("uses AQA's published figure: 90 divisions is 240 micrometres at ×400", () => {
    expect(CALIBRATION).toEqual({ divisions: 90, micrometres: 240, atTotal: 400 });
    expect(measuredLengthUm(90, 400)).toBeCloseTo(240, 6);
  });

  it("gives 26.67, 10.67 and 2.67 micrometres per division", () => {
    expect(umPerDivision(40)).toBeCloseTo(26.67, 2);
    expect(umPerDivision(100)).toBeCloseTo(10.67, 2);
    expect(umPerDivision(400)).toBeCloseTo(2.67, 2);
  });

  it("makes a division measure less as magnification rises", () => {
    // The graticule is in the eyepiece, so it stays put while the specimen grows.
    expect(umPerDivision(40)).toBeGreaterThan(umPerDivision(400));
  });

  it("accepts the student's own calibration over the default", () => {
    expect(measuredLengthUm(10, 400, 5)).toBe(50);
  });

  it("measures a plausible onion cell at high power", () => {
    // 100 divisions at ×400 is about 267 µm, squarely in the real 250–350 µm range.
    expect(measuredLengthUm(100, 400)).toBeGreaterThan(250);
    expect(measuredLengthUm(100, 400)).toBeLessThan(350);
  });
});

describe("magnification of the drawing", () => {
  it("is the drawing divided by the real thing, in the same units", () => {
    // 120 mm drawing of a 240 µm cell: 120000 µm ÷ 240 µm = 500.
    expect(drawingMagnification(120, 240)).toBe(500);
  });

  it("has no unit and is not the microscope's magnification", () => {
    const working = magnificationWorking(90, 400, 120)!;
    expect(working.magnification).toBe(500);
    expect(working.microscopeMagnification).toBe(400);
  });

  it("shows every step of the working", () => {
    const working = magnificationWorking(90, 400, 120)!;
    expect(working).toMatchObject({
      divisions: 90,
      actualLengthUm: 240,
      actualLengthMm: 0.24,
      drawnLengthMm: 120,
    });
  });

  it("refuses zero and negative lengths instead of returning Infinity", () => {
    expect(drawingMagnification(0, 240)).toBeNull();
    expect(drawingMagnification(120, 0)).toBeNull();
    expect(drawingMagnification(-120, 240)).toBeNull();
  });

  it("refuses NaN from an empty or junk input field", () => {
    expect(drawingMagnification(Number.NaN, 240)).toBeNull();
    expect(drawingMagnification(120, Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("accepts an answer within five per cent, for reading error", () => {
    const working = magnificationWorking(90, 400, 120)!;
    expect(checkStatedMagnification(500, working).correct).toBe(true);
    expect(checkStatedMagnification(515, working).correct).toBe(true);
    expect(checkStatedMagnification(560, working).correct).toBe(false);
  });

  it("names the classic error of writing the microscope's magnification instead", () => {
    const working = magnificationWorking(90, 400, 120)!;
    const verdict = checkStatedMagnification(400, working);
    expect(verdict.correct).toBe(false);
    expect(verdict.wroteMicroscopeMagnification).toBe(true);
  });

  it("does not cry 'wrote ×400' for an answer that is merely wrong", () => {
    const working = magnificationWorking(90, 400, 120)!;
    expect(checkStatedMagnification(12, working).wroteMicroscopeMagnification).toBe(false);
  });
});

/** Builds a stroke from a straight run of points. */
const line = (x1: number, y1: number, x2: number, y2: number, steps = 12): Stroke => ({
  points: Array.from({ length: steps + 1 }, (_, i) => ({
    x: x1 + ((x2 - x1) * i) / steps,
    y: y1 + ((y2 - y1) * i) / steps,
  })),
});

const emptyDrawing = (): DrawingState => ({
  strokes: [],
  labels: [],
  statedMagnification: null,
  drawnLengthMm: null,
});

/** Four clean sides of a big rectangle: what a good outline drawing looks like. */
const goodOutline = (): Stroke[] => [
  line(60, 60, 560, 60),
  line(560, 60, 560, 400),
  line(560, 400, 60, 400),
  line(60, 400, 60, 60),
];

describe("stroke geometry", () => {
  it("measures the length along a stroke, not end to end", () => {
    expect(strokeLength(line(0, 0, 100, 0))).toBeCloseTo(100, 6);
  });

  it("gives a single point no length", () => {
    expect(strokeLength({ points: [{ x: 5, y: 5 }] })).toBe(0);
    expect(strokeLength({ points: [] })).toBe(0);
  });

  it("finds the bounding box across every stroke", () => {
    expect(boundingBox(goodOutline())).toEqual({ minX: 60, minY: 60, maxX: 560, maxY: 400 });
  });

  it("has no bounding box for nothing", () => {
    expect(boundingBox([])).toBeNull();
    expect(coverage([])).toBe(0);
  });
});

describe("drawing rubric — decidable from the vectors alone (D47)", () => {
  const award = (drawing: DrawingState, id: string) =>
    drawingRubric(drawing).points.find((point) => point.id === id)!.awarded;

  it("gives the single-lines mark for clean long strokes", () => {
    expect(award({ ...emptyDrawing(), strokes: goodOutline() }, "single-lines")).toBe(true);
  });

  it("withholds it for a feathered, sketchy outline", () => {
    // The same rectangle drawn as forty short dashes instead of four lines.
    const sketchy: Stroke[] = Array.from({ length: 40 }, (_, i) =>
      line(60 + i * 12, 60, 60 + i * 12 + 10, 62, 2),
    );
    expect(sketchiness(sketchy)).toBeGreaterThan(0.9);
    expect(award({ ...emptyDrawing(), strokes: sketchy }, "single-lines")).toBe(false);
  });

  it("gives the no-shading mark for an outline", () => {
    expect(award({ ...emptyDrawing(), strokes: goodOutline() }, "no-shading")).toBe(true);
  });

  it("withholds it when a small area is filled with ink", () => {
    // Hatching a 100×100 box with 50 lines is a great deal of ink for the area.
    const shaded: Stroke[] = Array.from({ length: 50 }, (_, i) =>
      line(100, 100 + i * 2, 200, 100 + i * 2),
    );
    expect(inkDensity(shaded)).toBeGreaterThan(inkDensity(goodOutline()));
    expect(award({ ...emptyDrawing(), strokes: shaded }, "no-shading")).toBe(false);
  });

  it("gives the size mark for a drawing that fills the space", () => {
    expect(coverage(goodOutline())).toBeGreaterThan(MIN_COVERAGE);
    expect(award({ ...emptyDrawing(), strokes: goodOutline() }, "large-enough")).toBe(true);
  });

  it("withholds it for a tiny drawing in one corner", () => {
    const tiny = [line(10, 10, 40, 10), line(40, 10, 40, 40)];
    expect(award({ ...emptyDrawing(), strokes: tiny }, "large-enough")).toBe(false);
  });

  it("gives the label mark when no lines cross", () => {
    const drawing: DrawingState = {
      ...emptyDrawing(),
      strokes: goodOutline(),
      labels: [
        { id: "cell-wall", at: { x: 600, y: 100 }, target: { x: 560, y: 120 } },
        { id: "nucleus", at: { x: 600, y: 300 }, target: { x: 400, y: 300 } },
      ],
    };
    expect(award(drawing, "label-lines")).toBe(true);
  });

  it("withholds it when two label lines cross", () => {
    const drawing: DrawingState = {
      ...emptyDrawing(),
      strokes: goodOutline(),
      labels: [
        { id: "cell-wall", at: { x: 600, y: 100 }, target: { x: 300, y: 350 } },
        { id: "nucleus", at: { x: 600, y: 350 }, target: { x: 300, y: 100 } },
      ],
    };
    expect(crossingLabelLines(drawing.labels)).toHaveLength(1);
    expect(award(drawing, "label-lines")).toBe(false);
  });

  it("gives the magnification mark only when one is written", () => {
    expect(award(emptyDrawing(), "magnification-stated")).toBe(false);
    expect(award({ ...emptyDrawing(), statedMagnification: 500 }, "magnification-stated")).toBe(
      true,
    );
  });

  it("awards nothing at all for a blank canvas", () => {
    const result = drawingRubric(emptyDrawing());
    expect(result.awarded).toBe(0);
  });

  it("leaves the two judgement calls pending rather than guessing", () => {
    // A confident wrong tick on a drawing costs more trust than an honest gap.
    const result = drawingRubric({ ...emptyDrawing(), strokes: goodOutline() });
    const pending = result.points.filter((point) => point.awarded === null).map((p) => p.id);
    expect(pending).toEqual(["looks-like-onion", "labels-on-target"]);
    expect(result.pending).toBe(2);
    expect(result.decidable).toBe(5);
  });

  it("is always advisory and never feeds mastery", () => {
    expect(drawingRubric(emptyDrawing()).advisory).toBe(true);
  });
});

describe("segment intersection", () => {
  it("finds a plain crossing", () => {
    expect(
      segmentsIntersect(
        { a: { x: 0, y: 0 }, b: { x: 10, y: 10 } },
        { a: { x: 0, y: 10 }, b: { x: 10, y: 0 } },
      ),
    ).toBe(true);
  });

  it("does not report parallel lines as crossing", () => {
    expect(
      segmentsIntersect(
        { a: { x: 0, y: 0 }, b: { x: 10, y: 0 } },
        { a: { x: 0, y: 5 }, b: { x: 10, y: 5 } },
      ),
    ).toBe(false);
  });

  it("does not report lines that would cross if they were longer", () => {
    expect(
      segmentsIntersect(
        { a: { x: 0, y: 0 }, b: { x: 1, y: 1 } },
        { a: { x: 10, y: 0 }, b: { x: 9, y: 1 } },
      ),
    ).toBe(false);
  });

  it("catches lines that touch end to end", () => {
    expect(
      segmentsIntersect(
        { a: { x: 0, y: 0 }, b: { x: 5, y: 5 } },
        { a: { x: 5, y: 5 }, b: { x: 10, y: 0 } },
      ),
    ).toBe(true);
  });
});

describe("the method trace", () => {
  it("records every action in order", () => {
    const run = runAll(PERFECT);
    expect(run.trace).toHaveLength(PERFECT.length);
    expect(run.trace[0].n).toBe(1);
    expect(run.trace[0].description).toContain("eye protection");
  });

  it("records refused actions rather than dropping them", () => {
    // A student repeatedly trying something impossible is telling us something.
    const run = step(emptyRun(), { t: "blotExcess" });
    expect(run.trace).toHaveLength(1);
    expect(run.trace[0].applied).toBe(false);
  });

  it("shows the faults as they stood after each action", () => {
    const run = runAll([{ t: "peelEpidermis", surface: "inner" }, { t: "placeSpecimen" }]);
    expect(run.trace.at(-1)!.faults).toContain("dry-mount");
  });

  it("knows what happened before what", () => {
    const run = runAll(PERFECT);
    expect(happenedBefore(run.trace, "wearGoggles", "addStain")).toBe(true);
    expect(happenedBefore(run.trace, "addStain", "wearGoggles")).toBe(false);
  });

  it("does not claim an action that never happened came first", () => {
    const run = runAll([{ t: "wearGoggles" }]);
    expect(happenedBefore(run.trace, "wearGoggles", "addStain")).toBe(false);
  });
});

describe("the method rubric", () => {
  it("gives full marks for a complete, correct run", () => {
    const result = scoreRun(runAll(COMPLETE));
    const missed = result.points.filter((point) => !point.awarded).map((point) => point.id);
    expect(missed).toEqual([]);
    expect(result.awarded).toBe(result.total);
  });

  it("marks out of the full total even when the run was abandoned early", () => {
    // Otherwise stopping halfway would flatter the attempt.
    const half = scoreRun(runAll(PERFECT.slice(0, 5)));
    const full = scoreRun(runAll(COMPLETE));
    expect(half.total).toBe(full.total);
    expect(half.awarded).toBeLessThan(full.awarded);
  });

  it("awards each point independently, so one mistake costs one mark", () => {
    const run = runAll(COMPLETE.filter((action) => action.t !== "blotExcess"));
    const result = scoreRun(run);
    expect(result.awarded).toBe(result.total - 1);
    expect(result.points.find((point) => point.id === "blotted")!.awarded).toBe(false);
  });

  it("explains why a missed step mattered", () => {
    const result = scoreRun(runAll(COMPLETE.filter((action) => action.t !== "blotExcess")));
    const point = result.points.find((p) => p.id === "blotted")!;
    expect(point.why).toContain("drift");
    expect(point.fault).toBe("drifting-coverslip");
  });

  it("refuses the safety mark when the goggles went on after the iodine", () => {
    const late: MicroscopeAction[] = [
      { t: "pipetteWater" },
      { t: "peelEpidermis", surface: "inner" },
      { t: "placeSpecimen" },
      { t: "flattenSpecimen" },
      { t: "addStain", drops: 2 },
      { t: "wearGoggles" },
    ];
    const result = scoreRun(runAll(late));
    expect(result.points.find((p) => p.id === "goggles-first")!.awarded).toBe(false);
  });

  it("refuses the magnification mark for the microscope's own magnification", () => {
    const run = runAll([
      ...PERFECT,
      { t: "readGraticule", divisions: 90 },
      { t: "measureDrawing", lengthMm: 120 },
      { t: "submitMagnification", value: 400 },
    ]);
    expect(scoreRun(run).points.find((p) => p.id === "magnification-correct")!.awarded).toBe(
      false,
    );
  });

  it("refuses it when the student never measured their own drawing", () => {
    const run = runAll([
      ...PERFECT,
      { t: "readGraticule", divisions: 90 },
      { t: "submitMagnification", value: 500 },
    ]);
    const result = scoreRun(run);
    expect(result.points.find((p) => p.id === "measured-drawing")!.awarded).toBe(false);
    expect(result.points.find((p) => p.id === "magnification-correct")!.awarded).toBe(false);
  });

  it("lists the faults that fired", () => {
    const run = runAll(
      COMPLETE.map((action) =>
        action.t === "placeCoverslip" ? { t: "placeCoverslip", method: "drop" } : action,
      ),
    );
    expect(scoreRun(run).faults).toContain("air-bubbles");
  });

  it("remembers a fault from a slide that was thrown away and restarted", () => {
    const run = runAll([
      { t: "peelEpidermis", surface: "inner" },
      { t: "placeSpecimen" },
      { t: "placeCoverslip", method: "drop" },
      { t: "freshSlide" },
      ...COMPLETE,
    ]);
    const result = scoreRun(run);
    expect(result.restarts).toBe(1);
    expect(result.faults).toContain("air-bubbles");
  });

  it("summarises the run in one line", () => {
    expect(summarise(scoreRun(runAll(COMPLETE)))).toBe(
      "12 of 12 method marks · no technique faults",
    );
  });

  it("counts the restarts in the summary", () => {
    const run = runAll([
      { t: "placeCoverslip", method: "drop" },
      { t: "freshSlide" },
      ...COMPLETE,
    ]);
    expect(summarise(scoreRun(run))).toContain("1 fresh slide");
  });
});

describe("the canvas", () => {
  it("is a sensible size for a drawing", () => {
    expect(CANVAS.width).toBeGreaterThan(300);
    expect(CANVAS.height).toBeGreaterThan(300);
  });
});

// ---------------------------------------------------------------------------
// No untested surface
// ---------------------------------------------------------------------------

/**
 * Exhaustiveness, in place of a line-coverage percentage.
 *
 * A coverage number says which lines ran. These say something stronger and more to the
 * point: every fault can fire and not fire, every rubric row can be won and lost, and
 * every action the bench accepts is reachable. A rubric row that can only ever be
 * awarded is not a rubric row, and line coverage would call it covered.
 */
describe("every fault can both fire and not fire", () => {
  const faulty: Record<FaultId, MicroscopeAction[]> = {
    "air-bubbles": swapAll("placeCoverslip", { t: "placeCoverslip", method: "drop" }),
    "no-stain": PERFECT.filter((action) => action.t !== "addStain"),
    "over-stained": swapAll("addStain", { t: "addStain", drops: 9 }),
    "too-thick": PERFECT.filter((action) => action.t !== "flattenSpecimen"),
    "dry-mount": PERFECT.filter((action) => action.t !== "pipetteWater"),
    "drifting-coverslip": PERFECT.filter((action) => action.t !== "blotExcess"),
    "cracked-slide": [
      ...PERFECT,
      { t: "coarseFocus", delta: 500, viewing: "side" },
      { t: "coarseFocus", delta: -5, viewing: "eyepiece" },
    ],
    "lost-at-high-power": [
      ...PERFECT.slice(0, 9),
      { t: "selectObjective", total: 400 },
      { t: "coarseFocus", delta: 380, viewing: "side" },
    ],
    "no-goggles": PERFECT.filter((action) => action.t !== "wearGoggles"),
  };

  it("covers all nine", () => {
    expect(Object.keys(faulty).sort()).toEqual([...FAULT_IDS].sort());
  });

  it.each(FAULT_IDS)("%s fires when it should", (id) => {
    expect(activeFaultIds(runAll(faulty[id]).state)).toContain(id);
  });

  it.each(FAULT_IDS)("%s stays quiet on a good run", (id) => {
    expect(activeFaultIds(runAll(PERFECT).state)).not.toContain(id);
  });
});

describe("every rubric row can be both won and lost", () => {
  const perfect = scoreRun(runAll(COMPLETE));

  /** A run that should fail exactly one row. */
  const failing: Record<string, MicroscopeAction[]> = {
    "goggles-first": COMPLETE.filter((action) => action.t !== "wearGoggles"),
    "water-first": COMPLETE.filter((action) => action.t !== "pipetteWater"),
    "inner-epidermis": COMPLETE.map((action) =>
      action.t === "peelEpidermis" ? { t: "peelEpidermis", surface: "outer" } : action,
    ),
    flattened: COMPLETE.filter((action) => action.t !== "flattenSpecimen"),
    stained: COMPLETE.filter((action) => action.t !== "addStain"),
    "coverslip-lowered": COMPLETE.map((action) =>
      action.t === "placeCoverslip" ? { t: "placeCoverslip", method: "drop" } : action,
    ),
    blotted: COMPLETE.filter((action) => action.t !== "blotExcess"),
    "lowest-power-first": [
      ...COMPLETE.slice(0, 9),
      { t: "selectObjective", total: 400 },
      ...COMPLETE.slice(10),
    ],
    "focused-safely": [
      ...COMPLETE.slice(0, 9),
      { t: "coarseFocus", delta: -10, viewing: "eyepiece" },
      ...COMPLETE.slice(9),
    ],
    "read-graticule": COMPLETE.filter((action) => action.t !== "readGraticule"),
    "measured-drawing": COMPLETE.filter((action) => action.t !== "measureDrawing"),
    "magnification-correct": COMPLETE.map((action) =>
      action.t === "submitMagnification" ? { t: "submitMagnification", value: 400 } : action,
    ),
  };

  it("names every row exactly once", () => {
    expect(Object.keys(failing).sort()).toEqual(perfect.points.map((point) => point.id).sort());
  });

  it.each(perfect.points.map((point) => point.id))("%s is awarded on a perfect run", (id) => {
    expect(perfect.points.find((point) => point.id === id)!.awarded).toBe(true);
  });

  it.each(Object.keys(failing))("%s is withheld when the step is missed", (id) => {
    const result = scoreRun(runAll(failing[id]));
    expect(result.points.find((point) => point.id === id)!.awarded).toBe(false);
  });

  it("explains every row it can withhold", () => {
    for (const point of perfect.points) {
      expect(point.why.length, `${point.id} has no explanation`).toBeGreaterThan(40);
    }
  });
});

describe("every action the bench accepts is reachable", () => {
  it("leaves no action type unexercised", () => {
    const exercised = new Set<string>();
    for (const actions of [
      COMPLETE,
      [
        { t: "setIris", value: 0.4 },
        { t: "panStage", dx: 10, dy: 10 },
        { t: "undoStroke" },
        { t: "removeLabel", id: "nucleus" },
        { t: "calibrateGraticule", divisions: 90, micrometres: 240 },
        { t: "placeLabel", id: "nucleus", at: { x: 1, y: 1 }, target: { x: 2, y: 2 } },
        {
          t: "drawStroke",
          stroke: {
            points: [
              { x: 0, y: 0 },
              { x: 9, y: 9 },
            ],
          },
        },
        { t: "freshSlide" },
      ] satisfies MicroscopeAction[],
    ]) {
      for (const action of actions) exercised.add(action.t);
    }

    for (const type of Object.keys(PHASE_OF)) {
      expect(exercised.has(type), `${type} is never exercised by a test`).toBe(true);
    }
  });
});
