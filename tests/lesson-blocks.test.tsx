/**
 * Lesson block rendering.
 *
 * These are the checks that need the blocks actually rendered rather than merely
 * parsed: heading order, that no block type silently disappears, and that the recap
 * rule and the unbuilt-widget placeholder behave the way D39 and D40 say they do.
 *
 * Rendered with `renderToStaticMarkup`, which is what the server does, so what is
 * asserted here is what is sent to the browser.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LessonBlocks } from "@/components/content/lesson-blocks";
import { Markdown } from "@/components/content/markdown";
import { loadContent } from "@/lib/content/registry";
import type { LessonBlock } from "@/lib/content/schema";

const result = loadContent();
if (!result.ok) throw new Error("content failed to load — see tests/content.test.ts");
const content = result.content;

const render = (blocks: LessonBlock[]) =>
  renderToStaticMarkup(<LessonBlocks blocks={blocks} />);

/** Heading levels in document order. */
const headingLevels = (markup: string) =>
  [...markup.matchAll(/<h([1-6])\b/g)].map((match) => Number(match[1]));

describe("heading order", () => {
  it("never skips a level in any shipped lesson", () => {
    for (const lesson of content.lessons) {
      const levels = headingLevels(render(lesson.blocks));

      // The page supplies the h1, so blocks start at h2 at the shallowest.
      for (const level of levels) {
        expect(
          level,
          `${lesson.id} uses an h${level} inside a lesson body`,
        ).toBeGreaterThanOrEqual(2);
      }

      // And each heading is at most one level deeper than the one before it.
      let previous = 1;
      for (const level of levels) {
        expect(level, `${lesson.id} jumps from h${previous} to h${level}`).toBeLessThanOrEqual(
          previous + 1,
        );
        previous = level;
      }
    }
  });

  it("gives a worked example a real heading, not just styled text", () => {
    const markup = render([
      { type: "example", title: "Estimating a cell", steps: ["One.", "Two."] } as LessonBlock,
    ]);
    expect(headingLevels(markup)).toEqual([2]);
    expect(markup).toContain("Estimating a cell");
  });
});

describe("every block type renders something a student can see", () => {
  const samples: [string, LessonBlock][] = [
    ["prose", { type: "prose", body: "Cells are small." } as LessonBlock],
    ["keyIdea", { type: "keyIdea", body: "This is the key idea." } as LessonBlock],
    [
      "definition",
      { type: "definition", term: "Nucleus", body: "Controls the cell." } as LessonBlock,
    ],
    ["example", { type: "example", title: "A title", steps: ["Step one."] } as LessonBlock],
    [
      "diagram",
      { type: "diagram", diagramId: "bio-animal-cell", labels: "all" } as LessonBlock,
    ],
    [
      "misconception",
      {
        type: "misconception",
        claim: "A wrong thing.",
        correction: "The right thing.",
      } as LessonBlock,
    ],
    ["summary", { type: "summary", body: "To sum up." } as LessonBlock],
    [
      "check",
      {
        type: "check",
        prompt: "Which one?",
        options: [
          { key: "A", text: "This one" },
          { key: "B", text: "Not this one" },
        ],
        correctKey: "A",
        explanation: "Because.",
      } as LessonBlock,
    ],
    ["widget", { type: "widget", widgetId: "card-sort" } as LessonBlock],
  ];

  for (const [name, block] of samples) {
    it(`${name} produces visible output`, () => {
      const markup = render([block]);
      // Strip tags: something readable must survive, not just an empty wrapper.
      const visible = markup.replace(/<[^>]+>/g, "").trim();
      expect(visible.length, `${name} rendered nothing`).toBeGreaterThan(0);
    });
  }

  it("covers every block type the schema allows", () => {
    const rendered = new Set(samples.map(([name]) => name));
    const used = new Set(content.lessons.flatMap((l) => l.blocks).map((b) => b.type));
    // specPointRef is metadata on a block, not a block type, so the union is these nine.
    expect(rendered.size).toBe(9);
    for (const type of used) expect(rendered, `${type} is unrendered`).toContain(type);
  });
});

