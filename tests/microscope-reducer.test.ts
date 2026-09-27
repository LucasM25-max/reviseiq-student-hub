import { describe, expect, it } from "vitest";

import { rawContent } from "@content/index";
import type { MicroscopeAction } from "@/lib/practicals/microscope/actions";
import { describeAction, PHASE_OF } from "@/lib/practicals/microscope/actions";
import {
  activeFaultIds,
  allFaultIds,
  fieldImpairment,
  FAULT_IDS,
  hasFault,
} from "@/lib/practicals/microscope/faults";
import {
  CRACK_HEIGHT,
  PAN_LIMIT_UM,
  reduce,
  reduceAll,
  STAGE_MAX,
  STAGE_MIN,
} from "@/lib/practicals/microscope/reduce";
import { METHOD_ACTIONS } from "@/lib/practicals/microscope/method";
import { initialBench, type BenchState } from "@/lib/practicals/microscope/state";

/**
 * The bench reducer and the fault model.
 *
 * No browser is available in this environment, so a simulation whose logic only runs in
 * one is a simulation we cannot test (D46). Everything that decides what a student sees
 * lives behind this reducer, which means all of it is reachable from here.
 *
 * §4.9 asks for one test per fault row proving the trigger fires it — and, just as
 * importantly, one proving it does not fire otherwise. A fault that fires on everything
 * is as useless as one that never fires, and only the second kind gets noticed.
 */

/** A textbook run: every step right, in order, ending focused at ×400. */
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
  { t: "fineFocus", delta: 0 },
];

const perfect = () => reduceAll(PERFECT);

/** Replaces the first action of a type, leaving the rest of the run intact. */
function swap(type: MicroscopeAction["t"], replacement: MicroscopeAction | null) {
  const out: MicroscopeAction[] = [];
  let done = false;
  for (const action of PERFECT) {
    if (!done && action.t === type) {
      done = true;
      if (replacement) out.push(replacement);
      continue;
    }
    out.push(action);
  }
  return reduceAll(out);
}

describe("a textbook run", () => {
  it("ends with a mounted, stained, flat, bubble-free slide", () => {
    const state = perfect();
    expect(state.slide).toMatchObject({
      water: true,
      stainDrops: 2,
      coverslip: "lowerWithNeedle",
      blotted: true,
      mounted: true,
      stainedBeforeGoggles: false,
    });
    expect(state.slide.specimen).toEqual({ surface: "inner", flattened: true });
  });

  it("raises no faults at all", () => {
    expect(activeFaultIds(perfect())).toEqual([]);
  });

  it("does not end the run or need a restart", () => {
    expect(perfect().ended).toBeNull();
    expect(perfect().restarts).toBe(0);
  });

  it("leaves the specimen in focus at ×400", () => {
    const state = perfect();
    expect(state.scope.objective).toBe(400);
    expect(state.scope.stageHeight).toBe(0);
  });
});

describe("the reducer allows bad technique to happen", () => {
  // The design decision is consequences, not warnings. A reducer that refused the wrong
  // action would be a warning wearing a disguise.
  it("lets the coverslip be dropped flat", () => {
    const state = swap("placeCoverslip", { t: "placeCoverslip", method: "drop" });
    expect(state.slide.coverslip).toBe("drop");
  });

  it("lets the epidermis be peeled from the outer surface", () => {
    const state = swap("peelEpidermis", { t: "peelEpidermis", surface: "outer" });
    expect(state.slide.specimen?.surface).toBe("outer");
  });

  it("lets the stain be skipped entirely", () => {
    expect(swap("addStain", null).slide.stainDrops).toBe(0);
  });
});

