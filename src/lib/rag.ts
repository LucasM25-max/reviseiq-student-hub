import type { RagValue } from "@/generated/prisma/enums";

/**
 * The four RAG states (D19), and what each one actually causes to happen.
 *
 * The wording matters: a student who doesn't understand the consequence of a rating will
 * rate everything amber to be safe, and the whole plan degrades. Every place a rating is
 * shown, the consequence is shown with it.
 */

export const RAG_ORDER: RagValue[] = ["NOT_LEARNT", "RED", "AMBER", "GREEN"];

export type RagMeta = {
  value: RagValue;
  label: string;
  /** What ReviseIQ will do about it. Shown next to the control, not hidden in a tooltip. */
  consequence: string;
  /** Keyboard shortcut used by the rating grid. */
  key: string;
  /** Design-token suffix: text-rag-red, bg-rag-red-surface, and so on. */
  token: "rag-not-learnt" | "rag-red" | "rag-amber" | "rag-green";
};

export const RAG_META: Record<RagValue, RagMeta> = {
  NOT_LEARNT: {
    value: "NOT_LEARNT",
    label: "Not learnt",
    consequence: "Lessons first — once everything you have learnt is green.",
    key: "1",
    token: "rag-not-learnt",
  },
  RED: {
    value: "RED",
    label: "Red",
    consequence: "Top priority. Revision plus plenty of practice.",
    key: "2",
    token: "rag-red",
  },
  AMBER: {
    value: "AMBER",
    label: "Amber",
    consequence: "Some revision and exam questions to close the gaps.",
    key: "3",
    token: "rag-amber",
  },
  GREEN: {
    value: "GREEN",
    label: "Green",
    consequence: "A few exam questions now and then to keep it there.",
    key: "4",
    token: "rag-green",
  },
};

/** Tailwind classes per state. Written out in full so the JIT compiler can see them. */
export const RAG_CLASSES: Record<
  RagValue,
  { selected: string; idle: string; dot: string; badge: string }
> = {
  NOT_LEARNT: {
    selected: "border-rag-not-learnt bg-rag-not-learnt-surface text-foreground",
    idle: "border-border bg-card text-muted-foreground hover:border-rag-not-learnt/50",
    dot: "bg-rag-not-learnt",
    badge: "border-rag-not-learnt/30 bg-rag-not-learnt-surface text-foreground",
  },
  RED: {
    selected: "border-rag-red bg-rag-red-surface text-foreground",
    idle: "border-border bg-card text-muted-foreground hover:border-rag-red/50",
    dot: "bg-rag-red",
    badge: "border-rag-red/30 bg-rag-red-surface text-foreground",
  },
  AMBER: {
    selected: "border-rag-amber bg-rag-amber-surface text-foreground",
    idle: "border-border bg-card text-muted-foreground hover:border-rag-amber/50",
    dot: "bg-rag-amber",
    badge: "border-rag-amber/30 bg-rag-amber-surface text-foreground",
  },
  GREEN: {
    selected: "border-rag-green bg-rag-green-surface text-foreground",
    idle: "border-border bg-card text-muted-foreground hover:border-rag-green/50",
    dot: "bg-rag-green",
    badge: "border-rag-green/30 bg-rag-green-surface text-foreground",
  },
};

/** Subject accent classes, likewise spelled out for the compiler. */
export const SUBJECT_CLASSES: Record<
  string,
  { text: string; surface: string; border: string }
> = {
  biology: {
    text: "text-biology",
    surface: "bg-biology-surface",
    border: "border-biology",
  },
  chemistry: {
    text: "text-chemistry",
    surface: "bg-chemistry-surface",
    border: "border-chemistry",
  },
  physics: {
    text: "text-physics",
    surface: "bg-physics-surface",
    border: "border-physics",
  },
};

export function subjectClasses(accent: string) {
  return SUBJECT_CLASSES[accent] ?? SUBJECT_CLASSES.biology;
}
