/**
 * Deciding which missed mark points become cards (doc 07 §2).
 *
 * Pure, because the failure mode this guards against is not subtle: a bad mock
 * generating sixty cards and the student never opening the deck again. The caps are
 * the product decision; this module is only the arithmetic.
 *
 * Anything over the cap is *not* lost — the missed points still lower
 * `SpecPointMastery`, so Today schedules more questions on them. The knowledge gap is
 * recorded, it just doesn't arrive as a stack of cards.
 */

/** Contexts a card may be created from. Lesson checks teach; they do not punish. */
export const CARD_CREATING_CONTEXTS = [
  "PRACTICE",
  "MINI_MOCK",
  "FULL_MOCK",
  "MASTERY_CHECK",
] as const;

export type CardContext = (typeof CARD_CREATING_CONTEXTS)[number];

export function createsCards(context: string): context is CardContext {
  return (CARD_CREATING_CONTEXTS as readonly string[]).includes(context);
}

export const CAPS = {
  perQuestion: 3,
  perPracticeSession: 8,
  perMock: 15,
  perDay: 25,
} as const;

/** The session cap depends on what the student was doing. */
export function sessionCapFor(context: CardContext): number {
  return context === "MINI_MOCK" || context === "FULL_MOCK"
    ? CAPS.perMock
    : CAPS.perPracticeSession;
}

export type CardCandidate = {
  markPointId: string;
  specPointId: string;
  /** Marks the point was worth — a proxy for how much the idea matters. */
  marks: number;
};

export type CapBudget = {
  /** Cards already created for this question, from an earlier attempt. */
  existingForQuestion: number;
  /** Cards already created in this session. */
  existingInSession: number;
  /** Cards already created today, across everything. */
  existingToday: number;
  context: CardContext;
};

/**
 * Which candidates survive the caps, highest value first.
 *
 * Ordered by marks, then by mark point id so the choice is deterministic and a
 * re-run produces the same deck. Ties broken by id rather than by array order,
 * because array order comes from the mark scheme and is not a priority signal.
 */
export function selectUnderCaps(
  candidates: CardCandidate[],
  budget: CapBudget,
): CardCandidate[] {
  const remaining = Math.min(
    CAPS.perQuestion - budget.existingForQuestion,
    sessionCapFor(budget.context) - budget.existingInSession,
    CAPS.perDay - budget.existingToday,
  );

  if (remaining <= 0) return [];

  // Deduplicate by mark point: one card per missed idea, never two.
  const seen = new Set<string>();
  const unique = candidates.filter((candidate) => {
    if (seen.has(candidate.markPointId)) return false;
    seen.add(candidate.markPointId);
    return true;
  });

  const ordered = [...unique].sort(
    (a, b) => b.marks - a.marks || a.markPointId.localeCompare(b.markPointId),
  );

  return ordered.slice(0, remaining);
}

/**
 * Whether a marked attempt can produce cards at all.
 *
 * Full marks produce nothing: the deck is a record of mistakes, and a card for
 * something you got right is noise (D11).
 */
export function attemptCanCreateCards(attempt: {
  context: string;
  awardedMarks: number;
  maxMarks: number;
  missedMarkPointIds: string[];
}): boolean {
  if (!createsCards(attempt.context)) return false;
  if (attempt.maxMarks <= 0) return false;
  if (attempt.awardedMarks >= attempt.maxMarks) return false;
  return attempt.missedMarkPointIds.length > 0;
}
