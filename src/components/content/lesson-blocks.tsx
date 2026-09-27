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
import { WidgetBlock } from "@/components/content/widgets";
import { GatedCheck, type RecordedCheck } from "@/components/learn/gated-check";
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

/**
 * What the lesson runner needs to turn a `check` block into a persisted gate.
 *
 * Absent when blocks are rendered outside a lesson — a preview, a test — in which case a
 * check falls back to the self-check version that keeps its answer in React state and
 * gates nothing.
 */
export type RunnerContext = {
  lessonId: string;
  /** Lesson path, for the action to redirect back to. */
  path: string;
  /** ISO timestamp of this render, used to measure time on the step. */
  stepStartedAt: string;
  /** Answers already recorded, keyed by block index. */
  checks: Record<number, RecordedCheck>;
};

function BlockBody({
  block,
  seed,
  index,
  runner,
}: {
  block: LessonBlock;
  seed: string;
  index: number;
  runner?: RunnerContext;
}) {
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
          {/* h2, not h4: the lesson page owns the h1, and a worked example is a
              top-level section under it. Jumping straight to h4 would leave a hole in
              the outline a screen-reader user navigates by. Sized by class, not by
              level. tests/lesson-blocks.test.ts checks the levels never skip. */}
          <h2 className="mb-2 font-semibold">{block.title}</h2>
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
      // Inside a lesson a check is a gate, so the answer has to be persisted or a reload
      // would lock the student out of content they had already unlocked. Outside one it
      // is a self-check and stays entirely client-side.
      return runner ? (
        <GatedCheck
          lessonId={runner.lessonId}
          path={runner.path}
          blockIndex={index}
          prompt={block.prompt}
          options={block.options}
          correctKey={block.correctKey}
          explanation={block.explanation}
          recorded={runner.checks[index]}
          stepStartedAt={runner.stepStartedAt}
        />
      ) : (
        <CheckBlock
          prompt={block.prompt}
          options={block.options}
          correctKey={block.correctKey}
          explanation={block.explanation}
        />
      );

    case "widget":
      // The four generic engines land in Phase 4; the microscope simulation in Phase 4b.
      // `WidgetBlock` renders whichever exists and an honest placeholder for the one that
      // does not, so an unbuilt engine is visible rather than a hole in the lesson.
      return (
        <WidgetBlock
          widgetId={block.widgetId}
          config={block.config}
          seed={`${seed}:${index}`}
        />
      );

    default: {
      // Exhaustiveness: adding a block type to the schema without handling it here is a
      // compile error, not a blank space on the page.
      const never: never = block;
      void never;
      return null;
    }
  }
}

export function LessonBlocks({
  blocks,
  seed = "lesson",
  startIndex = 0,
  runner,
}: {
  blocks: LessonBlock[];
  /**
   * Seeds the deterministic shuffles inside widgets. Pass the lesson id so two widgets
   * of the same kind in different lessons do not present an identical scramble.
   */
  seed?: string;
  /** Index of `blocks[0]` within the whole lesson, so widget seeds stay stable when the
   * array is sliced for progressive reveal. */
  startIndex?: number;
  /** Present when these blocks are being read inside the lesson runner. */
  runner?: RunnerContext;
}) {
  return (
    <div>
      {blocks.map((block, offset) => {
        const index = startIndex + offset;
        const body = <BlockBody block={block} seed={seed} index={index} runner={runner} />;
        return <div key={index}>{block.recap ? <Recap>{body}</Recap> : body}</div>;
      })}
    </div>
  );
}
