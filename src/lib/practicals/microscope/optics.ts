/**
 * Just enough optics to make technique matter.
 *
 * The model exists to teach one thing: depth of field collapses as magnification rises,
 * which is why AQA step 14 says to use the *fine* adjustment at high power and why you
 * find the cells at ×40 first. Everything here serves that; nothing models a real
 * microscope beyond it.
 */
import { fieldImpairment } from "./faults";
import { objectiveOf, type BenchState, type TotalMagnification } from "./state";

/**
 * Field of view diameter in micrometres.
 *
 * `18000 / objective`: ×4 → 4500 µm, ×10 → 1800 µm, ×40 → 450 µm. An onion cell is
 * 250–350 µm long, so one nearly fills the field at ×400 and about fifteen sit across
 * it at ×40 — which is the whole reason for searching at low power.
 */
export const fieldDiameterUm = (total: TotalMagnification): number =>
  18000 / objectiveOf(total);

/**
 * How unforgiving focus is at each magnification.
 *
 * Rises sharply, so at ×400 a few micrometres of stage error is visible blur while at
 * ×40 the same error is nothing.
 */
export const depthFactor = (total: TotalMagnification): number =>
  ({ 40: 0.05, 100: 0.2, 400: 1 })[total];

/** The stage height at which the specimen is sharp. The specimen sits at the datum. */
export const FOCAL_PLANE = 0;

/** Blur beyond this is total: the field is an even grey and nothing is resolvable. */
export const MAX_BLUR = 12;

export type FieldOptics = {
  /** Micrometres of stage error away from the focal plane. */
  focusError: number;
  /** Rendered blur radius in pixels, 0–12. */
  blur: number;
  /** 0–1, where 1 is sharp. */
  sharpness: number;
  /** Field of view diameter in micrometres. */
  fieldUm: number;
  /** CSS brightness multiplier from the iris. */
  brightness: number;
  /**
   * How distinguishable the structures are, 0–1.2.
   *
   * Low at both ends of the stain range, but for opposite reasons — see `wash`.
   */
  contrast: number;
  /**
   * How heavily a dark iodine wash covers the field, 0–1.
   *
   * This is what separates the two staining faults. Too little stain leaves a faint,
   * washed-out field; too much leaves a *dark* one. Both hide the structures, and
   * modelling them with one number made over-staining render as pale — the opposite of
   * what the slide actually looks like, and of what the description says.
   */
  wash: number;
  /** How many onion cells fit across the field, for the text description. */
  cellsAcross: number;
  /** True when the student could reasonably call this focused. */
  inFocus: boolean;
};

/** Typical onion epidermal cell, long axis, in micrometres. */
export const ONION_CELL_LENGTH_UM = 300;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export function fieldOptics(state: BenchState): FieldOptics {
  const { scope } = state;
  const impairment = fieldImpairment(state);

  const focusError = Math.abs(scope.stageHeight - FOCAL_PLANE);

  // A specimen with folds or extra cell layers has no single sharp plane, so some blur
  // survives however carefully the student focuses. That is the visible consequence of
  // `too-thick`, and it is why the fault cannot be focused away.
  const blur = clamp(
    focusError * depthFactor(scope.objective) + impairment.irreducibleBlur,
    0,
    MAX_BLUR,
  );

  // The iris trades brightness for contrast. Wide open washes the image out; nearly
  // shut makes it dim. Around 0.6 is right, which is where the scope starts.
  const brightness = 0.55 + scope.iris * 0.75;

  // No stain leaves the cells nearly transparent; too much buries them under iodine.
  const overStained = Math.max(0, impairment.stainStrength - 1);
  const contrast =
    impairment.stainStrength === 0
      ? 0.35
      : overStained > 0
        ? Math.max(0.2, 1.2 - overStained * 0.6)
        : 0.6 + impairment.stainStrength * 0.6;

  const wash = Math.min(0.85, overStained * 0.45);

  const fieldUm = fieldDiameterUm(scope.objective);

  return {
    focusError,
    blur,
    sharpness: 1 - blur / MAX_BLUR,
    fieldUm,
    brightness,
    contrast,
    wash,
    cellsAcross: Math.max(1, Math.round(fieldUm / ONION_CELL_LENGTH_UM)),
    inFocus: blur < 1.5,
  };
}

/** How the focus reads on the live region, in the words the spec asks for (§4.8). */
export function focusDescription(blur: number): "in focus" | "nearly focused" | "blurred" {
  if (blur < 1.5) return "in focus";
  if (blur < 5) return "nearly focused";
  return "blurred";
}

/**
 * A sentence describing what is on screen, for anyone not looking at it.
 *
 * The field of view is the one part of this simulation that cannot be conveyed by
 * labelling a control, so it gets a continuously updated description instead.
 */
export function describeField(state: BenchState): string {
  if (state.ended === "cracked-slide") {
    return "The slide is cracked. The objective was driven into it. Start again with a fresh slide.";
  }
  if (!state.slide.mounted) return "No slide on the stage.";
  if (!state.slide.specimen) return "An empty slide is on the stage. Nothing to see.";

  const optics = fieldOptics(state);
  const impairment = fieldImpairment(state);
  const parts: string[] = [];

  if (impairment.stainStrength === 0) {
    parts.push("Faint, almost transparent cells, with no visible nuclei");
  } else if (impairment.stainStrength > 1) {
    parts.push("A dark orange-brown block in which no structures can be separated");
  } else {
    parts.push(
      optics.cellsAcross > 6
        ? "Many small rectangular cells in rows"
        : "A few large rectangular cells in rows, each with a stained nucleus",
    );
  }

  parts.push(focusDescription(optics.blur));

  if (impairment.bubbles > 0) {
    parts.push(
      `${impairment.bubbles} round air bubble${impairment.bubbles === 1 ? "" : "s"} with dark outlines`,
    );
  }
  if (impairment.shrivelled) parts.push("the cells look shrivelled and the edges are dark");
  if (impairment.drifting) parts.push("the field is slowly drifting");
  if (optics.brightness < 0.8) parts.push("dim");
  if (optics.brightness > 1.2) parts.push("washed out by too much light");

  return `${parts.join(", ")}. Field of view ${Math.round(optics.fieldUm)} micrometres across at ×${state.scope.objective}.`;
}
