/**
 * Animal cell — hand-built SVG (D18).
 *
 * Structure keys must match src/lib/content/diagrams.ts exactly; `content:validate`
 * checks the registry, and a unit test checks the component against the registry, so a
 * structure that exists in one and not the other fails the build.
 *
 * Layout: the cell occupies the left of the canvas and every label sits in a single
 * column on the right, joined by a straight leader. That is deliberate — labels placed
 * around the outside of the shape overflowed the viewBox and were clipped, and a single
 * column keeps the leaders from crossing (label order matches the order the structures
 * appear down the cell). tests/diagrams.test.ts measures every label against the
 * viewBox, so this cannot regress unnoticed.
 *
 * Colours come from theme tokens rather than literals so the diagram works in both
 * themes, and every label is real text so it is searchable and screen-reader legible.
 */
import type { DiagramProps } from "./types";
import { StructureLabel } from "./primitives";

/** Left edge of the label column. Leaders stop 8px short of it. */
const LABEL_X = 400;
const LEADER_X = LABEL_X - 8;

export function AnimalCell({ labels, letters }: DiagramProps) {
  const shared = { x: LABEL_X, labels, letters };

  return (
    <>
      {/* Cytoplasm fill and the cell membrane boundary are one shape: the membrane is
          its stroke, which is also how it is drawn in textbooks. */}
      <ellipse
        cx="200"
        cy="170"
        rx="150"
        ry="125"
        className="fill-[var(--biology-surface)] stroke-[var(--biology)]"
        strokeWidth="3"
      />

      {/* Nucleus, with a nucleolus so it reads as a nucleus and not a vacuole. */}
      <circle cx="172" cy="158" r="46" className="fill-[var(--biology)] opacity-25" />
      <circle
        cx="172"
        cy="158"
        r="46"
        className="fill-none stroke-[var(--biology)]"
        strokeWidth="2.5"
      />
      <circle cx="186" cy="146" r="14" className="fill-[var(--biology)] opacity-50" />

      {/* Mitochondria — lozenges with an internal crista line. The crista has to be
          rotated with its lozenge, not separately, or it escapes the outline. */}
      <g className="fill-none stroke-[var(--biology)]" strokeWidth="2.5">
        <g transform="rotate(-18 110 232)">
          <ellipse cx="110" cy="232" rx="26" ry="13" />
          <path d="M94 234c7-7 12 5 18-2s11 5 16-2" />
        </g>
        <g transform="rotate(24 278 108)">
          <ellipse cx="278" cy="108" rx="25" ry="12" />
          <path d="M263 110c7-7 11 5 17-2s10 5 15-2" />
        </g>
      </g>

      {/* Ribosomes — small filled dots scattered through the cytoplasm. None may sit on
          a leader line; the nucleus leader runs along y≈151 from x=218 rightwards. */}
      <g className="fill-[var(--foreground)] opacity-60">
        {[
          [112, 116],
          [135, 92],
          [95, 158],
          [240, 196],
          [286, 198],
          [214, 232],
          [152, 250],
          [196, 262],
          [240, 128],
          [88, 196],
        ].map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="4" />
        ))}
      </g>

      {/* Labels, top to bottom. Each leader starts on the structure it names. */}
      <StructureLabel
        {...shared}
        structure="cell-membrane"
        name="Cell membrane"
        y={66}
        leader={`M270 60 L${LEADER_X} 62`}
      />
      <StructureLabel
        {...shared}
        structure="mitochondrion"
        name="Mitochondria"
        y={110}
        leader={`M303 108 L${LEADER_X} 106`}
      />
      <StructureLabel
        {...shared}
        structure="nucleus"
        name="Nucleus"
        y={154}
        leader={`M218 152 L${LEADER_X} 150`}
      />
      <StructureLabel
        {...shared}
        structure="ribosome"
        name="Ribosomes"
        y={201}
        leader={`M290 198 L${LEADER_X} 197`}
      />
      <StructureLabel
        {...shared}
        structure="cytoplasm"
        name="Cytoplasm"
        y={249}
        leader={`M278 244 L${LEADER_X} 245`}
      />
    </>
  );
}
