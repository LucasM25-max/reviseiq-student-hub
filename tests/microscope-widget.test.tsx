/**
 * The microscope island, as the server renders it.
 *
 * The simulation's behaviour is tested against the reducer, which is where it lives.
 * What is left for this file is everything that is a property of the *markup*: that the
 * field of view has a text equivalent, that no interaction is mouse-only, and that the
 * bench offers the wrong technique alongside the right one.
 *
 * `renderToStaticMarkup` is the first paint a student on a school laptop gets, so it is
 * also the honest test of whether the widget exists before hydration.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FieldOfView } from "@/components/content/widgets/microscope-practical/field-of-view";
import { MicroscopePracticalWidget } from "@/components/content/widgets/microscope-practical";
import type { MicroscopeAction } from "@/lib/practicals/microscope/actions";
import { reduceAll } from "@/lib/practicals/microscope/reduce";
import { microscopePracticalConfigSchema } from "@/lib/widgets/schemas";

const config = (overrides: Record<string, unknown> = {}) =>
  microscopePracticalConfigSchema.parse({
    practicalId: "bio-rp-1",
    specimen: "onion-epidermis",
    ...overrides,
  });

const markup = (overrides: Record<string, unknown> = {}) =>
  renderToStaticMarkup(<MicroscopePracticalWidget config={config(overrides)} />);

describe("the bench renders before any JavaScript runs", () => {
  it("shows the practical and its four stages", () => {
    const html = markup();
    expect(html).toContain("Required practical");
    for (const stage of [
      "Prepare the slide",
      "Find the cells",
      "Draw what you see",
      "Measure",
    ]) {
      expect(html, stage).toContain(stage);
    }
  });

  it("renders real controls, not a hydration placeholder", () => {
    expect(markup()).toMatch(/<button\b/);
  });

  it("carries the method in a closed answer key, for anyone whose script never arrives", () => {
    const html = markup();
    expect(html).toContain("<details");
    expect(html).not.toMatch(/<details[^>]*\sopen/);
    expect(html).toContain("inner");
  });

  it("honours a config that asks for only part of the practical", () => {
    const html = markup({ phases: ["draw"] });
    expect(html).toContain("Draw what you see");
    expect(html).not.toContain("Prepare the slide");
  });
});

describe("the field of view has a text equivalent", () => {
  it("describes what is down the eyepiece in words", () => {
    const html = markup();
    expect(html).toContain("Down the eyepiece:");
    // Nothing is mounted at first, and the description says so rather than going quiet.
    expect(html).toContain("No slide on the stage");
  });

  it("puts the description in a live region so changes are announced", () => {
    expect(markup()).toMatch(/aria-live="polite"/);
  });

  it("hides the decorative picture from assistive technology", () => {
    // The SVG is a duplicate of the description; announcing both would be noise.
    expect(markup()).toMatch(/aria-hidden="true"/);
  });
});

describe("nothing is mouse-only (D48)", () => {
  it("drives every bench action from a button", () => {
    const html = markup();
    for (const action of [
      "Put on goggles",
      "Add a drop of water",
      "Peel from the inner surface",
      "Place the peel",
      "Add one drop",
      "Blot with filter paper",
      "Clip the slide onto the stage",
    ]) {
      expect(html, action).toContain(action);
    }
  });

  it("uses no drag-and-drop anywhere", () => {
    expect(markup()).not.toContain("draggable");
  });

  it("labels the focus and iris sliders, and gives them spoken values", () => {
    const html = markup({ phases: ["find"] });
    expect(html).toContain("Fine focus");
    expect(html).toContain("Condenser iris");
    expect(html).toMatch(/aria-valuetext=/);
  });

  it("offers guided labelling as an alternative to the drawing canvas", () => {
    const html = markup({ phases: ["draw"] });
    expect(html).toContain("Cannot draw with a pointer?");
    expect(html).toContain("worth the same");
  });

  it("can be configured to lead with guided labelling instead", () => {
    const html = markup({ phases: ["draw"], drawing: "guided-labelling" });
    expect(html).toContain("Label Nucleus");
    expect(html).not.toContain("Undo last line");
  });
});

describe("the wrong technique is offered, not hidden", () => {
  it("lets the student drop the coverslip flat or lower it properly", () => {
    const html = markup();
    expect(html).toContain("Lower it slowly with a needle");
    expect(html).toContain("Drop it flat");
  });

  it("offers both surfaces of the onion", () => {
    const html = markup();
    expect(html).toContain("Peel from the inner surface");
    expect(html).toContain("Peel from the outer surface");
  });

  it("offers the blind descent that cracks the slide", () => {
    const html = markup({ phases: ["find"] });
    expect(html).toContain("Down, at the eyepiece");
    expect(html).toContain("Down, watching from the side");
  });
});

describe("the measuring stage", () => {
  it("states the calibration the student is meant to use", () => {
    const html = markup({ phases: ["measure"] });
    expect(html).toContain("90 divisions measure 240");
  });

  it("asks for the drawing's own length, which is the step students skip", () => {
    expect(markup({ phases: ["measure"] })).toContain("millimetres");
  });
});

// ---------------------------------------------------------------------------
// The field of view as markup
// ---------------------------------------------------------------------------

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
];

const field = (actions: MicroscopeAction[]) =>
  renderToStaticMarkup(<FieldOfView state={reduceAll(actions)} />);

const swapAction = (type: MicroscopeAction["t"], replacement: MicroscopeAction) =>
  PERFECT.map((action) => (action.t === type ? replacement : action));

describe("the field of view stays cheap to render", () => {
  it("draws the tissue as one repeating pattern, not one node per cell", () => {
    // A real field at ×40 holds about fifteen cells across and fifty down. Emitting
    // those individually cost 1,334 SVG nodes and 240 KB of markup for one widget,
    // re-rendered on every turn of the focus knob.
    const html = field(PERFECT);
    expect(html).toContain("<pattern");
    expect((html.match(/<(rect|ellipse|circle|path)/g) ?? []).length).toBeLessThan(25);
    expect(html.length).toBeLessThan(6000);
  });

  it("stays small at every magnification", () => {
    for (const total of [40, 100, 400] as const) {
      const html = field([...PERFECT, { t: "selectObjective", total }]);
      expect(html.length, `×${total}`).toBeLessThan(6000);
    }
  });

  it("emits no NaN, Infinity or undefined into an SVG attribute", () => {
    // An SVG silently drops the whole shape for any one of these.
    for (const actions of [
      [],
      PERFECT,
      [...PERFECT, { t: "panStage", dx: 9999, dy: -9999 } as MicroscopeAction],
      [...PERFECT, { t: "setIris", value: 0 } as MicroscopeAction],
    ]) {
      expect(field(actions as MicroscopeAction[])).not.toMatch(/NaN|Infinity|undefined/);
    }
  });

  it("scopes its filter ids, so two on a page cannot share one blur", () => {
    const first = field(PERFECT);
    const blurIds = [...first.matchAll(/id="(ms-blur-[^"]+)"/g)].map((match) => match[1]);
    expect(blurIds).toHaveLength(1);
    expect(first).toContain(`url(#${blurIds[0]})`);
  });
});

describe("the faults are visible, not just described", () => {
  it("washes an over-stained slide dark rather than pale", () => {
    const html = field(swapAction("addStain", { t: "addStain", drops: 9 }));
    expect(html).toContain("#6b3410");
    expect(html).toContain("A dark orange-brown block");
  });

  it("pulls the contents away from the wall on a dry mount", () => {
    // The content promises the cells "shrivel, the edges darken, and the specimen curls
    // away". A slightly duller fill showed none of that.
    const dry = field(PERFECT.filter((action) => action.t !== "pipetteWater"));
    expect(dry).toContain("#5d3a12");
    expect(dry).toContain("shrivelled");
    expect(field(PERFECT)).not.toContain("#5d3a12");
  });

  it("leaves a thick specimen permanently soft, however well it is focused", () => {
    const thick = field(swapAction("peelEpidermis", { t: "peelEpidermis", surface: "outer" }));
    const blur = /stdDeviation="([\d.]+)"/.exec(thick);
    expect(blur).not.toBeNull();
    expect(Number(blur![1])).toBeGreaterThan(1);
    expect(thick).toContain("nearly focused");
  });

  it("draws bubbles on a dropped coverslip", () => {
    const html = field(swapAction("placeCoverslip", { t: "placeCoverslip", method: "drop" }));
    expect(html).toContain("air bubble");
  });

  it("shows the crack and explains it, rather than going blank", () => {
    const html = field([
      ...PERFECT,
      { t: "coarseFocus", delta: 500, viewing: "side" },
      { t: "coarseFocus", delta: -5, viewing: "eyepiece" },
    ]);
    expect(html).toContain("cracked");
    // No tissue is painted over a broken slide, and the pattern is not even defined.
    expect(html).not.toContain("<pattern");
    expect(html).not.toMatch(/fill="url\(#ms-cells/);
  });

  it("hides the nuclei at low power, where they could not be resolved anyway", () => {
    const low = field([...PERFECT, { t: "selectObjective", total: 40 }]);
    const high = field([...PERFECT, { t: "selectObjective", total: 400 }]);
    expect((low.match(/<ellipse/g) ?? []).length).toBe(0);
    expect((high.match(/<ellipse/g) ?? []).length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Static accessibility audit
// ---------------------------------------------------------------------------

/**
 * Not a substitute for axe, which needs a real browser this environment cannot provide.
 * It checks the same classes of defect that are decidable from server markup, which is
 * most of the ones a widget like this actually gets wrong.
 */
