/**
 * Diagram tests.
 *
 * The hand-built SVGs (D18) are the one part of the content spine that cannot be
 * checked by reading it: a label can be perfectly valid markup and still be drawn off
 * the edge of the canvas. There is no headless browser available here, so instead of
 * screenshotting we render each diagram to static markup and measure it.
 *
 * This caught a real bug: the first version of the animal and plant cells scattered
 * labels around the outside of the shape, and seven of the thirteen ran past the
 * viewBox and were clipped in the browser.
 *
 * The width model is deliberately conservative. It over-estimates rather than
 * under-estimates, so a label that passes here has margin in a real font.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { Diagram, diagramComponentIds } from "@/components/content/diagram";
import { DIAGRAMS, diagramIds, getDiagram } from "@/lib/content/diagrams";

/**
 * Upper-bound width of a string at a given font size, in user units.
 *
 * 0.62em per character is wider than any glyph in a normal sans-serif run of text
 * (a lowercase "l" is ~0.22em, "m" ~0.83em, and the average across English prose is
 * ~0.5em), so this errs towards reporting a clip that would not happen rather than
 * missing one that would.
 */
const CHAR_EM = 0.62;
const widthOf = (text: string, fontSize: number) => text.length * fontSize * CHAR_EM;

type Rendered = {
  x: number;
  y: number;
  text: string;
  anchor: "start" | "middle" | "end";
  fontSize: number;
};