describe("the peel travels from the onion to the forceps to the slide", () => {
  // Peeling and placing are separate steps because the gap between them is where the
  // water goes. When they were collapsed into one, `dry-mount` fired the moment the
  // onion was touched and "water before specimen" became unmarkable.
  it("puts the peel in the forceps, not straight onto the slide", () => {
    const state = reduceAll([{ t: "peelEpidermis", surface: "inner" }]);
    expect(state.peel).toEqual({ surface: "inner" });
    expect(state.slide.specimen).toBeNull();
  });

  it("does not call it a dry mount while the peel is still in the forceps", () => {
    expect(hasFault(reduceAll([{ t: "peelEpidermis", surface: "inner" }]), "dry-mount")).toBe(
      false,
    );
  });

  it("moves it onto the slide when it is placed", () => {
    const state = reduceAll([
      { t: "pipetteWater" },
      { t: "peelEpidermis", surface: "outer" },
      { t: "placeSpecimen" },
    ]);
    expect(state.peel).toBeNull();
    expect(state.slide.specimen).toEqual({ surface: "outer", flattened: false });
  });

  it("will not place a specimen that was never peeled", () => {
    const watered = reduceAll([{ t: "pipetteWater" }]);
    expect(reduce(watered, { t: "placeSpecimen" })).toBe(watered);
  });

  it("will not peel a second piece while one is already in the forceps", () => {
    const peeled = reduceAll([{ t: "peelEpidermis", surface: "inner" }]);
    expect(reduce(peeled, { t: "peelEpidermis", surface: "outer" })).toBe(peeled);
  });

  it("keeps an unplaced peel across a fresh slide, but not a placed one", () => {
    const inForceps = reduce(reduceAll([{ t: "peelEpidermis", surface: "inner" }]), {
      t: "freshSlide",
    });
    expect(inForceps.peel).toEqual({ surface: "inner" });

    const placed = reduce(reduceAll(PERFECT), { t: "freshSlide" });
    expect(placed.peel).toBeNull();
    expect(placed.slide.specimen).toBeNull();
  });
});

describe("the reducer refuses only the impossible", () => {
  it("will not blot a slide that has no coverslip", () => {
    const state = initialBench();
    expect(reduce(state, { t: "blotExcess" })).toBe(state);
  });

  it("will not stain a mount that is already closed", () => {
    const closed = reduceAll(PERFECT.slice(0, 7));
    expect(reduce(closed, { t: "addStain", drops: 1 })).toBe(closed);
  });

  it("will not place a specimen twice", () => {
    const placed = reduceAll(PERFECT.slice(0, 4));
    expect(reduce(placed, { t: "placeSpecimen" })).toBe(placed);
  });

  it("will not add water once the specimen is down, which would flood the mount", () => {
    const placed = reduceAll([
      { t: "peelEpidermis", surface: "inner" },
      { t: "placeSpecimen" },
    ]);
    expect(reduce(placed, { t: "pipetteWater" })).toBe(placed);
  });

  it("will not focus a slide that is not on the stage", () => {
    const state = initialBench();
    expect(reduce(state, { t: "coarseFocus", delta: 10, viewing: "side" })).toBe(state);
  });

  it("returns the very same object when it refuses, so callers can tell nothing happened", () => {
    const state = initialBench();
    expect(reduce(state, { t: "mountSlide" })).toBe(state);
  });
});

describe("numbers are clamped rather than trusted", () => {
  const mounted = () => reduceAll(PERFECT.slice(0, 9));

  it("keeps the stage inside its travel", () => {
    expect(
      reduce(mounted(), { t: "coarseFocus", delta: 99999, viewing: "side" }).scope.stageHeight,
    ).toBe(STAGE_MAX);
    expect(
      reduce(mounted(), { t: "coarseFocus", delta: -99999, viewing: "side" }).scope.stageHeight,
    ).toBe(STAGE_MIN);
  });

  it("keeps the iris between shut and open", () => {
    expect(reduce(mounted(), { t: "setIris", value: 5 }).scope.iris).toBe(1);
    expect(reduce(mounted(), { t: "setIris", value: -2 }).scope.iris).toBe(0);
  });

  it("keeps the stage pan within range", () => {
    expect(reduce(mounted(), { t: "panStage", dx: 1e9, dy: 1e9 }).scope.panX).toBe(
      PAN_LIMIT_UM,
    );
  });

  it("ignores NaN and Infinity from a slider or a parsed field", () => {
    const before = mounted();
    const after = reduce(before, { t: "coarseFocus", delta: Number.NaN, viewing: "side" });
    expect(after.scope.stageHeight).toBe(before.scope.stageHeight);
    expect(reduce(before, { t: "setIris", value: Number.NaN }).scope.iris).toBe(
      before.scope.iris,
    );
  });

  it("will not accept a negative or absurd number of stain drops", () => {
    const open = reduceAll(PERFECT.slice(0, 5));
    expect(reduce(open, { t: "addStain", drops: -3 }).slide.stainDrops).toBe(0);
    expect(reduce(open, { t: "addStain", drops: 500 }).slide.stainDrops).toBe(10);
  });
});