describe("accessibility of the rendered markup", () => {
  const html = () => markup();

  it("gives every form control a label", () => {
    const rendered = renderToStaticMarkup(
      <>
        <MicroscopePracticalWidget config={config({ phases: ["find"] })} />
        <MicroscopePracticalWidget config={config({ phases: ["measure"] })} />
      </>,
    );

    const ids = [...rendered.matchAll(/<(?:input|select|textarea)[^>]*\sid="([^"]+)"/g)].map(
      (match) => match[1],
    );
    const labelled = new Set(
      [...rendered.matchAll(/<label[^>]*\sfor="([^"]+)"/g)].map((match) => match[1]),
    );

    expect(ids.length).toBeGreaterThan(2);
    for (const id of ids) {
      expect(labelled.has(id), `control #${id} has no label`).toBe(true);
    }
  });

  it("leaves no control without an accessible name", () => {
    const withoutName = [...html().matchAll(/<(?:input|select|textarea)([^>]*)>/g)].filter(
      (match) => !/\sid="/.test(match[1]) && !/aria-label/.test(match[1]),
    );
    expect(withoutName).toHaveLength(0);
  });

  it("gives every button visible text", () => {
    const empty = [...html().matchAll(/<button[^>]*>\s*<\/button>/g)];
    expect(empty).toHaveLength(0);
  });

  it("uses no duplicate ids", () => {
    // Two of these on a page shared their SVG filter ids until `useId` was added, so
    // each was rendered with the other's focus.
    const rendered = renderToStaticMarkup(
      <>
        <MicroscopePracticalWidget config={config()} />
        <MicroscopePracticalWidget config={config()} />
      </>,
    );
    const ids = [...rendered.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
    expect(ids.length).toBeGreaterThan(4);
    expect(new Set(ids).size, "duplicate id in the rendered markup").toBe(ids.length);
  });

  it("hides nothing focusable behind aria-hidden", () => {
    // A focusable element inside an aria-hidden subtree is reachable by keyboard but
    // invisible to a screen reader, which is the worst of both. Only two things here
    // are hidden: the decorative tick and the picture of the field of view.
    const rendered = html();

    const hiddenTags = [...rendered.matchAll(/<(\w+)[^>]*aria-hidden="true"/g)].map(
      (match) => match[1],
    );
    expect(hiddenTags.length).toBeGreaterThan(0);
    expect(new Set(hiddenTags)).toEqual(new Set(["span", "svg"]));

    for (const svg of rendered.matchAll(/<svg[^>]*aria-hidden="true"[\s\S]*?<\/svg>/g)) {
      expect(svg[0]).not.toMatch(/<(button|input|select|textarea|a\s)/);
    }
  });

  it("puts each step's state in text, whether it is done or not", () => {
    // The ○ / ✓ is decorative. Announcing only "done" left an outstanding step
    // indistinguishable from one with no marker at all.
    const rendered = html();
    expect(rendered).toContain("— not done yet");
    expect(renderToStaticMarkup(<MicroscopePracticalWidget config={config()} />)).toContain(
      "sr-only",
    );
  });

  it("marks the selected stage for assistive technology, not just visually", () => {
    expect(html()).toMatch(/role="tab"/);
    expect(html()).toMatch(/aria-selected="true"/);
  });
});
