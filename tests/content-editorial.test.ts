import { describe, expect, it } from "vitest";

import { loadContent } from "@/lib/content/registry";
import type { LessonBlock } from "@/lib/content/schema";

/**
 * Editorial rules from the slice's §8, enforced as tests.
 *
 * These are the rules that decide marks, and they are exactly the rules that erode
 * quietly as content is edited. A reviewer will not re-read twelve thousand words
 * looking for the word "powerhouse" every time a lesson changes; this suite will.
 */

const result = loadContent();
if (!result.ok) throw new Error("content failed to load — see tests/content.test.ts");
const content = result.content;

/** Every string a student can read in a lesson block. */
function blockText(block: LessonBlock): string {
  switch (block.type) {
    case "prose":
    case "keyIdea":
    case "summary":
      return block.body;
    case "definition":
      return `${block.term} ${block.body}`;
    case "example":
      return `${block.title} ${block.steps.join(" ")}`;
    case "misconception":
      return `${block.claim} ${block.correction}`;
    case "check":
      return `${block.prompt} ${block.options.map((o) => o.text).join(" ")} ${block.explanation}`;
    case "diagram":
      return block.caption ?? "";
    case "widget":
      return "";
  }
}

const lessonProse = content.lessons
  .flatMap((lesson) => lesson.blocks.map(blockText))
  .join("\n")
  .toLowerCase();

const notesProse = content.notes
  .flatMap((page) => page.sections.map((section) => `${section.title} ${section.body}`))
  .join("\n")
  .toLowerCase();

/** Mark point text that a student must produce to earn the mark. */
const requiredMarkPoints = content.questions
  .flatMap((question) => question.markScheme.points.map((point) => point.text))
  .join("\n")
  .toLowerCase();

const allRejects = content.questions
  .flatMap((question) => question.markScheme.points.flatMap((point) => point.reject))
  .join("\n")
  .toLowerCase();

describe("beyond-spec exclusions (D37)", () => {
  // Not on AQA GCSE Biology 8461. Accepted if a student volunteers them, never taught
  // and never required — so they must not appear in teaching text or in a mark point.
  const excluded = [
    "golgi",
    "endoplasmic reticulum",
    "lysosome",
    "tonoplast",
    "peptidoglycan",
    "murein",
    "70s",
    "80s",
    "resolving power",
    "electron microscope",
    "oil immersion",
    "numerical aperture",
    "nucleoid",
    "flagellum",
    "pili",
  ];

  it("keeps excluded terms out of every lesson", () => {
    for (const term of excluded) {
      expect(lessonProse, `lessons mention "${term}"`).not.toContain(term);
    }
  });

  it("keeps excluded terms out of the revision notes", () => {
    for (const term of excluded) {
      expect(notesProse, `notes mention "${term}"`).not.toContain(term);
    }
  });

  it("never requires an excluded term to earn a mark", () => {
    for (const term of excluded) {
      expect(requiredMarkPoints, `a mark point requires "${term}"`).not.toContain(term);
    }
  });

  it("does not teach resolution, which belongs to 4.1.1.5", () => {
    // The magnification *formula* is borrowed deliberately for RP1 step 19. Resolution
    // and resolving power are not, and must stay in their own slice.
    expect(lessonProse).not.toContain("resolution");
    expect(notesProse).not.toContain("resolution");
  });
});

describe("vague function language is rejected, never taught", () => {
  const banned = ["powerhouse", "brain of the cell"];

  it("never appears as something a student should write", () => {
    for (const phrase of banned) {
      expect(requiredMarkPoints, `a mark point requires "${phrase}"`).not.toContain(phrase);
    }
  });

  it("is explicitly on a reject list, so the marker knows to refuse it", () => {
    expect(allRejects).toContain("powerhouse");
    expect(allRejects).toContain("make energy");
  });

  it("is called out as a misconception in the teaching", () => {
    const misconceptions = content.lessons
      .flatMap((lesson) => lesson.blocks)
      .filter((block) => block.type === "misconception");
    const claims = misconceptions.map((block) => block.claim.toLowerCase()).join("\n");
    expect(claims).toContain("powerhouse");
  });

  it("teaches the creditworthy phrasing instead", () => {
    expect(lessonProse).toContain("site of aerobic respiration");
    expect(requiredMarkPoints).toContain("site of aerobic respiration");
  });
});

