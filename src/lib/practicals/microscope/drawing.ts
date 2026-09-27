/**
 * Marking a biological drawing from its geometry (D47).
 *
 * Strokes are captured as point arrays, never as a bitmap, and that single decision is
 * what moves most of this rubric out of a language model's hands and into arithmetic.
 * Sketchiness, shading, size and crossing label lines are all decidable from the
 * vectors — exactly, instantly, for free, and identically every time.
 *
 * What is left for narrow AI judgement in Phase 5 is only "do these look like onion
 * epidermal cells" and "is this label pointing at the right structure". Those two are
 * marked as pending here rather than guessed, because a confident wrong tick on a
 * drawing destroys trust faster than an honest "not marked yet".
 *
 * Every mark here is **advisory**: it never alters a mastery estimate and never creates
 * a flashcard.
 */
import type { DrawingState, Point, Stroke } from "./state";

/** The drawing canvas, in its own coordinate space. */
export const CANVAS = { width: 640, height: 460 };

const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

export const strokeLength = (stroke: Stroke): number =>
  stroke.points.reduce(
    (total, point, index) =>
      index === 0 ? 0 : total + distance(stroke.points[index - 1], point),
    0,
  );

export type BoundingBox = { minX: number; minY: number; maxX: number; maxY: number };

export function boundingBox(strokes: readonly Stroke[]): BoundingBox | null {
  const points = strokes.flatMap((stroke) => stroke.points);
  if (points.length === 0) return null;

  return points.reduce<BoundingBox>(
    (box, point) => ({
      minX: Math.min(box.minX, point.x),
      minY: Math.min(box.minY, point.y),
      maxX: Math.max(box.maxX, point.x),
      maxY: Math.max(box.maxY, point.y),
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    },
  );
}

/** Fraction of the canvas the drawing occupies. */
export function coverage(strokes: readonly Stroke[]): number {
  const box = boundingBox(strokes);
  if (!box) return 0;
  return ((box.maxX - box.minX) * (box.maxY - box.minY)) / (CANVAS.width * CANVAS.height);
}

/** A drawing should fill a good part of the space it is given. */
export const MIN_COVERAGE = 0.25;

/**
 * A stroke short enough to be a sketchy repeated dash rather than a considered line.
 *
 * Feathering an outline means laying down many short strokes along the same path
 * instead of one clean one, so short strokes are the signal.
 */
export const SKETCHY_STROKE_LENGTH = 40;

export const SKETCHY_RATIO = 0.4;

export function sketchiness(strokes: readonly Stroke[]): number {
  if (strokes.length === 0) return 0;
  const short = strokes.filter((stroke) => strokeLength(stroke) < SKETCHY_STROKE_LENGTH);
  return short.length / strokes.length;
}

/**
 * Shading detection: ink laid down densely inside a small area.
 *
 * Measured as total stroke length per unit of bounding-box area. Outlines are long
 * lines around a large area; shading is a great deal of line inside a small one. The
 * threshold sits well above any plausible outline drawing.
 */
export const SHADING_DENSITY = 0.08;

export function inkDensity(strokes: readonly Stroke[]): number {
  const box = boundingBox(strokes);
  if (!box) return 0;
  const area = Math.max(1, (box.maxX - box.minX) * (box.maxY - box.minY));
  const ink = strokes.reduce((total, stroke) => total + strokeLength(stroke), 0);
  return ink / area;
}

type Segment = { a: Point; b: Point };

const orientation = (p: Point, q: Point, r: Point) =>
  Math.sign((q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y));

const onSegment = (p: Point, q: Point, r: Point) =>
  q.x <= Math.max(p.x, r.x) &&
  q.x >= Math.min(p.x, r.x) &&
  q.y <= Math.max(p.y, r.y) &&
  q.y >= Math.min(p.y, r.y);

/** Standard segment intersection, including the collinear-overlap cases. */
export function segmentsIntersect(first: Segment, second: Segment): boolean {
  const o1 = orientation(first.a, first.b, second.a);
  const o2 = orientation(first.a, first.b, second.b);
  const o3 = orientation(second.a, second.b, first.a);
  const o4 = orientation(second.a, second.b, first.b);

  if (o1 !== o2 && o3 !== o4) return true;

  if (o1 === 0 && onSegment(first.a, second.a, first.b)) return true;
  if (o2 === 0 && onSegment(first.a, second.b, first.b)) return true;
  if (o3 === 0 && onSegment(second.a, first.a, second.b)) return true;
  if (o4 === 0 && onSegment(second.a, first.b, second.b)) return true;

  return false;
}

/** Pairs of label lines that cross each other. */
export function crossingLabelLines(
  labels: readonly { id: string; at: Point; target: Point }[],
): [string, string][] {
  const crossings: [string, string][] = [];

  for (let i = 0; i < labels.length; i += 1) {
    for (let j = i + 1; j < labels.length; j += 1) {
      const first = { a: labels[i].at, b: labels[i].target };
      const second = { a: labels[j].at, b: labels[j].target };
      if (segmentsIntersect(first, second)) crossings.push([labels[i].id, labels[j].id]);
    }
  }

  return crossings;
}

export type DrawingRubricPoint = {
  id: string;
  text: string;
  /** `null` means it needs judgement we do not have yet — never a silent pass. */
  awarded: boolean | null;
  detail: string;
};

export type DrawingRubricResult = {
  points: DrawingRubricPoint[];
  awarded: number;
  /** Points that could be decided here. The pending ones are excluded. */
  decidable: number;
  pending: number;
  /** Drawing marks never feed mastery (D47). */
  advisory: true;
};

export function drawingRubric(drawing: DrawingState): DrawingRubricResult {
  const { strokes, labels, statedMagnification } = drawing;
  const empty = strokes.length === 0;

  const ratio = sketchiness(strokes);
  const density = inkDensity(strokes);
  const area = coverage(strokes);
  const crossings = crossingLabelLines(labels);

  const points: DrawingRubricPoint[] = [
    {
      id: "single-lines",
      text: "Drawn with single clear lines, not sketchy overlapping strokes",
      awarded: empty ? false : ratio < SKETCHY_RATIO,
      detail: empty
        ? "Nothing drawn yet."
        : `${Math.round(ratio * 100)}% of the strokes are short dashes.`,
    },
    {
      id: "no-shading",
      text: "No shading and no colouring in",
      awarded: empty ? false : density < SHADING_DENSITY,
      detail: empty
        ? "Nothing drawn yet."
        : density < SHADING_DENSITY
          ? "Outlines only."
          : "There is far more line than an outline drawing needs, which reads as shading.",
    },
    {
      id: "large-enough",
      text: "Drawn large enough to see",
      awarded: empty ? false : area >= MIN_COVERAGE,
      detail: empty
        ? "Nothing drawn yet."
        : `The drawing fills ${Math.round(area * 100)}% of the space; it should fill at least ${Math.round(MIN_COVERAGE * 100)}%.`,
    },
    {
      id: "label-lines",
      text: "Label lines are straight and do not cross",
      awarded: labels.length === 0 ? false : crossings.length === 0,
      detail:
        labels.length === 0
          ? "Nothing labelled yet."
          : crossings.length === 0
            ? "No label lines cross."
            : `${crossings.length} pair${crossings.length === 1 ? "" : "s"} of label lines cross.`,
    },
    {
      id: "magnification-stated",
      text: "A magnification is written underneath",
      awarded: statedMagnification !== null && Number.isFinite(statedMagnification),
      detail:
        statedMagnification === null
          ? "No magnification given. A biological drawing without one is incomplete."
          : `Stated as ×${Math.round(statedMagnification)}.`,
    },
    {
      id: "looks-like-onion",
      text: "The cells look like onion epidermal cells",
      awarded: null,
      detail: "Needs the AI marker, which arrives in Phase 5.",
    },
    {
      id: "labels-on-target",
      text: "Each label points at the structure it names",
      awarded: null,
      detail: "Needs the AI marker, which arrives in Phase 5.",
    },
  ];

  const decidable = points.filter((point) => point.awarded !== null);

  return {
    points,
    awarded: decidable.filter((point) => point.awarded === true).length,
    decidable: decidable.length,
    pending: points.length - decidable.length,
    advisory: true,
  };
}