describe("air-bubbles", () => {
  it("fires when the coverslip is dropped flat", () => {
    expect(
      hasFault(swap("placeCoverslip", { t: "placeCoverslip", method: "drop" }), "air-bubbles"),
    ).toBe(true);
  });

  it("does not fire when it is lowered with a mounted needle", () => {
    expect(hasFault(perfect(), "air-bubbles")).toBe(false);
  });

  it("puts bubbles in the field of view, deterministically", () => {
    const state = swap("placeCoverslip", { t: "placeCoverslip", method: "drop" });
    expect(fieldImpairment(state).bubbles).toBeGreaterThanOrEqual(2);
    expect(fieldImpairment(state).bubbles).toBe(fieldImpairment(state).bubbles);
  });
});

describe("no-stain", () => {
  it("fires when the mount is closed with no iodine", () => {
    expect(hasFault(swap("addStain", null), "no-stain")).toBe(true);
  });

  it("does not fire before the coverslip goes on — that is just where you are", () => {
    const openMount = reduceAll(PERFECT.slice(0, 5));
    expect(hasFault(openMount, "no-stain")).toBe(false);
  });

  it("does not fire on a correctly stained slide", () => {
    expect(hasFault(perfect(), "no-stain")).toBe(false);
  });

  it("leaves the field with no contrast and no visible nuclei", () => {
    const state = swap("addStain", null);
    expect(fieldImpairment(state).stainStrength).toBe(0);
  });
});

describe("over-stained", () => {
  it("fires above three drops", () => {
    expect(hasFault(swap("addStain", { t: "addStain", drops: 4 }), "over-stained")).toBe(true);
  });

  it("does not fire at exactly three", () => {
    expect(hasFault(swap("addStain", { t: "addStain", drops: 3 }), "over-stained")).toBe(false);
  });

  it("accumulates across repeated drops rather than resetting", () => {
    // Two drops, then two more, is four drops — not two.
    const state = reduceAll([
      ...PERFECT.slice(0, 6),
      { t: "addStain", drops: 2 },
      ...PERFECT.slice(6),
    ]);
    expect(state.slide.stainDrops).toBe(4);
    expect(hasFault(state, "over-stained")).toBe(true);
  });
});

describe("too-thick", () => {
  it("fires when peeled from the outer surface", () => {
    expect(
      hasFault(swap("peelEpidermis", { t: "peelEpidermis", surface: "outer" }), "too-thick"),
    ).toBe(true);
  });

  it("fires when the peel is never flattened", () => {
    expect(hasFault(swap("flattenSpecimen", null), "too-thick")).toBe(true);
  });

  it("does not fire on a flat inner peel", () => {
    expect(hasFault(perfect(), "too-thick")).toBe(false);
  });

  it("leaves blur that focusing cannot remove", () => {
    const state = swap("flattenSpecimen", null);
    expect(fieldImpairment(state).irreducibleBlur).toBeGreaterThan(0);
  });
});

describe("dry-mount", () => {
  it("fires when the specimen goes onto a dry slide", () => {
    expect(hasFault(swap("pipetteWater", null), "dry-mount")).toBe(true);
  });

  it("does not fire when water went down first", () => {
    expect(hasFault(perfect(), "dry-mount")).toBe(false);
  });

  it("does not fire on a bare slide with no specimen on it", () => {
    expect(hasFault(initialBench(), "dry-mount")).toBe(false);
  });
});

describe("drifting-coverslip", () => {
  it("fires when the excess is not blotted", () => {
    expect(hasFault(swap("blotExcess", null), "drifting-coverslip")).toBe(true);
  });

  it("does not fire once blotted", () => {
    expect(hasFault(perfect(), "drifting-coverslip")).toBe(false);
  });

  it("does not fire before there is a coverslip to blot around", () => {
    expect(hasFault(reduceAll(PERFECT.slice(0, 6)), "drifting-coverslip")).toBe(false);
  });
});

