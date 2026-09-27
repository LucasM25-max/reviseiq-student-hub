/**
 * Renders a registered diagram by id.
 *
 * Diagrams are server components: they are static SVG with no interactivity, so there is
 * no reason to ship them to the browser as JavaScript.
 *
 * Accessibility: each diagram is a labelled `img` role with a `<title>` and `<desc>`
 * from the registry, so it is announced meaningfully rather than as "graphic". The
 * labels themselves are real text inside the SVG, so a screen reader can also read the
 * parts individually.
 */
import { getDiagram } from "@/lib/content/diagrams";
import { cn } from "@/lib/utils";

import { AnimalCell } from "./diagrams/animal-cell";
import { CellScaleStrip } from "./diagrams/cell-scale-strip";
import { PlantCell } from "./diagrams/plant-cell";
import type { DiagramProps } from "./diagrams/types";

/**
 * The component table. Keys must match src/lib/content/diagrams.ts — a unit test asserts
 * the two sides agree, so a registry entry with no component (or the reverse) fails CI
 * rather than rendering nothing at runtime.
 */
const COMPONENTS: Record<string, (props: DiagramProps) => React.ReactNode> = {
  "bio-animal-cell": AnimalCell,
  "bio-plant-cell": PlantCell,
  "bio-cell-scale-strip": CellScaleStrip,
};

export const diagramComponentIds = () => Object.keys(COMPONENTS);

export function Diagram({
  diagramId,
  labels = "all",
  letters,
  caption,
  className,
}: {
  diagramId: string;
  labels?: "all" | "none" | string[];
  letters?: string[];
  caption?: string;
  className?: string;
}) {
  const meta = getDiagram(diagramId);
  const Component = COMPONENTS[diagramId];

  // Should be unreachable: `content:validate` rejects an unknown diagram id before it
  // can be seeded. Handled anyway so a bad id degrades to a visible note rather than a
  // blank space or a crashed page.
  if (!meta || !Component) {
    return (
      <p className="rounded-md border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted-foreground)]">
        Diagram <code>{diagramId}</code> is not available.
      </p>
    );
  }

  const titleId = `diagram-${diagramId}-title`;
  const descId = `diagram-${diagramId}-desc`;

  return (
    <figure className={cn("my-6", className)}>
      <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
        <svg
          viewBox={meta.viewBox}
          role="img"
          aria-labelledby={`${titleId} ${descId}`}
          className="h-auto w-full"
        >
          <title id={titleId}>{meta.title}</title>
          <desc id={descId}>{meta.description}</desc>
          <Component labels={labels} letters={letters} />
        </svg>
      </div>
      {caption ? (
        <figcaption className="mt-2 text-sm text-[var(--muted-foreground)]">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
