import { describe, expect, it } from "vitest";

import { rawContent } from "@content/index";
import { getDiagram } from "@/lib/content/diagrams";
import {
  gradeAssignment,
  gradeComparisonTable,
  letterFor,
  scoreSentence,
} from "@/lib/widgets/grading";
import {
  cardSortConfigSchema,
  comparisonTableConfigSchema,
  isBuiltWidget,
  labelTheDiagramConfigSchema,
  parseWidgetConfig,
  scaleExplorerConfigSchema,
  WIDGET_CONFIG_SCHEMAS,
} from "@/lib/widgets/schemas";
import { hashString, mulberry32, seededShuffle } from "@/lib/widgets/shuffle";

/**
 * The widget engines, exercised as pure data.
 *
 * There is no browser in this environment, so a component test would prove very little.
 * What matters is that the shuffling is reproducible, the marking is right, and an
 * authored config that does not fit its engine is rejected before it ships — all three
 * of which are decidable from plain values.
 */

describe("seeded shuffle", () => {
  it("gives the same order for the same seed, every time", () => {
    const items = ["a", "b", "c", "d", "e", "f", "g"];
    const first = seededShuffle(items, "bio-4112-l1:3");
    const second = seededShuffle(items, "bio-4112-l1:3");
    expect(second).toEqual(first);
  });

  it("gives a different order for a different seed", () => {
    const items = ["a", "b", "c", "d", "e", "f", "g", "h"];
    expect(seededShuffle(items, "seed-one")).not.toEqual(seededShuffle(items, "seed-two"));
  });

  it("does not mutate the input", () => {
    const items = ["a", "b", "c", "d"];
    seededShuffle(items, 42);
    expect(items).toEqual(["a", "b", "c", "d"]);
  });

  it("keeps every element exactly once", () => {
    const items = Array.from({ length: 30 }, (_, index) => `item-${index}`);
    const shuffled = seededShuffle(items, "keep-them-all");
    expect([...shuffled].sort()).toEqual([...items].sort());
  });

  it("never leaves a list of 2 or more in its original order", () => {
    // A matching task whose bank happens to come back unshuffled is a free answer, so
    // the identity permutation is rotated away. Sweep many seeds to be sure.
    for (let seed = 0; seed < 400; seed += 1) {
      for (const size of [2, 3, 4, 5, 8]) {
        const items = Array.from({ length: size }, (_, index) => index);
        expect(seededShuffle(items, seed)).not.toEqual(items);
      }
    }
  });

  it("leaves a one-element list alone rather than rotating it forever", () => {
    expect(seededShuffle(["only"], 1)).toEqual(["only"]);
    expect(seededShuffle([], 1)).toEqual([]);
  });

  it("hashes deterministically and stays inside 32 unsigned bits", () => {
    expect(hashString("bio-4112-l1")).toBe(hashString("bio-4112-l1"));
    expect(hashString("a")).not.toBe(hashString("b"));
    for (const value of ["", "a", "a longer string with spaces", "µm²"]) {
      const hash = hashString(value);
      expect(Number.isInteger(hash)).toBe(true);
      expect(hash).toBeGreaterThanOrEqual(0);
      expect(hash).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it("produces values in [0, 1) from the PRNG", () => {
    const random = mulberry32(12345);
    for (let i = 0; i < 1000; i += 1) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe("gradeAssignment", () => {
  const slots = [
    { key: "nucleus", expected: "Nucleus" },
    { key: "cytoplasm", expected: "Cytoplasm" },
    { key: "membrane", expected: "Cell membrane" },
  ];

  it("marks a perfect answer", () => {
    const grade = gradeAssignment(slots, {
      nucleus: "Nucleus",
      cytoplasm: "Cytoplasm",
      membrane: "Cell membrane",
    });
    expect(grade.correct).toBe(3);
    expect(grade.allCorrect).toBe(true);
    expect(grade.complete).toBe(true);
  });

  it("treats a blank slot as unanswered, not as wrong-and-answered", () => {
    const grade = gradeAssignment(slots, { nucleus: "Nucleus", cytoplasm: "" });
    expect(grade.answered).toBe(1);
    expect(grade.correct).toBe(1);
    expect(grade.complete).toBe(false);
    expect(grade.results[1].chosen).toBeNull();
    expect(grade.results[2].chosen).toBeNull();
  });

  it("reports the expected value for every slot so feedback can show it", () => {
    const grade = gradeAssignment(slots, { nucleus: "Cytoplasm" });
    expect(grade.results[0]).toMatchObject({
      key: "nucleus",
      chosen: "Cytoplasm",
      expected: "Nucleus",
      correct: false,
    });
  });

  it("is not all-correct when there is nothing to grade", () => {
    expect(gradeAssignment([], {}).allCorrect).toBe(false);
  });

  it("handles undefined and null the same as a blank", () => {
    const grade = gradeAssignment(slots, { nucleus: undefined, cytoplasm: null });
    expect(grade.answered).toBe(0);
  });
});

describe("gradeComparisonTable", () => {
  const expected = [
    [true, true],
    [false, true],
    [true, false],
  ];

  it("scores rows, not cells, so an empty grid scores zero", () => {
    const empty = [
      [false, false],
      [false, false],
      [false, false],
    ];
    const grade = gradeComparisonTable(expected, empty);
    // Cell-wise an empty grid already agrees with the two cells that are meant to be
    // clear, which is exactly why a cell score would flatter someone who did nothing.
    expect(grade.correct).toBe(2);
    // Row-wise — which is what the student is shown — it has nothing right.
    expect(grade.rowsCorrect).toBe(0);
    expect(grade.rows).toBe(3);
  });

  it("marks a perfect grid", () => {
    const grade = gradeComparisonTable(expected, expected);
    expect(grade.allCorrect).toBe(true);
    expect(grade.rowsCorrect).toBe(3);
    expect(grade.wrongRows).toEqual([]);
  });

  it("reports which rows are wrong, in order, without duplicates", () => {
    const grade = gradeComparisonTable(expected, [
      [false, false],
      [false, true],
      [false, false],
    ]);
    expect(grade.wrongRows).toEqual([0, 2]);
    expect(grade.rowsCorrect).toBe(1);
  });

  it("treats a missing row in the answers as all-blank rather than throwing", () => {
    const grade = gradeComparisonTable(expected, [[true, true]]);
    expect(grade.cells).toHaveLength(6);
    expect(grade.wrongRows).toEqual([1, 2]);
  });

  it("counts a null cell as unanswered", () => {
    const grade = gradeComparisonTable([[true, false]], [[null, false]]);
    expect(grade.answered).toBe(1);
    expect(grade.complete).toBe(false);
  });
});

describe("letterFor", () => {
  it("counts A to Z", () => {
    expect(letterFor(0)).toBe("A");
    expect(letterFor(1)).toBe("B");
    expect(letterFor(25)).toBe("Z");
  });

  it("keeps going past Z instead of producing nonsense", () => {
    expect(letterFor(26)).toBe("AA");
    expect(letterFor(27)).toBe("AB");
    expect(letterFor(51)).toBe("AZ");
    expect(letterFor(52)).toBe("BA");
  });

  it("refuses a negative index", () => {
    expect(() => letterFor(-1)).toThrow(RangeError);
  });

  it("agrees with the diagram primitives for every structure we actually letter", () => {
    // `StructureLabel` letters with String.fromCharCode(65 + index); the widget uses
    // letterFor. They must not disagree, or a question's "structure B" and a widget's
    // "structure B" would be different things.
    for (let index = 0; index < 26; index += 1) {
      expect(letterFor(index)).toBe(String.fromCharCode(65 + index));
    }
  });
});

describe("scoreSentence", () => {
  it("says all correct when everything is right", () => {
    expect(scoreSentence(5, 5)).toBe("All 5 correct.");
  });

  it("gives the fraction otherwise", () => {
    expect(scoreSentence(3, 5)).toBe("3 of 5 correct.");
    expect(scoreSentence(0, 5)).toBe("0 of 5 correct.");
  });
});

describe("widget config schemas", () => {
  it("accepts the label-the-diagram config the content ships", () => {
    const parsed = labelTheDiagramConfigSchema.safeParse({
      diagramId: "bio-animal-cell",
      mode: "recall-first",
      prompt: "Label it.",
    });
    expect(parsed.success).toBe(true);
  });

  it("defaults label-the-diagram to reinforce mode", () => {
    const parsed = labelTheDiagramConfigSchema.parse({ diagramId: "bio-animal-cell" });
    expect(parsed.mode).toBe("reinforce");
  });

  it("rejects a comparison table whose answers do not line up with its columns", () => {
    const parsed = comparisonTableConfigSchema.safeParse({
      columns: ["A", "B"],
      rows: [
        { label: "One", answers: [true, false] },
        { label: "Two", answers: [true, false, true] },
      ],
    });
    expect(parsed.success).toBe(false);
    expect(JSON.stringify(parsed.error?.issues)).toContain("match the columns");
  });

  it("rejects duplicate rows and duplicate columns", () => {
    expect(
      comparisonTableConfigSchema.safeParse({
        columns: ["A", "A"],
        rows: [
          { label: "One", answers: [true, false] },
          { label: "Two", answers: [true, false] },
        ],
      }).success,
    ).toBe(false);

    expect(
      comparisonTableConfigSchema.safeParse({
        columns: ["A", "B"],
        rows: [
          { label: "Same", answers: [true, false] },
          { label: "Same", answers: [true, false] },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects a card sort with a duplicated right-hand card", () => {
    // Two identical targets make one match genuinely ambiguous, and the student would be
    // marked wrong for an answer that is defensible.
    const parsed = cardSortConfigSchema.safeParse({
      instruction: "Match them.",
      pairs: [
        { left: "A", right: "same" },
        { left: "B", right: "same" },
        { left: "C", right: "other" },
      ],
    });
    expect(parsed.success).toBe(false);
    expect(JSON.stringify(parsed.error?.issues)).toContain("right cards must be unique");
  });

  it("requires a scale explorer to have at least two levels", () => {
    expect(
      scaleExplorerConfigSchema.safeParse({ levels: [{ label: "Cell", size: "10 µm" }] })
        .success,
    ).toBe(false);
  });

  it("knows which engines exist", () => {
    expect(isBuiltWidget("card-sort")).toBe(true);
    expect(isBuiltWidget("microscope-practical")).toBe(false);
    expect(Object.keys(WIDGET_CONFIG_SCHEMAS).sort()).toEqual([
      "card-sort",
      "comparison-table",
      "label-the-diagram",
      "scale-explorer",
    ]);
  });

  it("reports an unbuilt engine distinctly, so the renderer can show a placeholder", () => {
    const parsed = parseWidgetConfig("microscope-practical", { practicalId: "bio-rp-1" });
    expect(parsed.ok).toBe(false);
    expect(parsed.ok === false && parsed.issues[0].message).toContain("no engine for widget");
  });

  it("returns paths on config issues so the validator can point at the field", () => {
    const parsed = parseWidgetConfig("comparison-table", {
      columns: ["A", "B"],
      rows: [
        { label: "One", answers: [true] },
        { label: "Two", answers: [true, false] },
      ],
    });
    expect(parsed.ok).toBe(false);
    expect(
      parsed.ok === false && parsed.issues.some((issue) => issue.path.startsWith("rows.0")),
    ).toBe(true);
  });
});

describe("every widget config in the shipped content", () => {
  const widgetBlocks = rawContent.lessons.flatMap((lesson, lessonIndex) =>
    lesson.blocks.flatMap((block, blockIndex) =>
      block.type === "widget" ? [{ lesson, lessonIndex, block, blockIndex }] : [],
    ),
  );

  it("finds the widgets the first slice actually uses", () => {
    expect(widgetBlocks.map((entry) => entry.block.widgetId).sort()).toEqual([
      "card-sort",
      "comparison-table",
      "label-the-diagram",
      "microscope-practical",
      "scale-explorer",
    ]);
  });

  it("parses against its engine's schema, or is an unbuilt engine", () => {
    for (const { lesson, block, blockIndex } of widgetBlocks) {
      const parsed = parseWidgetConfig(block.widgetId, block.config ?? {});
      if (isBuiltWidget(block.widgetId)) {
        expect(
          parsed.ok,
          `${lesson.id} blocks.${blockIndex} (${block.widgetId}): ${
            parsed.ok ? "" : JSON.stringify(parsed.issues)
          }`,
        ).toBe(true);
      } else {
        expect(parsed.ok).toBe(false);
      }
    }
  });

  it("names a diagram that exists, with structures that exist", () => {
    for (const { block } of widgetBlocks) {
      const parsed = parseWidgetConfig(block.widgetId, block.config ?? {});
      if (!parsed.ok) continue;

      const config = parsed.config as { diagramId?: string; structures?: string[] };
      if (!config.diagramId) continue;

      const diagram = getDiagram(config.diagramId);
      expect(diagram, `no diagram "${config.diagramId}"`).toBeDefined();

      for (const key of config.structures ?? []) {
        expect(diagram?.structures.some((structure) => structure.key === key)).toBe(true);
      }
    }
  });

  it("can be graded end to end from the authored answer key", () => {
    // Walk the real comparison table and prove a correct fill scores full marks and an
    // inverted one scores none. If the authored answers were ever nonsense — all true,
    // say — the inverted case would also pass, so both directions are checked.
    for (const { block } of widgetBlocks) {
      if (block.widgetId !== "comparison-table") continue;
      const parsed = parseWidgetConfig(block.widgetId, block.config ?? {});
      if (!parsed.ok) continue;

      const config = parsed.config as { rows: { answers: boolean[] }[] };
      const expected = config.rows.map((row) => row.answers);

      expect(gradeComparisonTable(expected, expected).allCorrect).toBe(true);
      const inverted = expected.map((row) => row.map((value) => !value));
      expect(gradeComparisonTable(expected, inverted).rowsCorrect).toBe(0);
    }
  });

  it("gives the card sort a distinct right-hand card for every left-hand one", () => {
    for (const { block } of widgetBlocks) {
      if (block.widgetId !== "card-sort") continue;
      const parsed = parseWidgetConfig(block.widgetId, block.config ?? {});
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) continue;

      const config = parsed.config as { pairs: { left: string; right: string }[] };
      const slots = config.pairs.map((pair) => ({ key: pair.left, expected: pair.right }));
      const perfect = Object.fromEntries(config.pairs.map((pair) => [pair.left, pair.right]));
      expect(gradeAssignment(slots, perfect).allCorrect).toBe(true);

      // One-off: shifting every answer by one must score zero, which is only true if no
      // two pairs share a target.
      const shifted = Object.fromEntries(
        config.pairs.map((pair, index) => [
          pair.left,
          config.pairs[(index + 1) % config.pairs.length].right,
        ]),
      );
      expect(gradeAssignment(slots, shifted).correct).toBe(0);
    }
  });
});
