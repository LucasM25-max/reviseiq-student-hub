/**
 * Eyepiece graticule arithmetic, and the magnification of the drawing.
 *
 * AQA's own calibration from the teachers' notes: **90 divisions measure 240 µm at
 * ×400**. Everything else scales from that one fixture, which is deliberate — it means
 * a test can assert the published number directly rather than a figure we invented.
 *
 * The final calculation is the point of the whole practical: it is multi-step, it
 * converts units, and its answer is *not* the microscope's magnification. Students
 * write ×400 under the drawing constantly, and the arithmetic here is what makes the
 * difference visible.
 */
import type { TotalMagnification } from "./state";

/** AQA's published calibration, at ×400. */
export const CALIBRATION = { divisions: 90, micrometres: 240, atTotal: 400 as const };

/**
 * Micrometres per graticule division at a given total magnification.
 *
 * The graticule sits in the eyepiece, so its divisions stay the same size on the
 * retina while the specimen grows: doubling magnification halves what a division
 * measures. Hence the inverse scaling from the ×400 fixture — ×40 → 26.67 µm,
 * ×100 → 10.67 µm, ×400 → 2.67 µm.
 */
export function umPerDivision(total: TotalMagnification): number {
  const at400 = CALIBRATION.micrometres / CALIBRATION.divisions;
  return at400 * (CALIBRATION.atTotal / total);
}

/** The length a reading of `divisions` represents, in micrometres. */
export function measuredLengthUm(
  divisions: number,
  total: TotalMagnification,
  calibratedUmPerDivision: number | null = null,
): number {
  const perDivision = calibratedUmPerDivision ?? umPerDivision(total);
  return divisions * perDivision;
}

export const UM_PER_MM = 1000;

export const umToMm = (um: number) => um / UM_PER_MM;
export const mmToUm = (mm: number) => mm * UM_PER_MM;

/**
 * Magnification of the *drawing*: how many times larger it is than the real cell.
 *
 * Both lengths must be in the same unit before dividing, which is where most of the
 * marks are lost. It is a ratio, so it has no unit.
 */
export function drawingMagnification(
  drawnLengthMm: number,
  actualLengthUm: number,
): number | null {
  if (!Number.isFinite(drawnLengthMm) || !Number.isFinite(actualLengthUm)) return null;
  if (drawnLengthMm <= 0 || actualLengthUm <= 0) return null;
  return mmToUm(drawnLengthMm) / actualLengthUm;
}

export type MagnificationWorking = {
  divisions: number;
  umPerDivision: number;
  actualLengthUm: number;
  actualLengthMm: number;
  drawnLengthMm: number;
  magnification: number;
  /** The microscope's magnification, which is the number students wrongly write down. */
  microscopeMagnification: TotalMagnification;
  /** True when the two are close enough that the student may not notice the difference. */
  confusable: boolean;
};

/**
 * The full working, step by step, so the student can be shown where their number came
 * from rather than just whether it was right.
 */
export function magnificationWorking(
  divisions: number,
  total: TotalMagnification,
  drawnLengthMm: number,
  calibratedUmPerDivision: number | null = null,
): MagnificationWorking | null {
  const perDivision = calibratedUmPerDivision ?? umPerDivision(total);
  const actualLengthUm = divisions * perDivision;
  const magnification = drawingMagnification(drawnLengthMm, actualLengthUm);
  if (magnification === null) return null;

  return {
    divisions,
    umPerDivision: perDivision,
    actualLengthUm,
    actualLengthMm: umToMm(actualLengthUm),
    drawnLengthMm,
    magnification,
    microscopeMagnification: total,
    confusable: Math.abs(magnification - total) / total < 0.1,
  };
}

/**
 * Whether a stated magnification is close enough to the student's own measurements.
 *
 * A 5% window, because they measured the drawing with an on-screen ruler and read a
 * graticule by eye. Tighter than that would mark arithmetic as wrong when the real
 * variation is in the reading.
 */
export const MAGNIFICATION_TOLERANCE = 0.05;

export function checkStatedMagnification(
  stated: number,
  working: MagnificationWorking,
): { correct: boolean; wroteMicroscopeMagnification: boolean; expected: number } {
  const expected = working.magnification;
  const correct = Math.abs(stated - expected) <= expected * MAGNIFICATION_TOLERANCE;

  return {
    correct,
    // The classic error, and worth naming separately: it earns a specific correction
    // rather than a bare "wrong".
    wroteMicroscopeMagnification:
      !correct &&
      Math.abs(stated - working.microscopeMagnification) <=
        working.microscopeMagnification * MAGNIFICATION_TOLERANCE,
    expected,
  };
}