/** Pull every <text> out of rendered SVG markup, with the bits needed to measure it. */
function textNodes(markup: string): Rendered[] {
  const nodes: Rendered[] = [];
  const pattern = /<text\b([^>]*)>([\s\S]*?)<\/text>/g;

  for (const match of markup.matchAll(pattern)) {
    const [, attributes, inner] = match;

    const attribute = (name: string) =>
      new RegExp(`\\b${name}="([^"]*)"`).exec(attributes)?.[1] ?? "";

    // Strip nested <tspan>s and decode the few entities React emits, so the measured
    // string is what a reader actually sees — "A — Cell wall", not the raw markup.
    const text = inner
      .replace(/<[^>]+>/g, "")
      .replace(/&#x27;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .trim();

    // Font size comes from a Tailwind arbitrary-value class such as `text-[13px]`.
    const fontSize = Number(/text-\[(\d+(?:\.\d+)?)px\]/.exec(attribute("class"))?.[1] ?? 13);

    const anchorAttribute = attribute("text-anchor");
    const anchor =
      anchorAttribute === "middle" || anchorAttribute === "end" ? anchorAttribute : "start";

    nodes.push({
      x: Number(attribute("x")),
      y: Number(attribute("y")),
      text,
      anchor,
      fontSize,
    });
  }

  return nodes;
}

const render = (diagramId: string, props: Record<string, unknown> = {}) =>
  renderToStaticMarkup(createElement(Diagram, { diagramId, ...props }));

const viewBoxOf = (diagramId: string) => {
  const [minX, minY, width, height] = (getDiagram(diagramId)?.viewBox ?? "")
    .split(/\s+/)
    .map(Number);
  return { minX, minY, width, height };
};

describe("diagram registry and components agree", () => {
  it("every registry entry has a component and every component is registered", () => {
    expect(diagramComponentIds().sort()).toEqual(diagramIds().sort());
  });

  it("every diagram declares a title, a description and a four-number viewBox", () => {
    for (const meta of DIAGRAMS) {
      expect(meta.title.length, meta.id).toBeGreaterThan(0);
      expect(meta.description.length, meta.id).toBeGreaterThan(20);
      expect(
        meta.viewBox.split(/\s+/).map(Number).filter(Number.isFinite),
        meta.id,
      ).toHaveLength(4);
      expect(meta.structures.length, meta.id).toBeGreaterThan(0);
      // Structure keys must be unique within a diagram, or `letters` is ambiguous.
      expect(new Set(meta.structures.map((s) => s.key)).size, meta.id).toBe(
        meta.structures.length,
      );
    }
  });
});

describe("labels stay inside the canvas", () => {
  for (const diagramId of diagramIds()) {
    it(`${diagramId} — no label is clipped with labels="all"`, () => {
      const { minX, minY, width, height } = viewBoxOf(diagramId);
      const nodes = textNodes(render(diagramId));
      expect(nodes.length, "expected some labels").toBeGreaterThan(0);

      for (const node of nodes) {
        const w = widthOf(node.text, node.fontSize);
        const left =
          node.anchor === "end"
            ? node.x - w
            : node.anchor === "middle"
              ? node.x - w / 2
              : node.x;
        const right = left + w;

        expect(left, `"${node.text}" overflows the left edge`).toBeGreaterThanOrEqual(minX);
        expect(right, `"${node.text}" overflows the right edge`).toBeLessThanOrEqual(
          minX + width,
        );
        // A baseline at y needs roughly 0.8em above it and 0.2em below.
        expect(
          node.y - node.fontSize * 0.8,
          `"${node.text}" overflows the top`,
        ).toBeGreaterThanOrEqual(minY);
        expect(
          node.y + node.fontSize * 0.2,
          `"${node.text}" overflows the bottom`,
        ).toBeLessThanOrEqual(minY + height);
      }
    });
  }

  it("a fully lettered diagram still fits", () => {
    const letters = getDiagram("bio-plant-cell")!.structures.map((structure) => structure.key);
    const { minX, width } = viewBoxOf("bio-plant-cell");
    const nodes = textNodes(render("bio-plant-cell", { letters }));

    expect(nodes).toHaveLength(letters.length);
    for (const node of nodes) {
      expect(
        node.x + widthOf(node.text, node.fontSize),
        `"${node.text}" overflows once lettered`,
      ).toBeLessThanOrEqual(minX + width);
    }
  });
});

describe("label filtering", () => {
  it('labels="none" draws the shapes but no structure labels', () => {
    const markup = render("bio-animal-cell", { labels: "none" });
    expect(markup).toContain("<ellipse");
    // <title> and <desc> are not <text>, so nothing should be left.
    expect(textNodes(markup)).toHaveLength(0);
  });

  it("an explicit list draws exactly those labels", () => {
    const nodes = textNodes(render("bio-animal-cell", { labels: ["nucleus", "cytoplasm"] }));
    expect(nodes.map((node) => node.text).sort()).toEqual(["Cytoplasm", "Nucleus"]);
  });

  it("letters are assigned A, B, C in the order given, not in drawing order", () => {
    // cytoplasm is drawn last and cell-membrane first, so if lettering followed the
    // drawing order these would come out reversed.
    const nodes = textNodes(
      render("bio-animal-cell", {
        labels: "none",
        letters: ["cytoplasm", "nucleus", "cell-membrane"],
      }),
    );

    // The label column runs top to bottom: cell membrane (C), nucleus (B), cytoplasm (A).
    const inDrawingOrder = [...nodes].sort((a, b) => a.y - b.y).map((node) => node.text);
    expect(inDrawingOrder).toEqual(["C", "B", "A"]);
  });

  /**
   * Regression test for a real bug. q03 asks "Name the structures labelled A, B and C"
   * over this diagram; the first implementation rendered lettered structures as
   * "A — Cell wall", which printed the answer on the question paper.
   */
  it("a lettered structure shows its letter and never its name", () => {
    const letters = ["cell-wall", "permanent-vacuole", "chloroplast"];
    const names = ["Cell wall", "Permanent vacuole", "Chloroplasts"];

    for (const labels of ["all", "none", letters] as const) {
      const markup = render("bio-plant-cell", { labels, letters });
      const drawn = textNodes(markup).map((node) => node.text);

      expect(drawn, `letters missing with labels=${JSON.stringify(labels)}`).toEqual(
        expect.arrayContaining(["A", "B", "C"]),
      );
      for (const name of names) {
        expect(
          drawn,
          `"${name}" leaked the answer with labels=${JSON.stringify(labels)}`,
        ).not.toContain(name);
      }
    }
  });

  it("lettering one structure leaves the others named when labels=all", () => {
    const drawn = textNodes(render("bio-animal-cell", { letters: ["nucleus"] })).map(
      (node) => node.text,
    );

    expect(drawn).toContain("A");
    expect(drawn).not.toContain("Nucleus");
    // Everything else is still named.
    expect(drawn).toEqual(expect.arrayContaining(["Cell membrane", "Cytoplasm", "Ribosomes"]));
  });

  it("a lettered structure is drawn even when labels excludes it", () => {
    const drawn = textNodes(
      render("bio-animal-cell", { labels: ["cytoplasm"], letters: ["nucleus"] }),
    ).map((node) => node.text);

    expect(drawn.sort()).toEqual(["A", "Cytoplasm"]);
  });
});

describe("accessibility", () => {
  for (const diagramId of diagramIds()) {
    it(`${diagramId} is announced as a labelled image`, () => {
      const markup = render(diagramId);
      const meta = getDiagram(diagramId)!;

      expect(markup).toContain('role="img"');
      expect(markup).toContain(`<title id="diagram-${diagramId}-title">`);
      expect(markup).toContain(`<desc id="diagram-${diagramId}-desc">`);
      expect(markup).toContain(
        `aria-labelledby="diagram-${diagramId}-title diagram-${diagramId}-desc"`,
      );
      expect(markup).toContain(meta.title);
    });
  }

  it("an unknown diagram id degrades to a visible note instead of a blank space", () => {
    const markup = render("bio-not-a-real-diagram");
    expect(markup).toContain("is not available");
    expect(markup).not.toContain("<svg");
  });
});

describe("the scale strip is a correct logarithmic axis", () => {
  it("spans 10 nm to 100 µm and names every structure it plots", () => {
    const nodes = textNodes(render("bio-cell-scale-strip")).map((node) => node.text);

    for (const tick of ["10 nm", "100 nm", "1 µm", "10 µm", "100 µm"]) {
      expect(nodes, `missing tick ${tick}`).toContain(tick);
    }
    for (const band of ["Ribosome", "Mitochondrion", "Chloroplast", "Nucleus", "Plant cell"]) {
      expect(nodes, `missing band ${band}`).toContain(band);
    }
    expect(nodes).toContain("Each step along the axis is ten times larger");
  });

  it("plots each decade the same distance apart", () => {
    const markup = render("bio-cell-scale-strip");
    const ticks = textNodes(markup)
      .filter((node) => /^(10 nm|100 nm|1 µm|10 µm|100 µm)$/.test(node.text))
      .map((node) => node.x);

    expect(ticks).toHaveLength(5);
    const gaps = ticks.slice(1).map((x, index) => x - ticks[index]);
    for (const gap of gaps) expect(gap).toBeCloseTo(gaps[0], 6);
    // Increasing left to right.
    expect(gaps[0]).toBeGreaterThan(0);
  });
});