describe("cracked-slide", () => {
  const blindDescent = (): BenchState =>
    reduceAll([
      ...PERFECT.slice(0, 9),
      // Rack all the way up, then drive down with an eye to the eyepiece.
      { t: "coarseFocus", delta: 500, viewing: "side" },
      { t: "coarseFocus", delta: -5, viewing: "eyepiece" },
    ]);

  it("fires when the coarse focus is racked down while looking through the eyepiece", () => {
    const state = blindDescent();
    expect(state.ended).toBe("cracked-slide");
    expect(hasFault(state, "cracked-slide")).toBe(true);
  });

  it("does not fire when racking down while looking from the side", () => {
    const state = reduceAll([
      ...PERFECT.slice(0, 9),
      { t: "coarseFocus", delta: 500, viewing: "side" },
      { t: "coarseFocus", delta: -5, viewing: "side" },
    ]);
    expect(state.ended).toBeNull();
  });

  it("does not fire when focusing upwards through the eyepiece, which is the safe way", () => {
    const state = reduceAll([
      ...PERFECT.slice(0, 11),
      { t: "coarseFocus", delta: 10, viewing: "eyepiece" },
    ]);
    expect(state.ended).toBeNull();
    expect(state.scope.blindDescent).toBe(false);
  });

  it("only cracks once the lens actually reaches the slide", () => {
    // Turning the wrong knob the wrong way low down is a bad habit, not a broken slide.
    const state = reduceAll([
      ...PERFECT.slice(0, 9),
      { t: "coarseFocus", delta: -10, viewing: "eyepiece" },
    ]);
    expect(state.scope.blindDescent).toBe(true);
    expect(state.scope.stageHeight).toBeLessThan(CRACK_HEIGHT);
    expect(state.ended).toBeNull();
  });

  it("ends the run — nothing else can be done", () => {
    const cracked = blindDescent();
    for (const action of [
      { t: "fineFocus", delta: 1 },
      { t: "mountSlide" },
      { t: "readGraticule", divisions: 90 },
    ] satisfies MicroscopeAction[]) {
      expect(reduce(cracked, action)).toBe(cracked);
    }
  });

  it("can only be recovered from with a fresh slide", () => {
    const restarted = reduce(blindDescent(), { t: "freshSlide" });
    expect(restarted.ended).toBeNull();
    expect(restarted.restarts).toBe(1);
    expect(restarted.slide.mounted).toBe(false);
  });

  it("records the crack in the carried-forward faults, so a restart cannot launder it", () => {
    const restarted = reduce(blindDescent(), { t: "freshSlide" });
    expect(activeFaultIds(restarted)).not.toContain("cracked-slide");
    expect(allFaultIds(restarted)).toContain("cracked-slide");
  });
});

describe("lost-at-high-power", () => {
  it("fires when the search starts above the lowest power", () => {
    const state = reduceAll([
      ...PERFECT.slice(0, 9),
      { t: "selectObjective", total: 400 },
      { t: "coarseFocus", delta: 380, viewing: "side" },
    ]);
    expect(hasFault(state, "lost-at-high-power")).toBe(true);
  });

  it("does not fire when the student starts at ×40 and works up", () => {
    expect(hasFault(perfect(), "lost-at-high-power")).toBe(false);
  });

  it("does not fire before anything has been viewed at all", () => {
    expect(hasFault(reduceAll(PERFECT.slice(0, 9)), "lost-at-high-power")).toBe(false);
  });

  it("judges only the first objective viewed, not later ones", () => {
    // Going up to ×400 after finding the cells at ×40 is the correct method.
    expect(perfect().scope.firstObjectiveViewed).toBe(40);
  });
});

describe("no-goggles", () => {
  it("fires when iodine is handled before eye protection", () => {
    const state = reduceAll([
      { t: "pipetteWater" },
      { t: "peelEpidermis", surface: "inner" },
      { t: "placeSpecimen" },
      { t: "flattenSpecimen" },
      { t: "addStain", drops: 2 },
      { t: "wearGoggles" },
    ]);
    expect(hasFault(state, "no-goggles")).toBe(true);
  });

  it("does not fire when the goggles go on first", () => {
    expect(hasFault(perfect(), "no-goggles")).toBe(false);
  });

  it("is not undone by putting the goggles on afterwards", () => {
    // The exposure already happened. This is the whole reason it is recorded as an
    // event rather than computed from the current state.
    const state = reduceAll([
      { t: "pipetteWater" },
      { t: "peelEpidermis", surface: "inner" },
      { t: "placeSpecimen" },
      { t: "addStain", drops: 2 },
      { t: "wearGoggles" },
      { t: "placeCoverslip", method: "lowerWithNeedle" },
    ]);
    expect(state.goggles).toBe(true);
    expect(hasFault(state, "no-goggles")).toBe(true);
  });

  it("does not fire for handling water without goggles, only iodine", () => {
    const state = reduceAll([
      { t: "pipetteWater" },
      { t: "peelEpidermis", surface: "inner" },
      { t: "placeSpecimen" },
    ]);
    expect(hasFault(state, "no-goggles")).toBe(false);
  });

  it("does not fire when zero drops are 'added'", () => {
    const state = reduceAll([
      { t: "pipetteWater" },
      { t: "peelEpidermis", surface: "inner" },
      { t: "placeSpecimen" },
      { t: "addStain", drops: 0 },
    ]);
    expect(hasFault(state, "no-goggles")).toBe(false);
  });
});

