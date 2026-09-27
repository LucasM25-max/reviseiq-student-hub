import { execFileSync } from "node:child_process";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Phase 3 exit criterion: **CI fails on a deliberately broken content file.**
 *
 * These tests spawn the real validator — the same `runValidation` behind
 * `npm run content:validate` — over the permanently broken fixtures in
 * tests/fixtures/broken-content/, and assert both that it exits non-zero and that it
 * names the specific defect. Asserting the exit code alone would pass if the validator
 * crashed for an unrelated reason.
 *
 * Nothing is mutated: the fixtures are broken on disk by design, so an interrupted run
 * cannot leave real content in a bad state.
 */

const ENTRY = path.resolve(import.meta.dirname, "fixtures/broken-content/validate-entry.ts");

type Run = { status: number; output: string };

function runValidator(fixture: string): Run {
  try {
    const stdout = execFileSync("npx", ["tsx", ENTRY, fixture], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { status: 0, output: stdout };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    return {
      status: failure.status ?? -1,
      // The validator writes problems to stderr and the summary to stdout.
      output: `${failure.stdout ?? ""}${failure.stderr ?? ""}`,
    };
  }
}

// Spawning tsx three times is not fast; each run compiles the whole content graph.
describe("content validation blocks broken content", { timeout: 120_000 }, () => {
  it("fails on schema violations, and says which", () => {
    const { status, output } = runValidator("schema");

    expect(status).toBe(1);
    expect(output).toContain("content is invalid");

    // One assertion per class of defect, so a regression names itself.
    expect(output).toContain('correctKey "D" is not one of the options');
    expect(output).toContain("option keys must be unique");
    expect(output).toContain("mark points total 2 but the question is worth 3");
    expect(output).toContain("MCQ requires options");
    expect(output).toContain("MCQ requires a correctKey");
    expect(output).toContain("accept.min must not exceed accept.max");
    expect(output).toContain('"mp9" is not a mark point on this question');
    expect(output).toContain("PRACTICAL questions must name the required practical");
    expect(output).toContain("options are only valid on MCQ");
    expect(output).toContain("mark point ids must be unique");
    // D39 — a lesson made only of recap teaches nothing.
    expect(output).toContain("no block in this lesson teaches a spec point");
  });

  it("fails on dangling references, and says which", () => {
    const { status, output } = runValidator("references");

    expect(status).toBe(1);
    expect(output).toContain("content is invalid");

    expect(output).toContain("coverage is FULL but blockedBy is not empty");
    expect(output).toContain("coverage is PARTIAL but nothing is recorded as blocking it");
    expect(output).toContain('no practical with id "bio-rp-99"');
    expect(output).toContain('no spec point "bio-does-not-exist"');
    expect(output).toContain('no diagram "bio-nonexistent-diagram" in the registry');
    expect(output).toContain('"not-a-real-structure" is not a structure on diagram');
    expect(output).toContain('no widget "widget-that-was-never-built" in the registry');
    expect(output).toContain('no sub-topic "aqa-biology-9.9.9"');
    expect(output).toContain("duplicate section slug");
    expect(output).toContain("is already used by another lesson");
    expect(output).toContain("the fault table has been orphaned from the bank");
    expect(output).toContain("steps must be numbered consecutively");
    expect(output).toContain("cells but there are 2 headers");
    expect(output).toContain("duplicate expected point id");
  });

  it("fails on coverage gates, and says which", () => {
    const { status, output } = runValidator("gates");

    expect(status).toBe(1);
    expect(output).toContain("coverage gates failed");

    expect(output).toContain("4 questions, needs at least 8");
    expect(output).toContain("question type(s), needs at least 3");
    expect(output).toContain("extended-response questions, needs at least 1");
    expect(output).toContain("no question tests it");
    // D39 — recap blocks never satisfy coverage on their own.
    expect(output).toContain("no lesson block teaches it (recap blocks do not count)");
    expect(output).toContain("target 40% ±5");
  });
});
