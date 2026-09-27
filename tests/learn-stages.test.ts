import { describe, expect, it } from "vitest";

import { rawContent } from "@content/index";
import type { LessonBlock } from "@/lib/content/schema";
import {
  blockIndexForStage,
  blocksThroughStage,
  buildStages,
  stageForBlockIndex,
  stageView,
} from "@/lib/learn/stages";
import {
  accumulateSeconds,
  elapsedSecondsSince,
  formatDuration,
  MAX_STEP_SECONDS,
} from "@/lib/learn/time";

/**
 * The lesson runner's arithmetic.
 *
 * Progress is one integer in the database and everything else is derived from it, so the
 * derivation is where a bug would live — and it is the kind of bug that would strand a
 * student on a gate they had already answered. All of it is pure, so all of it is here.
 */

const prose = (body = "Some prose."): LessonBlock => ({
  type: "prose",
  body,
  specPoints: [],
  recap: false,
});

const check = (correctKey = "A"): LessonBlock => ({
  type: "check",
  prompt: "Which one?",
  options: [
    { key: "A", text: "First" },
    { key: "B", text: "Second" },
  ],
  correctKey,
  explanation: "Because.",
  specPoints: [],
  recap: false,
});

describe("buildStages", () => {
  it("makes one step out of a lesson with no checks", () => {
    const stages = buildStages([prose(), prose(), prose()]);
    expect(stages).toEqual([{ index: 0, startIndex: 0, endIndex: 2, gateBlockIndex: null }]);
  });

  it("closes a step at each check, keeping the check inside it", () => {
    const stages = buildStages([prose(), check(), prose(), check(), prose()]);
    expect(stages).toEqual([
      { index: 0, startIndex: 0, endIndex: 1, gateBlockIndex: 1 },
      { index: 1, startIndex: 2, endIndex: 3, gateBlockIndex: 3 },
      { index: 2, startIndex: 4, endIndex: 4, gateBlockIndex: null },
    ]);
  });

  it("does not invent a trailing step when the lesson ends on a check", () => {
    const stages = buildStages([prose(), check()]);
    expect(stages).toHaveLength(1);
    expect(stages[0].gateBlockIndex).toBe(1);
  });

  it("handles two checks in a row without producing an empty step", () => {
    const stages = buildStages([check(), check()]);
    expect(stages).toEqual([
      { index: 0, startIndex: 0, endIndex: 0, gateBlockIndex: 0 },
      { index: 1, startIndex: 1, endIndex: 1, gateBlockIndex: 1 },
    ]);
  });

  it("returns nothing for no blocks rather than a phantom step", () => {
    expect(buildStages([])).toEqual([]);
  });

  it("covers every block exactly once, with no gaps", () => {
    const blocks = [prose(), check(), prose(), prose(), check(), prose()];
    const stages = buildStages(blocks);
    const covered = stages.flatMap((stage) =>
      Array.from(
        { length: stage.endIndex - stage.startIndex + 1 },
        (_, i) => stage.startIndex + i,
      ),
    );
    expect(covered).toEqual(blocks.map((_, index) => index));
  });
});

describe("stageForBlockIndex", () => {
  const stages = buildStages([prose(), check(), prose(), check(), prose()]);

  it("resolves the default 0 to the first step", () => {
    expect(stageForBlockIndex(stages, 0)).toBe(0);
  });

  it("resolves a saved end index back to the step that produced it", () => {
    for (const stage of stages) {
      expect(stageForBlockIndex(stages, stage.endIndex)).toBe(stage.index);
    }
  });

  it("clamps an index left behind by a longer version of the lesson", () => {
    expect(stageForBlockIndex(stages, 999)).toBe(stages.length - 1);
  });

  it("clamps a negative index to the first step instead of throwing", () => {
    expect(stageForBlockIndex(stages, -5)).toBe(0);
  });

  it("survives an empty stage list", () => {
    expect(stageForBlockIndex([], 3)).toBe(0);
  });
});

describe("blockIndexForStage round-trips", () => {
  it("saves an index that resolves back to the same step", () => {
    const stages = buildStages([prose(), check(), prose(), check(), prose(), prose()]);
    for (const stage of stages) {
      const saved = blockIndexForStage(stages, stage.index);
      expect(stageForBlockIndex(stages, saved)).toBe(stage.index);
    }
  });

  it("clamps out-of-range steps at both ends", () => {
    const stages = buildStages([prose(), check(), prose()]);
    expect(blockIndexForStage(stages, -3)).toBe(stages[0].endIndex);
    expect(blockIndexForStage(stages, 99)).toBe(stages[stages.length - 1].endIndex);
    expect(blockIndexForStage([], 0)).toBe(0);
  });
});

describe("blocksThroughStage", () => {
  const blocks = [prose("a"), check(), prose("b"), check(), prose("c")];
  const stages = buildStages(blocks);

  it("reveals progressively more with each step", () => {
    expect(blocksThroughStage(blocks, stages, 0)).toHaveLength(2);
    expect(blocksThroughStage(blocks, stages, 1)).toHaveLength(4);
    expect(blocksThroughStage(blocks, stages, 2)).toHaveLength(5);
  });

  it("reveals everything on the last step", () => {
    expect(blocksThroughStage(blocks, stages, stages.length - 1)).toEqual(blocks);
  });
});

