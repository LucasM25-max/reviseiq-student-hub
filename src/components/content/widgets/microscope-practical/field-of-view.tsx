"use client";

import { useId } from "react";

import { fieldImpairment } from "@/lib/practicals/microscope/faults";
import {
  describeField,
  fieldOptics,
  ONION_CELL_LENGTH_UM,
} from "@/lib/practicals/microscope/optics";
import type { BenchState } from "@/lib/practicals/microscope/state";

/**
 * What you see down the eyepiece.
 *
 * Everything here is derived from the bench state — blur, contrast, brightness, cell
 * size, where the bubbles are. Nothing is randomised at render time, so the same slide
 * always looks the same and the description beside it can be asserted in a test.
 *
 * The tissue is drawn as a repeating `<pattern>` rather than as one node per cell. At
 * ×40 a real field holds roughly fifteen cells across and fifty down, and emitting
 * those individually cost 1,334 SVG nodes and 240 KB of markup for a single widget —
 * re-rendered on every turn of the focus knob. A pattern is six nodes at any
 * magnification and looks identical.
 *
 * The picture is `aria-hidden`. The real description lives in the live region below it,
 * because a field of view is the one thing here that cannot be conveyed by labelling a
 * control.
 */

/** Trims float noise like `-116.66666666666666` out of the markup. */
const r2 = (value: number) => Math.round(value * 100) / 100;

