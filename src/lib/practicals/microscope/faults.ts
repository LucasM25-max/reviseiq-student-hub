/**
 * Which things are currently wrong with the slide.
 *
 * Derived from state on every read, never stored (§4.4). That is not tidiness: a stored
 * fault list is a second copy of the truth, and the moment a student blots the slide or
 * adds the stain they forgot, a stored list is stale and the field of view starts
 * lying about what is on it.
 *
 * The ids here are the ids in `content/biology/practicals/rp-1-microscopy.ts`. One
 * source, three consumers (D50) — the visible consequence here, the mark-scheme point
 * in the question bank, and the "sources of error" table on the revision sheet. The
 * cross-check is a test, so a rename in either place fails the build rather than
 * silently decoupling the simulation from what the exam asks about.
 */
import type { BenchState } from "./state";

export const FAULT_IDS = [
  "air-bubbles",
  "no-stain",
  "over-stained",
  "too-thick",
  "dry-mount",
  "drifting-coverslip",
  "cracked-slide",
  "lost-at-high-power",
  "no-goggles",
] as const;

export type FaultId = (typeof FAULT_IDS)[number];

/** Iodine drops that actually help. Beyond this the specimen goes opaque. */
export const MAX_USEFUL_STAIN_DROPS = 3;

/**
 * Faults active on the slide as it stands.
 *
 * Ordered as the content fault table is, so a student comparing the two sees them in
 * the same order.
 */
export function activeFaultIds(state: BenchState): FaultId[] {
  const { slide, scope } = state;
  const faults: FaultId[] = [];

  // Air is trapped by dropping the coverslip flat; lowering it from one edge pushes the
  // air out ahead of the glass.
  if (slide.coverslip === "drop") faults.push("air-bubbles");

  // Only judged once the mount is closed. Before the coverslip goes on, "no stain yet"
  // is simply where you are in the method, not a mistake.
  if (slide.coverslip !== null && slide.stainDrops === 0) faults.push("no-stain");

  if (slide.stainDrops > MAX_USEFUL_STAIN_DROPS) faults.push("over-stained");

  // The outer epidermis comes away several cells thick; an unflattened peel has folds.
  // Either way there is no single plane everything can be sharp in.
  if (slide.specimen && (slide.specimen.surface === "outer" || !slide.specimen.flattened)) {
    faults.push("too-thick");
  }

  if (slide.specimen !== null && !slide.water) faults.push("dry-mount");

  if (slide.coverslip !== null && !slide.blotted) faults.push("drifting-coverslip");

  if (state.ended === "cracked-slide") faults.push("cracked-slide");

  // Starting the search at anything above the lowest power means hunting for cells in a
  // 450 µm field instead of a 4500 µm one.
  if (scope.firstObjectiveViewed !== null && scope.firstObjectiveViewed !== 40) {
    faults.push("lost-at-high-power");
  }

  if (slide.stainedBeforeGoggles) faults.push("no-goggles");

  return faults;
}

/** Faults on this slide plus any carried over from an earlier, abandoned one. */
export function allFaultIds(state: BenchState): FaultId[] {
  const active = new Set<string>(activeFaultIds(state));
  for (const id of state.historicFaults) active.add(id);
  return FAULT_IDS.filter((id) => active.has(id));
}

export const hasFault = (state: BenchState, id: FaultId): boolean =>
  activeFaultIds(state).includes(id);

/**
 * How the field of view is spoiled, as numbers the renderer and the description can
 * both read. Keeping this derived — rather than letting the SVG decide for itself —
 * is what keeps the picture and the screen-reader text describing the same slide.
 */
export type FieldImpairment = {
  /** Round, dark-rimmed circles floating over the field. */
  bubbles: number;
  /** 0 = no stain at all, 1 = correctly stained, >1 = opaque. */
  stainStrength: number;
  /** Extra blur that focusing cannot remove, because there is no single focal plane. */
  irreducibleBlur: number;
  /** The mount is drying at the edges. */
  shrivelled: boolean;
  /** The coverslip is creeping, so the field drifts. */
  drifting: boolean;
};

export function fieldImpairment(state: BenchState): FieldImpairment {
  const faults = new Set(activeFaultIds(state));

  return {
    // Deterministic from the state rather than random, so a slide looks the same every
    // time it is rendered and a test can assert on it.
    bubbles: faults.has("air-bubbles") ? 2 + (state.slide.stainDrops % 4) : 0,
    stainStrength: faults.has("no-stain")
      ? 0
      : faults.has("over-stained")
        ? 1 + (state.slide.stainDrops - MAX_USEFUL_STAIN_DROPS) * 0.4
        : Math.min(1, state.slide.stainDrops / 2),
    irreducibleBlur: faults.has("too-thick") ? 4 : 0,
    shrivelled: faults.has("dry-mount"),
    drifting: faults.has("drifting-coverslip"),
  };
}
