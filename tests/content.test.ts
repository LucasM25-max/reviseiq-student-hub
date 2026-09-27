import { describe, expect, it } from "vitest";

import { analyseCoverage, GATES } from "@/lib/content/coverage";
import { DIAGRAMS, getDiagram } from "@/lib/content/diagrams";
import { loadContent } from "@/lib/content/registry";
import { lessonBlockSchema, noteSectionSchema } from "@/lib/content/schema";
import { WIDGETS, widgetIds } from "@/lib/content/widgets";

/**
 * The real content, held to the standard it will be marked against.
 *
 * `content:validate` already runs these checks in CI. Doing it here as well means a
 * failure names the specific property that broke, in the test runner, next to every
 * other test — rather than only appearing as a red step in a separate CI job.
 */

const result = loadContent();

describe("the shipped content", () => {
  it("parses and cross-references cleanly", () => {
    if (!result.ok) {
      // Fail with the actual problems rather than a bare `false`.
      expect(result.issues.map((issue) => `${issue.where}: ${issue.message}`)).toEqual([]);
    }
    expect(result.ok).toBe(true);
  });
});

// Everything below needs parsed content; bail loudly rather than cascading failures.
if (!result.ok) throw new Error("content failed to load — see the test above");
const content = result.content;
const report = analyseCoverage(content);

describe("coverage gates", () => {
  it("passes every gate", () => {
    expect(report.errors).toEqual([]);
  });

  it("reports exactly the gaps we have declared, and no others", () => {
    const partial = content.specPoints
      .values()
      .toArray()
      .filter((point) => point.coverage === "PARTIAL")
      .map((point) => point.id)
      .sort();

    // Both are deliberate and documented: plasmids wait for 4.1.1.1, and RP1 is onion
    // only (D48). If a third appears, someone has hidden a gap behind a flag.
    expect(partial).toEqual(["bio-4112-func", "bio-rp-1"]);
  });

  it("gives every declared gap a stated reason", () => {
    for (const point of content.specPoints.values()) {
      if (point.coverage === "PARTIAL") {
        expect(point.blockedBy.length, `${point.id} is PARTIAL with no reason`).toBeGreaterThan(
          0,
        );
      } else {
        expect(point.blockedBy, `${point.id} is FULL but claims to be blocked`).toEqual([]);
      }
    }
  });

  it("has no spec point that nothing teaches or tests", () => {
    const gaps = report.subTopics
      .flatMap((subTopic) => subTopic.specPoints)
      .filter((coverage) => coverage.status === "gap")
      .map((coverage) => coverage.specPoint.id);
    expect(gaps).toEqual([]);
  });
});

describe("Biology 4.1.1 question bank", () => {
  const subTopic = report.subTopics.find((entry) => entry.subTopicId === "aqa-biology-4.1.1");

  it("exists", () => {
    expect(subTopic).toBeDefined();
  });

  it("hits the AO 40/40/20 split within tolerance", () => {
    for (const ao of ["AO1", "AO2", "AO3"] as const) {
      const drift = Math.abs(subTopic!.aoShare[ao] - GATES.aoTarget[ao]);
      expect(drift, `${ao} is ${subTopic!.aoShare[ao]}%`).toBeLessThanOrEqual(
        GATES.aoTolerancePoints,
      );
    }
  });

  it("clears AQA's ≥15% practical mark requirement", () => {
    expect(subTopic!.practicalMarkShare).toBeGreaterThanOrEqual(GATES.minPracticalMarkShare);
  });

  it("offers at least five question types and an extended response", () => {
    expect(subTopic!.questionTypes.length).toBeGreaterThanOrEqual(5);
    expect(subTopic!.extendedCount).toBeGreaterThanOrEqual(1);
  });

  it("totals the marks it claims", () => {
    const summed = content.questions.reduce((total, question) => total + question.marks, 0);
    expect(subTopic!.markTotal).toBe(summed);
  });
});

describe("mark schemes", () => {
  it("awards every mark through an atomic, independently awardable point", () => {
    for (const question of content.questions) {
      for (const point of question.markScheme.points) {
        // AQA mark points are worth one mark each; anything larger is really two points
        // wearing a trench coat, and cannot be awarded independently.
        expect(point.marks, `${question.id} ${point.id} is worth ${point.marks}`).toBe(1);
      }
    }
  });

  it("never leaves a numeric answer without a method mark to fall back on", () => {
    for (const question of content.questions) {
      const numeric = question.markScheme.numericAnswer;
      if (!numeric) continue;
      expect(
        numeric.methodPointIds.length,
        `${question.id} has a tolerance band but no independent method marks (D49)`,
      ).toBeGreaterThan(0);
    }
  });

  it("keeps every numeric tolerance band the right way round and non-degenerate", () => {
    for (const question of content.questions) {
      const numeric = question.markScheme.numericAnswer;
      if (!numeric) continue;
      expect(numeric.accept.min).toBeLessThan(numeric.accept.max);
    }
  });

  it("gives every question a model answer for after marking", () => {
    for (const question of content.questions) {
      expect(
        question.markScheme.modelAnswer,
        `${question.id} has no model answer`,
      ).toBeTruthy();
    }
  });
});