describe("the specification's hedges are preserved", () => {
  it("says plant cells *often* have chloroplasts, never *all*", () => {
    expect(lessonProse).toContain("often");
    expect(notesProse).toContain("often");
    // The absolute claim is the misconception, so it may appear only inside a
    // misconception block or a reject list — never as plain teaching.
    const plainTeaching = content.lessons
      .flatMap((lesson) => lesson.blocks)
      .filter((block) => block.type !== "misconception" && block.type !== "check")
      .map(blockText)
      .join("\n")
      .toLowerCase();
    expect(plainTeaching).not.toContain("all plant cells have chloroplasts");
  });

  it("rejects the absolute claim in a mark scheme", () => {
    expect(allRejects).toContain("all plant cells have chloroplasts");
  });

  it("keeps the cell wall attached to plant *and algal* cells", () => {
    expect(lessonProse).toContain("algal");
    expect(notesProse).toContain("algal");
  });

  it("keeps the vacuole *permanent*", () => {
    expect(lessonProse).toContain("permanent vacuole");
    expect(notesProse).toContain("permanent vacuole");
  });
});

describe("cell wall is never confused with cell membrane", () => {
  it("is taught as a distinct misconception", () => {
    const claims = content.lessons
      .flatMap((lesson) => lesson.blocks)
      .filter((block) => block.type === "misconception")
      .map((block) => block.claim.toLowerCase());
    expect(
      claims.some((claim) => claim.includes("cell wall") && claim.includes("enters")),
    ).toBe(true);
  });

  it("attributes control of entry to the membrane in the mark scheme", () => {
    expect(requiredMarkPoints).toContain("cell membrane: controls what enters and leaves");
  });
});

describe("comparison questions require paired statements", () => {
  const compareQuestions = content.questions.filter((question) =>
    /^(compare|give the differences)/i.test(question.commandWord),
  );

  it("has at least one", () => {
    expect(compareQuestions.length).toBeGreaterThan(0);
  });

  it("warns the marker that a one-sided answer scores zero", () => {
    for (const question of compareQuestions) {
      const guidance = (question.markScheme.guidance ?? "").toLowerCase();
      expect(guidance, `${question.id} has no compare guidance`).toContain("zero");
      expect(guidance).toMatch(/pair|both/);
    }
  });
});

describe("estimation covers all three formats (§4b)", () => {
  const estimation = content.questions.filter((question) =>
    question.specPoints.some((ref) => ref.code === "bio-4112-est"),
  );

  it("has three or more estimation questions", () => {
    expect(estimation.length).toBeGreaterThanOrEqual(3);
  });

  it("marks every one against a tolerance band, not a single value (D49)", () => {
    const banded = estimation.filter((question) => question.markScheme.numericAnswer);
    expect(banded.length).toBeGreaterThanOrEqual(3);
  });

  it("includes an area question, in µm²", () => {
    const area = estimation.find(
      (question) => question.markScheme.numericAnswer?.unit === "µm²",
    );
    expect(area, "no estimation question asks for an area").toBeDefined();
  });

  it("includes a count-across-a-distance question and a fraction-of-a-cell question", () => {
    const stems = estimation.map((question) => question.stem.toLowerCase());
    expect(stems.some((stem) => stem.includes("scale bar"))).toBe(true);
    expect(stems.some((stem) => stem.includes("quarter"))).toBe(true);
  });
});

