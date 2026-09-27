/**
 * Renders the ten lesson block types (doc 01 §3).
 *
 * Each block is a distinct visual treatment, because the type carries meaning: a
 * misconception must not look like a key idea, and a definition must be findable at a
 * glance when a student is skimming before a test.
 *
 * Every block here is a server component. `check` blocks need interaction, so that one
 * is a small client island — the rest ship no JavaScript at all.
 */
import { Diagram } from "@/components/content/diagram";
import { Markdown } from "@/components/content/markdown";
import { getWidget } from "@/lib/content/widgets";
import type { LessonBlock } from "@/lib/content/schema";

import { CheckBlock } from "./check-block";

function Recap({ children }: { children: React.ReactNode }) {
  // D39: prior-stage material is taught in full by default, but collapsible, so a
  // confident student can skip it without it being hidden from anyone else.
  return (
    <details
      open
      className="my-6 rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 px-4 py-3"
    >
      <summary className="cursor-pointer text-sm font-medium text-[var(--muted-foreground)]">
        Recap from earlier study
      </summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}

function BlockBody({ block }: { block: LessonBlock }) {
  switch (block.type) {
    case "prose":
      return <Markdown>{block.body}</Markdown>;

    case "keyIdea":
      return (
        <aside className="my-6 rounded-lg border-l-4 border-[var(--primary)] bg-[var(--secondary)] px-4 py-3">
          <p className="mb-1 text-xs font-semibold tracking-wide text-[var(--primary)] uppercase">
            Key idea
          </p>
          <Markdown>{block.body}</Markdown>
        </aside>
      );

    case "definition":
      return (
        <dl className="my-5 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3">
          <dt className="font-semibold text-[var(--foreground)]">{block.term}</dt>
          <dd className="mt-1 text-[var(--muted-foreground)]">
            <Markdown>{block.body}</Markdown>
          </dd>
        </dl>
      );

    case "example":
      return (
        <section className="my-6 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3">
          <p className="mb-2 text-xs font-semibold tracking-wide text-[var(--muted-foreground)] uppercase">
            Worked example
          </p>
          <h4 className="mb-2 font-semibold">{block.title}</h4>
          <ol className="list-decimal space-y-2 pl-5 leading-7">
            {block.steps.map((step, index) => (
              <li key={index}>
                <Markdown className="[&>p:first-child]:mt-0 [&>p:last-child]:mb-0">
                  {step}
                </Markdown>
              </li>
            ))}
          </ol>
        </section>
      );

    case "diagram":
      return (
        <Diagram diagramId={block.diagramId} labels={block.labels} caption={block.caption} />
      );

    case "misconception":
      return (
        <aside className="my-6 rounded-lg border border-[var(--warning-border)] bg-[var(--warning-surface)] px-4 py-3">
          <p className="mb-1 text-xs font-semibold tracking-wide text-[var(--warning)] uppercase">
            Common mistake
          </p>
          <p className="font-medium line-through decoration-[var(--warning)]/60">
            {block.claim}
          </p>
          <div className="mt-2">
            <Markdown>{block.correction}</Markdown>
          </div>
        </aside>
      );

    case "summary":
      return (
        <section className="my-6 rounded-lg border border-[var(--border)] bg-[var(--muted)]/50 px-4 py-3">
          <p className="mb-2 text-xs font-semibold tracking-wide text-[var(--muted-foreground)] uppercase">
            Summary
          </p>
          <Markdown>{block.body}</Markdown>
        </section>
      );

    case "check":
      return (
        <CheckBlock
          prompt={block.prompt}
          options={block.options}
          correctKey={block.correctKey}
          explanation={block.explanation}
        />
      );

    case "widget": {
      // Widget engines arrive in Phase 4 / 4b (D40). Until then the block is rendered as
      // an honest placeholder naming the engine and the phase, rather than silently
      // dropped — a student should be able to see that something is meant to be here.
      const widget = getWidget(block.widgetId);
      return (
        <aside className="my-6 rounded-lg border border-dashed border-[var(--border)] bg-[var(--muted)]/30 px-4 py-4">
          <p className="text-xs font-semibold tracking-wide text-[var(--muted-foreground)] uppercase">
            Interactive · {widget?.plannedPhase ?? "planned"}
          </p>
          <p className="mt-1 font-medium">{widget?.title ?? block.widgetId}</p>
          {widget ? (
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">{widget.description}</p>
          ) : null}
        </aside>
      );
    }

    default: {
      // Exhaustiveness: adding a block type to the schema without handling it here is a
      // compile error, not a blank space on the page.
      const never: never = block;
      void never;
      return null;
    }
  }
}

export function LessonBlocks({ blocks }: { blocks: LessonBlock[] }) {
  return (
    <div>
      {blocks.map((block, index) => {
        const body = <BlockBody block={block} />;
        return <div key={index}>{block.recap ? <Recap>{body}</Recap> : body}</div>;
      })}
    </div>
  );
}
