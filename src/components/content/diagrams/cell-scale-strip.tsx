/**
 * Scale strip — hand-built SVG (D18).
 *
 * A logarithmic axis from 10 nm to 100 µm with the structures of 4.1.1.2 marked on it.
 * The axis has to be logarithmic: a ribosome is about 20 nm and a plant cell can be
 * 100 µm, which is five thousand times larger, and on a linear axis everything except
 * the cell would sit on top of the origin. That compression is exactly the point the
 * `≪` notation in the notes is making.
 */
import type { DiagramProps } from "./types";
import { Label, labelVisible } from "./primitives";

const X0 = 46;
// The longest band ("Plant cell", 10–100 µm) ends at X1 and its label is drawn to the
// right of it, so X1 has to leave room for that label inside the viewBox. See
// tests/diagrams.test.ts, which measures it.
const X1 = 360;
/** Axis runs from 10 nm (0.01 µm) to 100 µm — four decades. */
const MIN_LOG = Math.log10(0.01);
const MAX_LOG = Math.log10(100);

const position = (micrometres: number) =>
  X0 + ((Math.log10(micrometres) - MIN_LOG) / (MAX_LOG - MIN_LOG)) * (X1 - X0);

const TICKS: { um: number; text: string }[] = [
  { um: 0.01, text: "10 nm" },
  { um: 0.1, text: "100 nm" },
  { um: 1, text: "1 µm" },
  { um: 10, text: "10 µm" },
  { um: 100, text: "100 µm" },
];

/** Each structure as a band from its smallest to its largest typical size. */
const BANDS: { key: string; name: string; from: number; to: number; row: number }[] = [
  { key: "ribosome", name: "Ribosome", from: 0.018, to: 0.022, row: 0 },
  { key: "mitochondrion", name: "Mitochondrion", from: 1, to: 2, row: 1 },
  { key: "chloroplast", name: "Chloroplast", from: 3, to: 10, row: 2 },
  { key: "nucleus", name: "Nucleus", from: 5, to: 10, row: 3 },
  { key: "cell", name: "Plant cell", from: 10, to: 100, row: 4 },
];

const ROW_Y = (row: number) => 34 + row * 17;

export function CellScaleStrip({ labels }: DiagramProps) {
  return (
    <>
      {/* Decade gridlines, drawn first so the bands sit over them. */}
      <g className="stroke-[var(--border)]" strokeWidth="1">
        {TICKS.map((tick) => (
          <line key={tick.um} x1={position(tick.um)} y1="24" x2={position(tick.um)} y2="126" />
        ))}
      </g>

      {BANDS.filter((band) => labelVisible(band.key, labels) || labels === "none").map(
        (band) => {
          const x = position(band.from);
          // A band narrower than a few pixels is invisible, so give every band a floor.
          const width = Math.max(position(band.to) - x, 5);
          const y = ROW_Y(band.row);
          return (
            <g key={band.key}>
              <rect
                x={x}
                y={y}
                width={width}
                height="10"
                rx="5"
                className="fill-[var(--biology)]"
                opacity="0.85"
              />
              <text
                x={x + width + 8}
                y={y + 9}
                className="fill-[var(--foreground)] text-[11px]"
                style={{ fontFamily: "var(--font-sans)" }}
              >
                {band.name}
              </text>
            </g>
          );
        },
      )}

      {/* Axis. */}
      <line
        x1={X0}
        y1="126"
        x2={X1}
        y2="126"
        className="stroke-[var(--foreground)]"
        strokeWidth="1.5"
      />
      <g>
        {TICKS.map((tick) => (
          <g key={tick.um}>
            <line
              x1={position(tick.um)}
              y1="126"
              x2={position(tick.um)}
              y2="132"
              className="stroke-[var(--foreground)]"
              strokeWidth="1.5"
            />
            <text
              x={position(tick.um)}
              y="146"
              textAnchor="middle"
              className="fill-[var(--muted-foreground)] text-[11px]"
              style={{ fontFamily: "var(--font-sans)" }}
            >
              {tick.text}
            </text>
          </g>
        ))}
      </g>
      <Label x={X0} y={162} anchor="start">
        Each step along the axis is ten times larger
      </Label>
    </>
  );
}