export function FieldOfView({ state }: { state: BenchState }) {
  // Scoped ids: two of these on one page would otherwise share a blur filter, and each
  // would be rendered with the other's focus.
  const uid = useId().replace(/:/g, "");
  const clipId = `ms-clip-${uid}`;
  const blurId = `ms-blur-${uid}`;
  const cellsId = `ms-cells-${uid}`;
  const vignetteId = `ms-vignette-${uid}`;

  const optics = fieldOptics(state);
  const impairment = fieldImpairment(state);
  const viewable = state.slide.mounted && state.slide.specimen !== null && state.ended === null;

  // One cell's size on screen follows straight from the field of view: if fifteen cells
  // fit across 4500 µm, fifteen fit across the 200-unit circle.
  const cellWidth = 200 / Math.max(1, optics.fieldUm / ONION_CELL_LENGTH_UM);
  const cellHeight = cellWidth * 0.42;

  // Pan moves the specimen under the lens, in the same units the field is measured in.
  const offsetX = r2((-state.scope.panX / optics.fieldUm) * 200);
  const offsetY = r2((-state.scope.panY / optics.fieldUm) * 200);

  const wallOpacity = Math.min(0.95, 0.25 + impairment.stainStrength * 0.7);
  const nucleusOpacity = Math.min(0.95, impairment.stainStrength * 0.85);
  // Below about this size a nucleus is sub-pixel. Not drawing it is also true to life:
  // low power shows you outlines, and you go up a lens to see what is inside.
  const showNuclei = cellWidth >= 18 && nucleusOpacity > 0.05;

  const wall = r2(Math.max(0.35, cellWidth * 0.03));
  const cellFill = impairment.shrivelled ? "#c8a06a" : "#e8c893";

  /**
   * One cell, drawn at an offset inside the pattern tile.
   *
   * A dried-out cell is drawn as an empty wall with its contents shrunk inside it. That
   * gap is the whole visible signature of a dry mount — the content promises the cells
   * "shrivel, the edges darken, and the specimen curls away", and a slightly duller
   * fill did not show any of it.
   */
  const cell = (x: number, y: number, key: string) => {
    const inset = impairment.shrivelled ? cellHeight * 0.22 : 0;

    return (
      <g key={key}>
        <rect
          x={r2(x)}
          y={r2(y)}
          width={r2(cellWidth)}
          height={r2(cellHeight)}
          rx={r2(cellHeight * 0.18)}
          fill={impairment.shrivelled ? "none" : cellFill}
          fillOpacity={r2(impairment.stainStrength * 0.5)}
          stroke="#8a5a22"
          strokeOpacity={r2(wallOpacity)}
          strokeWidth={wall}
        />
        {impairment.shrivelled ? (
          <rect
            x={r2(x + inset)}
            y={r2(y + inset)}
            width={r2(Math.max(0.5, cellWidth - inset * 2))}
            height={r2(Math.max(0.5, cellHeight - inset * 2))}
            rx={r2(cellHeight * 0.3)}
            fill={cellFill}
            fillOpacity={r2(Math.min(0.95, 0.35 + impairment.stainStrength * 0.5))}
            stroke="#5d3a12"
            strokeOpacity={r2(Math.min(1, wallOpacity + 0.25))}
            strokeWidth={r2(wall * 1.4)}
          />
        ) : null}
        {showNuclei ? (
          <ellipse
            cx={r2(x + cellWidth * 0.5)}
            cy={r2(y + cellHeight * 0.5)}
            rx={r2(cellWidth * 0.11)}
            ry={r2(cellHeight * 0.22)}
            fill="#6b3410"
            fillOpacity={r2(nucleusOpacity)}
          />
        ) : null}
      </g>
    );
  };

  return (
    <div>
      <div className="mx-auto max-w-sm">
        <svg
          viewBox="-110 -110 220 220"
          className="w-full rounded-full bg-[#1a1408]"
          role="img"
          aria-hidden="true"
        >
          <defs>
            <clipPath id={clipId}>
              <circle cx="0" cy="0" r="100" />
            </clipPath>
            <filter id={blurId} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation={r2(optics.blur * 0.35)} />
            </filter>
            <radialGradient id={vignetteId}>
              <stop offset="70%" stopColor="#000" stopOpacity="0" />
              <stop offset="100%" stopColor="#000" stopOpacity="0.55" />
            </radialGradient>

            {/*
              Two rows per tile, the second offset by half a cell, so the tissue reads as
              staggered bricks rather than a grid. The half-cells either side of the tile
              are completed by the neighbouring tile.
            */}
            {viewable ? (
              <pattern
                id={cellsId}
                patternUnits="userSpaceOnUse"
                width={r2(cellWidth)}
                height={r2(cellHeight * 2)}
                patternTransform={`translate(${offsetX} ${offsetY})`}
              >
                {cell(0, 0, "a")}
                {cell(-cellWidth / 2, cellHeight, "b")}
                {cell(cellWidth / 2, cellHeight, "c")}
              </pattern>
            ) : null}
          </defs>

          {/* The lamp, dimmed or flared by the iris. */}
          <circle cx="0" cy="0" r="100" fill="#f7ecd2" opacity={r2(optics.brightness * 0.8)} />

          {viewable ? (
            <g clipPath={`url(#${clipId})`} filter={`url(#${blurId})`}>
              <rect
                x="-110"
                y="-110"
                width="220"
                height="220"
                fill={`url(#${cellsId})`}
                opacity={r2(optics.contrast)}
              />

              {/* Too much iodine: a dark wash over everything, which is what actually
                  hides the structures. Under-staining is faint; over-staining is dark. */}
              {optics.wash > 0 ? (
                <circle cx="0" cy="0" r="100" fill="#6b3410" fillOpacity={r2(optics.wash)} />
              ) : null}

              {/* Air bubbles: a hard dark rim round a bright centre, which is exactly
                  how they are told apart from cells in the exam. */}
              {Array.from({ length: impairment.bubbles }, (_, index) => {
                const angle = (index / Math.max(1, impairment.bubbles)) * Math.PI * 2;
                return (
                  <circle
                    key={index}
                    cx={r2(Math.cos(angle) * 45)}
                    cy={r2(Math.sin(angle) * 40)}
                    r={14 + index * 3}
                    fill="#fdf6e6"
                    fillOpacity="0.35"
                    stroke="#3a2a12"
                    strokeWidth="3.5"
                  />
                );
              })}
            </g>
          ) : null}

          {state.ended === "cracked-slide" ? (
            <g clipPath={`url(#${clipId})`} stroke="#2b1b08" strokeWidth="2.5" fill="none">
              <path d="M-100 -30 L-20 5 L15 -25 L60 20 L100 10" />
              <path d="M-20 5 L-35 70" />
              <path d="M15 -25 L30 -95" />
            </g>
          ) : null}

          <circle cx="0" cy="0" r="100" fill={`url(#${vignetteId})`} />
          <circle cx="0" cy="0" r="100" fill="none" stroke="var(--border)" strokeWidth="2" />
        </svg>
      </div>

      {/*
        The description, not a caption. It is the accessible equivalent of the picture
        above, so it is always rendered and always current.
      */}
      <p
        role="status"
        aria-live="polite"
        className="mt-3 rounded-md bg-[var(--muted)]/60 px-3 py-2 text-sm text-[var(--muted-foreground)]"
      >
        <span className="font-medium text-[var(--foreground)]">Down the eyepiece: </span>
        {describeField(state)}
      </p>
    </div>
  );
}
