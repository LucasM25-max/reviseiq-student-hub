"use client";

import { useRef, useState } from "react";

import { CANVAS } from "@/lib/practicals/microscope/drawing";
import type { Point, Stroke } from "@/lib/practicals/microscope/state";

import { WidgetButton } from "../widget-shell";

/**
 * The freehand drawing surface.
 *
 * Strokes are captured as point arrays, never as a bitmap (D47) — that is what lets the
 * geometry be marked exactly rather than guessed at by a vision model, and what makes
 * the rubric testable without a browser.
 *
 * Pointer events cover mouse, touch and stylus in one path. Anyone who cannot draw with
 * a pointer gets guided labelling instead, which is a full-credit alternative rather
 * than a consolation: the conventions being assessed — size, single lines, no shading,
 * label lines that do not cross — are all still assessed there.
 */
export function DrawingCanvas({
  strokes,
  onStroke,
  onUndo,
  disabled,
}: {
  strokes: readonly Stroke[];
  onStroke: (stroke: Stroke) => void;
  onUndo: () => void;
  disabled?: boolean;
}) {
  const surface = useRef<SVGSVGElement>(null);
  const [current, setCurrent] = useState<Point[]>([]);
  const drawing = useRef(false);

  /** Screen coordinates to canvas coordinates, accounting for CSS scaling. */
  const toCanvas = (event: React.PointerEvent): Point | null => {
    const element = surface.current;
    if (!element) return null;
    const box = element.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return null;
    return {
      x: ((event.clientX - box.left) / box.width) * CANVAS.width,
      y: ((event.clientY - box.top) / box.height) * CANVAS.height,
    };
  };

  const start = (event: React.PointerEvent) => {
    if (disabled) return;
    const point = toCanvas(event);
    if (!point) return;
    drawing.current = true;
    // Keeps the stroke coming even if the pointer leaves the SVG mid-line.
    event.currentTarget.setPointerCapture(event.pointerId);
    setCurrent([point]);
  };

  const extend = (event: React.PointerEvent) => {
    if (!drawing.current || disabled) return;
    const point = toCanvas(event);
    if (!point) return;
    setCurrent((points) => {
      const last = points.at(-1);
      // Thin out the samples: a pointer fires far more events than a line needs, and
      // every extra point is noise in the sketchiness measurement.
      if (last && Math.hypot(point.x - last.x, point.y - last.y) < 2) return points;
      return [...points, point];
    });
  };

  const finish = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (current.length >= 2) onStroke({ points: current });
    setCurrent([]);
  };

  const path = (points: readonly Point[]) =>
    points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`).join(" ");

  return (
    <div>
      <svg
        ref={surface}
        viewBox={`0 0 ${CANVAS.width} ${CANVAS.height}`}
        className="w-full touch-none rounded-md border border-[var(--border)] bg-white"
        onPointerDown={start}
        onPointerMove={extend}
        onPointerUp={finish}
        onPointerCancel={finish}
        role="img"
        aria-label={`Drawing area. ${strokes.length} stroke${strokes.length === 1 ? "" : "s"} drawn.`}
      >
        <g
          fill="none"
          stroke="#1a1a1a"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {strokes.map((stroke, index) => (
            <path key={index} d={path(stroke.points)} />
          ))}
          {current.length > 1 ? <path d={path(current)} /> : null}
        </g>
      </svg>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <WidgetButton
          variant="ghost"
          onClick={onUndo}
          disabled={disabled || strokes.length === 0}
        >
          Undo last line
        </WidgetButton>
        <span className="text-xs text-[var(--muted-foreground)]">
          Pencil lines only — no shading, and fill a good part of the space.
        </span>
      </div>
    </div>
  );
}

/**
 * The alternative to drawing: place the labels on an outline that is already there.
 *
 * Equal credit, not a lesser path. Everything the drawing rubric can decide about
 * labelling — that each one is placed and that the lines do not cross — is decided here
 * too, and the conventions the freehand canvas tests through geometry are tested here
 * through placement.
 */
export function GuidedLabelling({
  structures,
  placed,
  onPlace,
  onRemove,
  disabled,
}: {
  structures: { id: string; label: string; target: Point }[];
  placed: readonly { id: string; at: Point; target: Point }[];
  onPlace: (id: string, at: Point, target: Point) => void;
  onRemove: (id: string) => void;
  disabled?: boolean;
}) {
  const isPlaced = (id: string) => placed.some((label) => label.id === id);

  return (
    <div>
      <svg
        viewBox={`0 0 ${CANVAS.width} ${CANVAS.height}`}
        className="w-full rounded-md border border-[var(--border)] bg-white"
        role="img"
        aria-label="An outline of three onion epidermal cells, ready to be labelled."
      >
        {/* Three cells, drawn the way a good biological drawing is: outline only. */}
        <g fill="none" stroke="#1a1a1a" strokeWidth="2">
          <rect x="70" y="90" width="500" height="90" rx="10" />
          <rect x="70" y="190" width="500" height="90" rx="10" />
          <rect x="70" y="290" width="500" height="90" rx="10" />
          <ellipse cx="220" cy="135" rx="34" ry="22" />
          <ellipse cx="400" cy="235" rx="34" ry="22" />
          <ellipse cx="250" cy="335" rx="34" ry="22" />
        </g>

        {placed.map((label) => {
          const structure = structures.find((candidate) => candidate.id === label.id);
          return (
            <g key={label.id}>
              <line
                x1={label.at.x}
                y1={label.at.y}
                x2={label.target.x}
                y2={label.target.y}
                stroke="var(--primary)"
                strokeWidth="1.5"
              />
              <text
                x={label.at.x}
                y={label.at.y - 6}
                textAnchor="middle"
                className="fill-[var(--foreground)] text-[13px]"
              >
                {structure?.label ?? label.id}
              </text>
            </g>
          );
        })}
      </svg>

      <ul className="mt-3 flex flex-wrap gap-2">
        {structures.map((structure, index) => (
          <li key={structure.id}>
            <WidgetButton
              variant={isPlaced(structure.id) ? "ghost" : "primary"}
              disabled={disabled}
              onClick={() =>
                isPlaced(structure.id)
                  ? onRemove(structure.id)
                  : onPlace(
                      structure.id,
                      // Label text is parked clear of the drawing, on alternating
                      // sides, so the lines have no reason to cross.
                      { x: index % 2 === 0 ? 40 : 600, y: 60 + index * 80 },
                      structure.target,
                    )
              }
            >
              {isPlaced(structure.id)
                ? `Remove ${structure.label}`
                : `Label ${structure.label}`}
            </WidgetButton>
          </li>
        ))}
      </ul>
    </div>
  );
}