describe("D39 — prior-stage material is collapsible, never hidden", () => {
  it("wraps a recap block in an open disclosure", () => {
    const markup = render([
      { type: "prose", body: "Earlier study.", recap: true } as LessonBlock,
    ]);
    expect(markup).toContain("<details");
    expect(markup).toContain("open");
    expect(markup).toContain("Recap from earlier study");
    // Open by default: the content is present for everyone, just foldable.
    expect(markup).toContain("Earlier study.");
  });

  it("leaves a normal block undecorated", () => {
    const markup = render([{ type: "prose", body: "New material." } as LessonBlock]);
    expect(markup).not.toContain("<details");
  });
});

describe("D40 — an unbuilt widget is honest, not invisible", () => {
  it("names the engine and the phase that builds it", () => {
    const markup = render([
      { type: "widget", widgetId: "microscope-practical" } as LessonBlock,
    ]);
    expect(markup).toContain("Microscope practical");
    expect(markup).toContain("Phase 4b");
  });

  it("degrades to the raw id if the widget is somehow unregistered", () => {
    const markup = render([{ type: "widget", widgetId: "not-a-widget" } as LessonBlock]);
    expect(markup).toContain("not-a-widget");
    expect(markup).toContain("planned");
  });
});

describe("check blocks", () => {
  it("expose the answer without JavaScript", () => {
    const block = content.lessons
      .flatMap((lesson) => lesson.blocks)
      .find((candidate) => candidate.type === "check");
    expect(block, "no check block in the shipped content").toBeDefined();

    const markup = render([block!]);
    expect(markup).toContain("Show the answer");
    expect(markup).toContain("<details");
    // Every option is present as a radio, so the block is readable and answerable.
    expect(markup).toContain('type="radio"');
  });
});

/**
 * Heading depth follows the container, not the author.
 *
 * An author writes `##` for "a section inside this body" wherever that body ends up.
 * The container says how deep it sits, and the renderer shifts the whole run to match,
 * so the page outline has no holes in it. This is what stopped lesson 2's `###`
 * sub-headings rendering as `<h3>` directly under the page's `<h1>`.
 */
describe("Markdown headingOffset", () => {
  const body = "## A section\n\nProse.\n\n### A sub-section\n\nMore prose.";
  const render = (offset: number) =>
    renderToStaticMarkup(<Markdown headingOffset={offset}>{body}</Markdown>);

  it("renders ## as h2 in a lesson block, which sits directly under the page h1", () => {
    expect(headingLevels(render(0))).toEqual([2, 3]);
  });

  it("renders ## as h3 in a note section, which already sits under the section h2", () => {
    expect(headingLevels(render(1))).toEqual([3, 4]);
  });

  it("keeps the visual size tied to the level the author wrote", () => {
    // "## A section" is the author's top-level heading, so it looks the same whether it
    // lands as h2 or h3 — only the tag changes.
    const atZero = /<h2 class="([^"]*)"/.exec(render(0))?.[1];
    const atOne = /<h3 class="([^"]*)"/.exec(render(1))?.[1];
    expect(atZero).toBe(atOne);
  });

  it("never emits an h1, even from a stray '#'", () => {
    // The schema rejects "#", but the renderer is defensive too: a page has one h1.
    const markup = renderToStaticMarkup(<Markdown>{"# Stray\n\nProse."}</Markdown>);
    expect(headingLevels(markup)).toEqual([2]);
  });

  it("clamps rather than emitting an h7", () => {
    const markup = renderToStaticMarkup(
      <Markdown headingOffset={2}>{"###### Deepest"}</Markdown>,
    );
    expect(headingLevels(markup)).toEqual([6]);
  });

  it("every shipped note section body stays within h3–h6 once offset", () => {
    for (const page of content.notes) {
      for (const section of page.sections) {
        const levels = headingLevels(
          renderToStaticMarkup(<Markdown headingOffset={1}>{section.body}</Markdown>),
        );
        for (const level of levels) {
          expect(level, `${section.slug} rendered an h${level}`).toBeGreaterThanOrEqual(3);
        }
      }
    }
  });
});