describe("registries", () => {
  it("has a component for every registered diagram and vice versa", async () => {
    const { diagramComponentIds } = await import("@/components/content/diagram");
    expect(diagramComponentIds().sort()).toEqual(DIAGRAMS.map((d) => d.id).sort());
  });

  it("gives every diagram a unique id and unique structure keys", () => {
    const ids = DIAGRAMS.map((diagram) => diagram.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const diagram of DIAGRAMS) {
      const keys = diagram.structures.map((structure) => structure.key);
      expect(new Set(keys).size, `${diagram.id} has duplicate structure keys`).toBe(
        keys.length,
      );
    }
  });

  it("gives every widget a unique, kebab-case id", () => {
    const ids = widgetIds();
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids)
      expect(id, `${id} is not kebab-case`).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("registers exactly the widgets the roadmap promises, and says which phase builds each", () => {
    // Renaming a widget id silently breaks every lesson block that references it, and
    // `plannedPhase` is what the renderer shows the student instead of a broken block.
    expect(widgetIds().sort()).toEqual([
      "card-sort",
      "comparison-table",
      "label-the-diagram",
      "microscope-practical",
      "scale-explorer",
    ]);

    for (const widget of WIDGETS) {
      // Nothing is built yet, so every widget must still name the phase that builds it.
      expect(widget.plannedPhase, `${widget.id} has no planned phase`).toMatch(/^Phase /);
      expect(
        widget.description.length,
        `${widget.id} needs a real description`,
      ).toBeGreaterThan(30);
    }

    // The practical simulation is the one widget that belongs to Phase 4b (D45).
    expect(WIDGETS.find((widget) => widget.id === "microscope-practical")?.plannedPhase).toBe(
      "Phase 4b",
    );
  });

  it("resolves every diagram referenced by a question", () => {
    for (const question of content.questions) {
      const diagramId = question.assets?.diagramId;
      if (!diagramId) continue;
      const diagram = getDiagram(diagramId);
      expect(diagram, `${question.id} references unknown diagram ${diagramId}`).toBeDefined();
      for (const key of question.assets?.diagramLetters ?? []) {
        expect(
          diagram!.structures.some((structure) => structure.key === key),
          `${question.id} letters unknown structure ${key}`,
        ).toBe(true);
      }
    }
  });
});

describe("required practical 1", () => {
  const practical = content.practicals.find((entry) => entry.id === "bio-rp-1");

  it("exists with the nine-row fault table the slice specifies (D50)", () => {
    expect(practical).toBeDefined();
    expect(practical!.faults).toHaveLength(9);
  });

  it("numbers all twenty student-sheet steps consecutively", () => {
    expect(practical!.method).toHaveLength(20);
    expect(practical!.method.map((step) => step.n)).toEqual(
      Array.from({ length: 20 }, (_, index) => index + 1),
    );
  });

  it("gives every fault a trigger, a visible consequence and a reason", () => {
    for (const fault of practical!.faults) {
      expect(fault.trigger.length, `${fault.id} trigger`).toBeGreaterThan(20);
      expect(fault.effect.length, `${fault.id} effect`).toBeGreaterThan(20);
      expect(fault.reason.length, `${fault.id} reason`).toBeGreaterThan(20);
    }
  });

  it("marks exactly one fault as ending the run", () => {
    // Only a cracked slide is unrecoverable; everything else you have to live with,
    // which is the whole point of consequences over warnings.
    const fatal = practical!.faults.filter((fault) => fault.fatal).map((fault) => fault.id);
    expect(fatal).toEqual(["cracked-slide"]);
  });

  it("points every fault's questionIds at questions that exist", () => {
    const ids = new Set(content.questions.map((question) => question.id));
    for (const fault of practical!.faults) {
      for (const questionId of fault.questionIds) {
        expect(ids.has(questionId), `${fault.id} → ${questionId}`).toBe(true);
      }
    }
  });

  it("is declared partial, because it covers plant cells only (D48)", () => {
    expect(practical!.coverage).toBe("PARTIAL");
    expect(practical!.blockedBy.join(" ")).toMatch(/onion/i);
  });
});

/**
 * Heading discipline in content bodies.
 *
 * Lesson and note pages own their own `<h1>`/`<h2>`. A body that starts its own
 * top-level heading breaks the document outline a screen-reader user navigates by, and
 * renders unstyled because the markdown renderer only themes `h3` and `h4`. Blocks and
 * note sections are the structure; headings inside a body are not.
 */
describe("content bodies do not invent their own top-level headings", () => {
  const cases: [string, string, boolean][] = [
    ["plain prose", "Mitochondria are the site of aerobic respiration.", true],
    ["an h3", "### A sub-heading\n\nProse under it.", true],
    ["an h4", "#### Deeper still\n\nProse.", true],
    ["a hash mid-sentence", "Use the # symbol to mean number.", true],
    ["a hash with no space", "#notaheading", true],
    ["an h1", "# A page heading\n\nProse.", false],
    ["an h2", "## A section heading\n\nProse.", false],
    ["an h2 further down", "Some prose.\n\n## A section heading\n\nMore prose.", false],
  ];

  for (const [name, body, shouldPass] of cases) {
    it(`${shouldPass ? "accepts" : "rejects"} ${name}`, () => {
      const block = lessonBlockSchema.safeParse({ type: "prose", body });
      expect(block.success).toBe(shouldPass);

      const section = noteSectionSchema.safeParse({
        id: "bio-x-n1",
        slug: "a-slug",
        title: "A title",
        body,
      });
      expect(section.success).toBe(shouldPass);
    });
  }

  it("explains itself when it rejects", () => {
    const result = lessonBlockSchema.safeParse({ type: "prose", body: "## Nope" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(JSON.stringify(result.error.issues)).toContain("new block or note section");
    }
  });

  it("holds for every body in the shipped content", () => {
    const bodies = [
      ...content.lessons.flatMap((lesson) =>
        lesson.blocks.flatMap((block) =>
          block.type === "prose" || block.type === "keyIdea" || block.type === "summary"
            ? [block.body]
            : [],
        ),
      ),
      ...content.notes.flatMap((page) => page.sections.map((section) => section.body)),
    ];

    expect(bodies.length).toBeGreaterThan(10);
    for (const body of bodies) expect(body).not.toMatch(/^#{1,2} /m);
  });
});
