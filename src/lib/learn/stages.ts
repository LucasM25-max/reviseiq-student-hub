/**
 * Chunking a lesson into revealable steps.
 *
 * Doc 01 §3 asks for blocks to be revealed progressively, with a `check` block gating
 * what comes after it. Taken literally — one block, one click — a twenty-block lesson
 * becomes twenty clicks, and the friction buys nothing: a definition followed by four
 * more definitions is one idea, not five.
 *
 * So the reveal unit is a **step**: a run of blocks ending at the next `check`. The
 * pedagogy is unchanged (you cannot read past a check without answering it) and the
 * clicking drops by an order of magnitude. Steps are derived from the block array every
 * time, never stored, so re-chunking a lesson can never invalidate saved progress —
 * `LessonProgress.lastBlockIndex` records a block, and the step is worked out from it.
 *
 * Pure module: no React, no Prisma. Everything here is exercised directly by vitest.
 */
import type { LessonBlock } from "@/lib/content/schema";

export type LessonStage = {
  /** 0-based position in the step list. */
  index: number;
  /** First block in the step. */
  startIndex: number;
  /** Last block in the step, inclusive. */
  endIndex: number;
  /**
   * Index of the `check` block that closes this step, or null for a step that simply
   * runs out of blocks. Only the final step can be ungated.
   */
  gateBlockIndex: number | null;
};

/**
 * Splits blocks into steps. A `check` block ends the step it appears in, and is itself
 * revealed as part of that step — the student needs to read the question.
 */
export function buildStages(blocks: readonly LessonBlock[]): LessonStage[] {
  const stages: LessonStage[] = [];
  let startIndex = 0;

  blocks.forEach((block, index) => {
    if (block.type !== "check") return;
    stages.push({
      index: stages.length,
      startIndex,
      endIndex: index,
      gateBlockIndex: index,
    });
    startIndex = index + 1;
  });

  if (startIndex < blocks.length) {
    stages.push({
      index: stages.length,
      startIndex,
      endIndex: blocks.length - 1,
      gateBlockIndex: null,
    });
  }

  // A lesson whose blocks are all consumed by checks still needs at least one step, and
  // an empty lesson cannot exist (the schema requires at least one block) — but a caller
  // handing us an empty array should get an empty list rather than a phantom step.
  return stages;
}

/**
 * Which step a saved `lastBlockIndex` puts the student on.
 *
 * Clamps at both ends, so a saved index left behind by a longer version of the lesson
 * resolves to the last step instead of throwing or resetting them to the beginning.
 */
export function stageForBlockIndex(
  stages: readonly LessonStage[],
  lastBlockIndex: number,
): number {
  if (stages.length === 0) return 0;
  if (lastBlockIndex <= stages[0].endIndex) return 0;

  const found = stages.findIndex(
    (stage) => lastBlockIndex >= stage.startIndex && lastBlockIndex <= stage.endIndex,
  );
  return found === -1 ? stages.length - 1 : found;
}

/** The block index to save so that `stageForBlockIndex` resolves back to this step. */
export function blockIndexForStage(stages: readonly LessonStage[], stageIndex: number): number {
  if (stages.length === 0) return 0;
  const clamped = Math.min(Math.max(stageIndex, 0), stages.length - 1);
  return stages[clamped].endIndex;
}

/** Every block revealed up to and including `stageIndex`. */
export function blocksThroughStage<T>(
  blocks: readonly T[],
  stages: readonly LessonStage[],
  stageIndex: number,
): T[] {
  if (stages.length === 0) return [];
  const clamped = Math.min(Math.max(stageIndex, 0), stages.length - 1);
  return blocks.slice(0, stages[clamped].endIndex + 1);
}

export type StageView = {
  stages: LessonStage[];
  stageIndex: number;
  stage: LessonStage;
  isFinalStage: boolean;
  /** The check block gating this step, if there is one. */
  gateBlockIndex: number | null;
  /** Blocks to render, already sliced. */
  visibleBlocks: LessonBlock[];
  /** 0–100, for the progress rail. A step is "done" once it has been left behind. */
  percentComplete: number;
};

/**
 * Everything a lesson page needs to render, derived from the block array and one integer.
 *
 * `completed` matters because a student who has finished a lesson should be able to
 * re-read all of it without clicking through the steps again — the gate is there to pace
 * first contact, not to make revision tedious.
 */
export function stageView(
  blocks: readonly LessonBlock[],
  lastBlockIndex: number,
  completed = false,
): StageView {
  const stages = buildStages(blocks);
  const stageIndex = completed
    ? Math.max(stages.length - 1, 0)
    : stageForBlockIndex(stages, lastBlockIndex);
  const stage = stages[stageIndex] ?? {
    index: 0,
    startIndex: 0,
    endIndex: Math.max(blocks.length - 1, 0),
    gateBlockIndex: null,
  };

  return {
    stages,
    stageIndex,
    stage,
    isFinalStage: stageIndex >= stages.length - 1,
    gateBlockIndex: stage.gateBlockIndex,
    visibleBlocks: blocksThroughStage(blocks, stages, stageIndex),
    percentComplete:
      stages.length === 0
        ? 100
        : Math.round(((completed ? stages.length : stageIndex) / stages.length) * 100),
  };
}