describe("faults are independent", () => {
  it("a perfect run raises none of the nine", () => {
    const active = activeFaultIds(perfect());
    for (const id of FAULT_IDS) expect(active).not.toContain(id);
  });

  it("one mistake raises exactly one fault, not a cascade", () => {
    const cases: [string, BenchState][] = [
      ["air-bubbles", swap("placeCoverslip", { t: "placeCoverslip", method: "drop" })],
      ["no-stain", swap("addStain", null)],
      ["over-stained", swap("addStain", { t: "addStain", drops: 5 })],
      ["too-thick", swap("flattenSpecimen", null)],
      ["dry-mount", swap("pipetteWater", null)],
      ["drifting-coverslip", swap("blotExcess", null)],
    ];

    for (const [expected, state] of cases) {
      expect(activeFaultIds(state), `${expected} should be the only fault`).toEqual([expected]);
    }
  });

  it("several mistakes raise several faults", () => {
    const state = reduceAll([
      { t: "peelEpidermis", surface: "outer" },
      { t: "placeSpecimen" },
      { t: "addStain", drops: 9 },
      { t: "placeCoverslip", method: "drop" },
      { t: "mountSlide" },
    ]);
    expect(activeFaultIds(state).sort()).toEqual(
      [
        "air-bubbles",
        "drifting-coverslip",
        "dry-mount",
        "no-goggles",
        "over-stained",
        "too-thick",
      ].sort(),
    );
  });
});

describe("the fault ids match the authored content (D50)", () => {
  const practical = rawContent.practicals.find((entry) => entry.id === "bio-rp-1");

  it("finds the practical", () => {
    expect(practical).toBeDefined();
  });

  it("has exactly the same nine ids, in the same order", () => {
    // One source, three consumers. If either side is renamed this fails, rather than
    // the simulation quietly decoupling from what the exam questions ask about.
    expect(practical!.faults.map((fault) => fault.id)).toEqual([...FAULT_IDS]);
  });

  it("agrees about which fault ends the run", () => {
    const fatal = practical!.faults.filter((fault) => fault.fatal).map((fault) => fault.id);
    expect(fatal).toEqual(["cracked-slide"]);
  });
});

describe("action descriptions", () => {
  it("describes every action type without falling through", () => {
    const samples: MicroscopeAction[] = [
      { t: "wearGoggles" },
      { t: "pipetteWater" },
      { t: "peelEpidermis", surface: "inner" },
      { t: "placeSpecimen" },
      { t: "flattenSpecimen" },
      { t: "addStain", drops: 2 },
      { t: "addStain", drops: 0 },
      { t: "addStain", drops: 1 },
      { t: "placeCoverslip", method: "drop" },
      { t: "placeCoverslip", method: "lowerWithNeedle" },
      { t: "blotExcess" },
      { t: "mountSlide" },
      { t: "selectObjective", total: 100 },
      { t: "coarseFocus", delta: -5, viewing: "eyepiece" },
      { t: "fineFocus", delta: 2 },
      { t: "setIris", value: 0.5 },
      { t: "panStage", dx: 1, dy: 1 },
      { t: "drawStroke", stroke: { points: [] } },
      { t: "undoStroke" },
      { t: "placeLabel", id: "cell-wall", at: { x: 0, y: 0 }, target: { x: 1, y: 1 } },
      { t: "removeLabel", id: "cell-wall" },
      { t: "calibrateGraticule", divisions: 90, micrometres: 240 },
      { t: "readGraticule", divisions: 90 },
      { t: "measureDrawing", lengthMm: 120 },
      { t: "submitMagnification", value: 500 },
      { t: "freshSlide" },
    ];

    for (const action of samples) {
      const description = describeAction(action);
      expect(description, action.t).not.toBe("Did something");
      expect(description.length).toBeGreaterThan(3);
    }
  });

  it("assigns every action to a phase", () => {
    for (const action of Object.keys(PHASE_OF)) {
      expect(PHASE_OF[action as keyof typeof PHASE_OF]).toBeTruthy();
    }
  });

  it("says which way the coarse focus was turned and where the eye was", () => {
    expect(describeAction({ t: "coarseFocus", delta: -5, viewing: "eyepiece" })).toBe(
      "Turned the coarse focus down while looking down the eyepiece",
    );
    expect(describeAction({ t: "coarseFocus", delta: 5, viewing: "side" })).toBe(
      "Turned the coarse focus up while looking from the side",
    );
  });
});