describe("the magnification calculation is arithmetically right", () => {
  const question = content.questions.find((entry) => entry.id === "bio-4112-q17");

  it("exists and is a calculation", () => {
    expect(question?.type).toBe("CALCULATION");
  });

  it("accepts ×500 and not the microscope's ×400", () => {
    // 90 divisions × 2.67 µm = 240.3 µm = 0.2403 mm; 120 mm ÷ 0.2403 mm = 499.4.
    const actualUm = 90 * 2.67;
    const magnification = 120 / (actualUm / 1000);
    const band = question!.markScheme.numericAnswer!;

    expect(magnification).toBeGreaterThan(band.accept.min);
    expect(magnification).toBeLessThan(band.accept.max);
    // The most common error is writing the microscope's magnification instead.
    expect(400).toBeLessThan(band.accept.min);
  });

  it("carries no unit, because magnification is a ratio", () => {
    expect(question!.markScheme.numericAnswer!.unit).toBeUndefined();
  });

  it("rejects ×400 explicitly", () => {
    const rejects = question!.markScheme.points.flatMap((point) => point.reject).join(" ");
    expect(rejects).toContain("×400");
  });
});

describe("estimation answers are the ones a student would actually get", () => {
  it("q07: 300 µm ÷ mean of 5, 6 and 4 cells ≈ 60 µm", () => {
    const question = content.questions.find((entry) => entry.id === "bio-4112-q07")!;
    const mean = (5 + 6 + 4) / 3;
    const value = 300 / mean;
    expect(value).toBe(60);
    const band = question.markScheme.numericAnswer!;
    expect(value).toBeGreaterThanOrEqual(band.accept.min);
    expect(value).toBeLessThanOrEqual(band.accept.max);
  });

  it("q08: one quarter of a 20 µm cell is 5 µm", () => {
    const question = content.questions.find((entry) => entry.id === "bio-4112-q08")!;
    const value = 20 / 4;
    expect(value).toBe(5);
    const band = question.markScheme.numericAnswer!;
    expect(value).toBeGreaterThanOrEqual(band.accept.min);
    expect(value).toBeLessThanOrEqual(band.accept.max);
  });

  it("q09: a 30 × 15 µm cell holding 18 nuclei gives 25 µm² each", () => {
    const question = content.questions.find((entry) => entry.id === "bio-4112-q09")!;
    const value = (30 * 15) / 18;
    expect(value).toBe(25);
    const band = question.markScheme.numericAnswer!;
    expect(value).toBeGreaterThanOrEqual(band.accept.min);
    expect(value).toBeLessThanOrEqual(band.accept.max);
    expect(band.unit).toBe("µm²");
  });
});

describe("required practical technique matches the AQA student sheet", () => {
  const practical = content.practicals.find((entry) => entry.id === "bio-rp-1")!;
  const method = practical.method.map((step) => step.text.toLowerCase()).join("\n");

  it("peels from the inner surface", () => {
    expect(method).toContain("inner surface");
  });

  it("uses two drops of iodine", () => {
    expect(method).toContain("two drops of iodine");
  });

  it("lowers the coverslip with a mounted needle", () => {
    expect(method).toContain("mounted needle");
  });

  it("starts on the lowest power objective", () => {
    expect(method).toContain("lowest power objective");
  });

  it("racks down while looking from the side, then focuses by increasing the gap", () => {
    expect(method).toContain("from the side");
    expect(method).toContain("increase the distance");
  });

  it("puts eye protection on before the iodine, not after", () => {
    const goggles = practical.method.findIndex((step) =>
      step.text.toLowerCase().includes("eye protection"),
    );
    // Step 1 *mentions* iodine ("put on eye protection before handling iodine"), so
    // look for the step that actually adds it to the slide.
    const iodine = practical.method.findIndex((step) =>
      step.text.toLowerCase().includes("add two drops of iodine"),
    );
    expect(goggles).toBeGreaterThanOrEqual(0);
    expect(goggles).toBeLessThan(iodine);
  });
});

describe("notes anchors are stable deep-link targets", () => {
  it("keeps the seven section slugs the slice specifies", () => {
    const page = content.notes.find((entry) => entry.subTopicId === "aqa-biology-4.1.1")!;
    expect(page.sections.map((section) => section.slug)).toEqual([
      "animal-cells",
      "plant-cells",
      "functions",
      "estimating",
      "practical",
      "drawing-rules",
      "exam-technique",
    ]);
  });
});
