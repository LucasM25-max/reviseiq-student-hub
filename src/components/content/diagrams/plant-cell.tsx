/**
 * Plant cell — hand-built SVG (D18).
 *
 * The same left-cell / right-label-column layout as the animal cell, for the same
 * reason: labels scattered around the shape overflowed the viewBox. Keeping the two
 * diagrams dimensionally identical also means they line up when shown side by side in
 * the comparison lesson, which is the whole point of 4.1.1.2.
 *
 * The cell wall and the cell membrane are drawn as two separate rectangles rather than
 * one thick stroke, because the single most common exam error in this topic is treating
 * them as the same structure. A plant cell has both; the wall is outside the membrane.
 */
import type { DiagramProps } from "./types";
import { StructureLabel } from "./primitives";

const LABEL_X = 400;
const LEADER_X = LABEL_X - 8;

export function PlantCell({ labels, letters }: DiagramProps) {
  const shared = { x: LABEL_X, labels, letters };

  return (
    <>
      {/* Cell wall — the outer boundary, drawn thick. */}
      <rect
        x="50"
        y="48"
        width="300"
        height="244"
        rx="10"
        className="fill-[var(--biology-surface)] stroke-[var(--biology)]"
        strokeWidth="7"
      />
      {/* Cell membrane — a separate, thinner line just inside the wall. */}
      <rect
        x="62"
        y="60"
        width="276"
        height="220"
        rx="6"
        className="fill-none stroke-[var(--biology)]"
        strokeWidth="2"
      />

      {/* Permanent vacuole — large and central, pushing everything else to the rim. */}
      <rect
        x="104"
        y="96"
        width="196"
        height="118"
        rx="26"
        className="fill-[var(--biology)] opacity-15"
      />
      <rect
        x="104"
        y="96"
        width="196"
        height="118"
        rx="26"
        className="fill-none stroke-[var(--biology)]"
        strokeWidth="2"
      />

      {/* Chloroplasts — along the top of the cytoplasm rim, plus one on the right. The
          right-hand rim is otherwise kept clear: four leaders have to pass through it,
          and an organelle sitting under one makes the label look like it points at the
          organelle instead. */}
      <g className="fill-[var(--biology)] stroke-[var(--biology)]" strokeWidth="1.5">
        {[
          [110, 78, 0],
          [168, 78, 0],
          [226, 78, 0],
          [284, 78, 0],
          [319, 120, 90],
        ].map(([cx, cy, rotation]) => (
          <ellipse
            key={`${cx}-${cy}`}
            cx={cx}
            cy={cy}
            rx="16"
            ry="9"
            opacity="0.55"
            transform={`rotate(${rotation} ${cx} ${cy})`}
          />
        ))}
      </g>

      {/* Nucleus, pushed to the bottom-left by the vacuole — a detail students are
          expected to reproduce in their own drawings. */}
      <circle cx="140" cy="248" r="27" className="fill-[var(--biology)] opacity-25" />
      <circle
        cx="140"
        cy="248"
        r="27"
        className="fill-none stroke-[var(--biology)]"
        strokeWidth="2.5"
      />
      <circle cx="148" cy="240" r="9" className="fill-[var(--biology)] opacity-50" />

      {/* Mitochondria. */}
      <g className="fill-none stroke-[var(--biology)]" strokeWidth="2.5">
        <ellipse cx="210" cy="250" rx="20" ry="10" />
        <path d="M196 252c6-6 10 4 16-2s9 4 13-2" />
        <ellipse cx="280" cy="252" rx="20" ry="10" />
        <path d="M266 254c6-6 10 4 16-2s9 4 13-2" />
      </g>

      {/* Ribosomes — in the cytoplasm rim, never inside the vacuole and never on a
          leader line. */}
      <g className="fill-[var(--foreground)] opacity-60">
        {[
          [78, 108],
          [74, 168],
          [88, 220],
          [330, 96],
          [322, 212],
          [330, 240],
        ].map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="4" />
        ))}
      </g>

      {/* Labels, top to bottom, so the leaders do not cross. */}
      <StructureLabel
        {...shared}
        structure="cell-wall"
        name="Cell wall"
        y={60}
        leader={`M300 51 L${LEADER_X} 56`}
      />
      <StructureLabel
        {...shared}
        structure="chloroplast"
        name="Chloroplasts"
        y={94}
        leader={`M300 78 L${LEADER_X} 90`}
      />
      <StructureLabel
        {...shared}
        structure="cell-membrane"
        name="Cell membrane"
        y={128}
        leader={`M338 140 L${LEADER_X} 124`}
      />
      <StructureLabel
        {...shared}
        structure="permanent-vacuole"
        name="Permanent vacuole"
        y={162}
        leader={`M300 158 L${LEADER_X} 158`}
      />
      <StructureLabel
        {...shared}
        structure="cytoplasm"
        name="Cytoplasm"
        y={196}
        leader={`M318 186 L${LEADER_X} 192`}
      />
      <StructureLabel
        {...shared}
        structure="ribosome"
        name="Ribosomes"
        y={230}
        leader={`M322 212 L${LEADER_X} 226`}
      />
      <StructureLabel
        {...shared}
        structure="mitochondrion"
        name="Mitochondria"
        y={264}
        leader={`M300 252 L${LEADER_X} 260`}
      />
      <StructureLabel
        {...shared}
        structure="nucleus"
        name="Nucleus"
        y={298}
        leader={`M159 267 L${LEADER_X} 294`}
      />
    </>
  );
}