describe("stageView", () => {
  const blocks = [prose(), check(), prose(), check(), prose()];

  it("starts a new student on the first step", () => {
    const view = stageView(blocks, 0, false);
    expect(view.stageIndex).toBe(0);
    expect(view.visibleBlocks).toHaveLength(2);
    expect(view.gateBlockIndex).toBe(1);
    expect(view.isFinalStage).toBe(false);
    expect(view.percentComplete).toBe(0);
  });

  it("opens the whole lesson once it is completed", () => {
    const view = stageView(blocks, 0, true);
    expect(view.visibleBlocks).toEqual(blocks);
    expect(view.isFinalStage).toBe(true);
    expect(view.percentComplete).toBe(100);
  });

  it("reports the final step without a gate", () => {
    const view = stageView(blocks, 4, false);
    expect(view.isFinalStage).toBe(true);
    expect(view.gateBlockIndex).toBeNull();
  });

  it("reports sensible progress part way through", () => {
    expect(stageView(blocks, 3, false).percentComplete).toBe(33);
  });
});

describe("the real shipped lessons", () => {
  it("each split into more than one step, so the reveal is doing something", () => {
    for (const lesson of rawContent.lessons) {
      const stages = buildStages(lesson.blocks as LessonBlock[]);
      expect(stages.length, `${lesson.id} has only ${stages.length} step(s)`).toBeGreaterThan(
        1,
      );
    }
  });

  it("gates every step except possibly the last", () => {
    for (const lesson of rawContent.lessons) {
      const stages = buildStages(lesson.blocks as LessonBlock[]);
      stages.slice(0, -1).forEach((stage) => {
        expect(stage.gateBlockIndex, `${lesson.id} step ${stage.index}`).not.toBeNull();
      });
    }
  });

  it("can be walked from the first step to the last without a gap", () => {
    for (const lesson of rawContent.lessons) {
      const blocks = lesson.blocks as LessonBlock[];
      const stages = buildStages(blocks);

      let lastBlockIndex = 0;
      for (let step = 0; step < stages.length; step += 1) {
        const view = stageView(blocks, lastBlockIndex, false);
        expect(view.stageIndex).toBe(step);
        lastBlockIndex = blockIndexForStage(stages, step + 1);
      }

      // Having walked off the end, the view stays on the last step rather than wrapping.
      expect(stageView(blocks, lastBlockIndex, false).stageIndex).toBe(stages.length - 1);
    }
  });

  it("never hides a block: the last step reveals the whole lesson", () => {
    for (const lesson of rawContent.lessons) {
      const blocks = lesson.blocks as LessonBlock[];
      const stages = buildStages(blocks);
      expect(blocksThroughStage(blocks, stages, stages.length - 1)).toHaveLength(blocks.length);
    }
  });
});

describe("time on task", () => {
  const start = new Date("2026-09-27T10:00:00.000Z");

  it("measures whole seconds between two instants", () => {
    expect(elapsedSecondsSince(start, new Date("2026-09-27T10:02:30.000Z"))).toBe(150);
  });

  it("accepts an ISO string, which is what the hidden field carries", () => {
    expect(
      elapsedSecondsSince("2026-09-27T10:00:00.000Z", new Date("2026-09-27T10:00:45.000Z")),
    ).toBe(45);
  });

  it("caps an abandoned tab rather than counting it", () => {
    expect(elapsedSecondsSince(start, new Date("2026-09-27T14:00:00.000Z"))).toBe(
      MAX_STEP_SECONDS,
    );
  });

  it("returns nothing for a forged future timestamp", () => {
    expect(elapsedSecondsSince("2026-09-27T10:05:00.000Z", start)).toBe(0);
  });

  it("returns nothing for a double submit", () => {
    expect(elapsedSecondsSince(start, new Date("2026-09-27T10:00:00.400Z"))).toBe(0);
  });

  it("returns nothing for junk, null or undefined", () => {
    expect(elapsedSecondsSince("not a date", start)).toBe(0);
    expect(elapsedSecondsSince(null, start)).toBe(0);
    expect(elapsedSecondsSince(undefined, start)).toBe(0);
  });

  it("accumulates without ever going negative or fractional", () => {
    expect(accumulateSeconds(100, 50)).toBe(150);
    expect(accumulateSeconds(-5, 10)).toBe(10);
    expect(accumulateSeconds(10, -5)).toBe(10);
    expect(accumulateSeconds(10.7, 4.9)).toBe(14);
    expect(accumulateSeconds(Number.NaN, 5)).toBe(5);
    expect(accumulateSeconds(5, Number.POSITIVE_INFINITY)).toBe(5);
  });

  it("formats a duration the way a person would say it", () => {
    expect(formatDuration(0)).toBe("under a minute");
    expect(formatDuration(59)).toBe("under a minute");
    expect(formatDuration(60)).toBe("1 minute");
    expect(formatDuration(150)).toBe("3 minutes");
    expect(formatDuration(3600)).toBe("1 hour");
    expect(formatDuration(3600 + 15 * 60)).toBe("1 hour 15 min");
    expect(formatDuration(-10)).toBe("under a minute");
  });
});
