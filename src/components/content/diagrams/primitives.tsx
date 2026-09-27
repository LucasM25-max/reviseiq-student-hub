/**
 * Small shared SVG pieces so every diagram labels things the same way.
 *
 * Labels are real <text>, not paths, so they can be read by a screen reader, found by
 * browser search, and translated. Leader lines are straight, which is the same rule the
 * content applies to students' own biological drawings.
 */
import type { ReactNode } from "react";

/** A straight leader line from a structure to its label. */
export function Leader({ d }: { d: string }) {
  return (
    <path
      d={d}
      className="stroke-[var(--muted-foreground)]"
      strokeWidth="1.25"
      fill="none"
      strokeLinecap="round"
    />
  );
}

/** Plain text on the canvas. Used for captions and axis furniture. */
export function Label({
  x,
  y,
  children,
  anchor = "start",
  bold = false,
}: {
  x: number;
  y: number;
  children: ReactNode;
  anchor?: "start" | "middle" | "end";
  bold?: boolean;
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fontWeight={bold ? 700 : undefined}
      className="fill-[var(--foreground)] text-[13px]"
      style={{ fontFamily: "var(--font-sans)" }}
    >
      {children}
    </text>
  );
}

/** Whether a structure's label should be drawn, given the block's `labels` setting. */
export function labelVisible(key: string, labels: "all" | "none" | string[]): boolean {
  if (labels === "all") return true;
  if (labels === "none") return false;
  return labels.includes(key);
}

/**
 * One labelled structure: a leader line plus its caption.
 *
 * The two modes are deliberately exclusive.
 *
 *   - Normally the structure's **name** is drawn ("Permanent vacuole").
 *   - If the structure is in `letters`, only its **letter** is drawn ("B").
 *
 * That second rule is the important one. These diagrams are reused in exam questions
 * such as q03, "Name the structures labelled A, B and C" — so if a lettered structure
 * also printed its name, the diagram would hand the student the answer. Making
 * `letters` mean "letter instead of name" rather than "letter as well as name" means
 * the giveaway cannot be reintroduced by passing the wrong combination of props.
 *
 * A lettered structure is always drawn, whatever `labels` says, because the question
 * stem refers to it.
 */
export function StructureLabel({
  structure,
  name,
  x,
  y,
  leader,
  anchor = "start",
  labels,
  letters,
}: {
  /** Registry structure key, e.g. "permanent-vacuole". */
  structure: string;
  /** What the label reads when the name is shown. */
  name: string;
  x: number;
  y: number;
  /** SVG path for the leader line, from the structure to the label. */
  leader: string;
  anchor?: "start" | "middle" | "end";
  labels: "all" | "none" | string[];
  letters?: string[];
}) {
  const letterIndex = letters?.indexOf(structure) ?? -1;
  const lettered = letterIndex >= 0;

  if (!lettered && !labelVisible(structure, labels)) return null;

  return (
    <>
      <Leader d={leader} />
      <Label x={x} y={y} anchor={anchor} bold={lettered}>
        {lettered ? String.fromCharCode(65 + letterIndex) : name}
      </Label>
    </>
  );
}
