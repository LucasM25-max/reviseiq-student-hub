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

const components = {
  h3: (props: ComponentPropsWithoutRef<"h3">) => (
    <h3 className="mt-6 mb-2 text-lg font-semibold text-[var(--foreground)]" {...props} />
  ),
  h4: (props: ComponentPropsWithoutRef<"h4">) => (
    <h4 className="mt-5 mb-2 font-semibold text-[var(--foreground)]" {...props} />
  ),
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

export function Markdown({ children, className }: { children: string; className?: string }) {
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