describe("every step of AQA's student sheet can actually be carried out", () => {
  const practical = rawContent.practicals.find((entry) => entry.id === "bio-rp-1")!;

  it("maps every authored method step, and no step that does not exist", () => {
    // Adding a step to the content without deciding how a student performs it is how a
    // simulation quietly becomes a different practical from the one being examined.
    expect(METHOD_ACTIONS.map((mapping) => mapping.n)).toEqual(
      practical.method.map((step) => step.n),
    );
  });

  it("gives all twenty steps a way to be done", () => {
    expect(practical.method).toHaveLength(20);

    for (const mapping of METHOD_ACTIONS) {
      const performable = mapping.actions.length > 0;
      expect(
        performable || mapping.foldedInto !== undefined,
        `step ${mapping.n} can neither be performed nor explains why not`,
      ).toBe(true);
    }
  });

  it("explains the one step that has no action of its own", () => {
    const folded = METHOD_ACTIONS.filter((mapping) => mapping.actions.length === 0);
    expect(folded).toHaveLength(1);
    expect(folded[0].n).toBe(3);
    expect(folded[0].foldedInto?.step).toBe(4);
    expect(folded[0].foldedInto?.reason.length).toBeGreaterThan(40);
  });

  it("names only actions the reducer really accepts", () => {
    const known = new Set(Object.keys(PHASE_OF));
    for (const mapping of METHOD_ACTIONS) {
      for (const action of mapping.actions) {
        expect(known.has(action), `step ${mapping.n} names unknown action ${action}`).toBe(
          true,
        );
      }
    }
  });

  it("walks the whole sheet start to finish without the bench refusing a step", () => {
    const wholeMethod: MicroscopeAction[] = [
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
      { t: "coarseFocus", delta: -100, viewing: "side" },
      { t: "coarseFocus", delta: 480, viewing: "eyepiece" },
      { t: "panStage", dx: 120, dy: 0 },
      { t: "selectObjective", total: 100 },
      { t: "fineFocus", delta: 0 },
      { t: "selectObjective", total: 400 },
      { t: "fineFocus", delta: 0 },
      {
        t: "drawStroke",
        stroke: {
          points: [
            { x: 0, y: 0 },
            { x: 10, y: 10 },
          ],
        },
      },
      { t: "placeLabel", id: "nucleus", at: { x: 0, y: 0 }, target: { x: 5, y: 5 } },
      { t: "readGraticule", divisions: 90 },
      { t: "calibrateGraticule", divisions: 90, micrometres: 240 },
      { t: "measureDrawing", lengthMm: 120 },
      { t: "submitMagnification", value: 500 },
    ];

    let state = initialBench();
    for (const [index, action] of wholeMethod.entries()) {
      const next = reduce(state, action);
      expect(next, `action ${index + 1} (${action.t}) was refused`).not.toBe(state);
      state = next;
    }

    expect(activeFaultIds(state)).toEqual([]);
    expect(state.ended).toBeNull();
  });

  it("allows the steps out of order too, so a student can double back", () => {
    // Blotting after mounting, and staining is simply too late once covered.
    const state = reduceAll([
      { t: "pipetteWater" },
      { t: "peelEpidermis", surface: "inner" },
      { t: "placeSpecimen" },
      { t: "wearGoggles" },
      { t: "flattenSpecimen" },
      { t: "addStain", drops: 2 },
      { t: "placeCoverslip", method: "lowerWithNeedle" },
      { t: "mountSlide" },
      { t: "blotExcess" },
    ]);
    expect(state.slide.blotted).toBe(true);
    expect(activeFaultIds(state)).toEqual([]);
  });
});
