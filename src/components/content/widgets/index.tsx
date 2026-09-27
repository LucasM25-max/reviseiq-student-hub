/**
 * Turns a `widget` block into the engine that renders it.
 *
 * A server component on purpose. It parses the authored config, resolves anything the
 * config only names (a diagram id becomes an actual diagram), and hands the result to a
 * client island. Rendering the SVG here rather than inside the island keeps three
 * diagram components out of the browser bundle and keeps the D52 lettering rule — a
 * lettered structure shows its letter *instead of* its name — in one place.
 */
import { Diagram } from "@/components/content/diagram";
import { getDiagram } from "@/lib/content/diagrams";
import { getWidget } from "@/lib/content/widgets";
import { parseWidgetConfig } from "@/lib/widgets/schemas";
import type {
  CardSortConfig,
  ComparisonTableConfig,
  LabelTheDiagramConfig,
  MicroscopePracticalConfig,
  ScaleExplorerConfig,
} from "@/lib/widgets/schemas";

import { CardSortWidget } from "./card-sort";
import { ComparisonTableWidget } from "./comparison-table";
import { LabelTheDiagramWidget, type LabelSlot } from "./label-the-diagram";
import { MicroscopePracticalWidget } from "./microscope-practical";
import { ScaleExplorerWidget } from "./scale-explorer";

/**
 * An engine that has not been built yet still gets a visible block naming it and the
 * phase that delivers it. Silently dropping it would leave a hole in a lesson with no
 * indication that anything was meant to be there.
 */
function WidgetPlaceholder({ widgetId }: { widgetId: string }) {
  const widget = getWidget(widgetId);
  return (
    <aside className="my-6 rounded-lg border border-dashed border-[var(--border)] bg-[var(--muted)]/30 px-4 py-4">
      <p className="text-xs font-semibold tracking-wide text-[var(--muted-foreground)] uppercase">
        Interactive · {widget?.plannedPhase ?? "planned"}
      </p>
      <p className="mt-1 font-medium">{widget?.title ?? widgetId}</p>
      {widget ? (
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">{widget.description}</p>
      ) : null}
    </aside>
  );
}

/**
 * Should be unreachable: `npm run content:validate` parses every config against the same
 * schema before anything is seeded. Handled anyway, because a bad config taking down a
 * whole lesson would be a much worse failure than one block saying so.
 */
function WidgetConfigError({ widgetId, detail }: { widgetId: string; detail: string }) {
  return (
    <p className="my-6 rounded-md border border-dashed border-[var(--warning-border)] bg-[var(--warning-surface)] px-4 py-3 text-sm">
      The <code>{widgetId}</code> activity could not be loaded: {detail}
    </p>
  );
}

export function WidgetBlock({
  widgetId,
  config,
  seed,
}: {
  widgetId: string;
  config: Record<string, unknown>;
  /** Stable per widget instance — it seeds the shuffles, so it must not vary per render. */
  seed: string;
}) {
  if (!getWidget(widgetId)) {
    return <WidgetConfigError widgetId={widgetId} detail="no engine of that name exists." />;
  }

  const parsed = parseWidgetConfig(widgetId, config);

  if (!parsed.ok) {
    // An engine with no schema yet fails `parseWidgetConfig`. That is the placeholder
    // case, not an error.
    if (parsed.issues.some((issue) => issue.message.startsWith("no engine for widget"))) {
      return <WidgetPlaceholder widgetId={widgetId} />;
    }
    return (
      <WidgetConfigError
        widgetId={widgetId}
        detail={parsed.issues.map((issue) => issue.message).join("; ")}
      />
    );
  }

  switch (parsed.widgetId) {
    case "label-the-diagram": {
      const labelConfig = parsed.config as LabelTheDiagramConfig;
      const diagram = getDiagram(labelConfig.diagramId);
      if (!diagram) {
        return (
          <WidgetConfigError
            widgetId={widgetId}
            detail={`no diagram "${labelConfig.diagramId}".`}
          />
        );
      }

      const keys = labelConfig.structures ?? diagram.structures.map((s) => s.key);
      const slots: LabelSlot[] = keys.flatMap((key) => {
        const structure = diagram.structures.find((candidate) => candidate.key === key);
        return structure ? [{ key, label: structure.label }] : [];
      });

      return (
        <LabelTheDiagramWidget config={labelConfig} slots={slots} seed={seed}>
          <Diagram
            diagramId={labelConfig.diagramId}
            labels="none"
            letters={slots.map((slot) => slot.key)}
            className="my-0"
          />
        </LabelTheDiagramWidget>
      );
    }

    case "comparison-table":
      return <ComparisonTableWidget config={parsed.config as ComparisonTableConfig} />;

    case "card-sort":
      return <CardSortWidget config={parsed.config as CardSortConfig} seed={seed} />;

    case "microscope-practical":
      return <MicroscopePracticalWidget config={parsed.config as MicroscopePracticalConfig} />;

    case "scale-explorer": {
      const scaleConfig = parsed.config as ScaleExplorerConfig;
      return (
        <ScaleExplorerWidget config={scaleConfig}>
          {scaleConfig.diagramId ? (
            <Diagram diagramId={scaleConfig.diagramId} labels="all" className="my-0" />
          ) : null}
        </ScaleExplorerWidget>
      );
    }

    default: {
      const never: never = parsed.widgetId;
      void never;
      return <WidgetPlaceholder widgetId={widgetId} />;
    }
  }
}
