/**
 * Markdown + maths renderer for content prose.
 *
 * **Why not MDX** (a deliberate, recorded deviation from docs/plan/04-content-pipeline.md):
 * lesson blocks were always specified as typed data, and interactivity is expressed as
 * `widget` blocks referenced by id (D40). MDX would let a content file contain arbitrary
 * JSX — which cannot be validated by zod, cannot be safely stored as a row in Postgres,
 * and can execute. Markdown gives us the formatting and KaTeX gives us the maths, with
 * content that stays inert data all the way to the database.
 *
 * KaTeX is used rather than MathJax because its fonts ship inside the npm package, so
 * nothing is fetched from a CDN at runtime.
 *
 * Safety: `react-markdown` does not render raw HTML unless `rehype-raw` is added, and it
 * is not. Content is authored in-repo and reviewed, but defence in depth is free here.
 */
import "katex/dist/katex.min.css";

import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

import { cn } from "@/lib/utils";

/**
 * Headings are rendered at a depth that depends on where the body sits.
 *
 * An author always writes `##` for "a section inside this body" and `###` for a
 * sub-section, and does not have to know what the surrounding page looks like. The
 * container supplies the offset:
 *
 *   - a lesson prose block sits under the page's `h1`, so offset 0 → `##` becomes `<h2>`
 *   - a note section body already sits under the section's `h2`, so offset 1 → `<h3>`
 *
 * Without this, the same markdown produced a heading that skipped a level in one place
 * and not the other, which leaves a hole in the outline a screen-reader user navigates
 * by. The visual size follows the level the author wrote, not the level it lands at, so
 * a `##` looks the same wherever it is used.
 */
const HEADING_CLASS: Record<number, string> = {
  2: "mt-6 mb-2 text-lg font-semibold text-[var(--foreground)]",
  3: "mt-5 mb-2 font-semibold text-[var(--foreground)]",
  4: "mt-4 mb-1.5 font-semibold text-[var(--foreground)]",
  5: "mt-4 mb-1.5 text-sm font-semibold text-[var(--foreground)]",
  6: "mt-4 mb-1.5 text-sm font-semibold text-[var(--muted-foreground)]",
};

function headingRenderer(authored: number, offset: number) {
  const level = Math.min(6, authored + offset);
  const Tag = `h${level}` as "h2" | "h3" | "h4" | "h5" | "h6";
  const Component = (props: ComponentPropsWithoutRef<"h2">) => (
    <Tag className={HEADING_CLASS[authored] ?? HEADING_CLASS[6]} {...props} />
  );
  Component.displayName = `Heading${authored}to${level}`;
  return Component;
}

const staticComponents = {
  p: (props: ComponentPropsWithoutRef<"p">) => <p className="my-3 leading-7" {...props} />,
  ul: (props: ComponentPropsWithoutRef<"ul">) => (
    <ul className="my-3 list-disc space-y-1 pl-6 leading-7" {...props} />
  ),
  ol: (props: ComponentPropsWithoutRef<"ol">) => (
    <ol className="my-3 list-decimal space-y-1 pl-6 leading-7" {...props} />
  ),
  strong: (props: ComponentPropsWithoutRef<"strong">) => (
    <strong className="font-semibold text-[var(--foreground)]" {...props} />
  ),
  code: (props: ComponentPropsWithoutRef<"code">) => (
    <code
      className="rounded bg-[var(--muted)] px-1.5 py-0.5 text-[0.9em]"
      style={{ fontFamily: "var(--font-mono)" }}
      {...props}
    />
  ),
  table: (props: ComponentPropsWithoutRef<"table">) => (
    <div className="my-4 overflow-x-auto">
      <table className="w-full border-collapse text-sm" {...props} />
    </div>
  ),
  th: (props: ComponentPropsWithoutRef<"th">) => (
    <th
      className="border border-[var(--border)] bg-[var(--muted)] px-3 py-2 text-left font-semibold"
      {...props}
    />
  ),
  td: (props: ComponentPropsWithoutRef<"td">) => (
    <td className="border border-[var(--border)] px-3 py-2 align-top" {...props} />
  ),
  blockquote: (props: ComponentPropsWithoutRef<"blockquote">) => (
    <blockquote
      className="my-4 border-l-4 border-[var(--border)] pl-4 text-[var(--muted-foreground)] italic"
      {...props}
    />
  ),
  a: ({ href, ...props }: ComponentPropsWithoutRef<"a">) => {
    // Internal links go through next/link so deep links from Today are client-side
    // navigations; anything else is treated as external and opened safely.
    const target = href ?? "#";
    const internal = target.startsWith("/") || target.startsWith("#");
    if (internal) {
      return (
        <Link
          href={target}
          className="text-[var(--primary)] underline underline-offset-2 hover:text-[var(--primary-hover)]"
          {...props}
        />
      );
    }
    return (
      <a
        href={target}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[var(--primary)] underline underline-offset-2 hover:text-[var(--primary-hover)]"
        {...props}
      />
    );
  },
};

export function Markdown({
  children,
  className,
  headingOffset = 0,
}: {
  children: string;
  className?: string;
  /** How much deeper this body sits than the page's own `h1`. See headingRenderer. */
  headingOffset?: number;
}) {
  const components = {
    ...staticComponents,
    // `#` is rejected by the content schema, but map it anyway so a stray one degrades
    // to a sensible depth instead of emitting a second `<h1>` on the page.
    h1: headingRenderer(2, headingOffset),
    h2: headingRenderer(2, headingOffset),
    h3: headingRenderer(3, headingOffset),
    h4: headingRenderer(4, headingOffset),
    h5: headingRenderer(5, headingOffset),
    h6: headingRenderer(6, headingOffset),
  };

  return (
    <div className={cn("text-[var(--foreground)]", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={components}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
