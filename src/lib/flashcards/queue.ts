/**
 * Ordering a review session (doc 07 §3).
 *
 * Pure, and separated from the database read so the ordering rules can be tested
 * exactly rather than inferred from a query plan.
 *
 * The order is not arbitrary:
 *   1. relearning cards first — they are the most fragile, and leaving them last
 *      means they are the ones dropped when a student stops early
 *   2. overdue review cards, most overdue first
 *   3. new cards interleaved at most one in four, so a session never becomes a wall
 *      of things you have never seen
 *   4. light interleaving across subjects — interleaved practice beats blocked
 */

export type QueueCard = {
  id: string;
  state: "NEW" | "LEARNING" | "REVIEW" | "RELEARNING";
  due: Date;
  /** Used only to interleave; any stable grouping key works. */
  subjectId: string;
};

/** Daily cap (doc 05 §6). The rest wait rather than forming a wall. */
export const DAILY_REVIEW_CAP = 40;

/** At most one new card in every four. */
const NEW_CARD_EVERY = 4;

const overdueMs = (card: QueueCard, now: Date) => now.getTime() - card.due.getTime();

/**
 * Spreads consecutive runs of the same subject.
 *
 * A single pass that pushes a card back one place when it would be the third in a
 * row from the same subject. Deliberately not a full shuffle: the priority order
 * above matters more than perfect interleaving, so this only breaks up long runs.
 */
function interleave(cards: QueueCard[]): QueueCard[] {
  const out: QueueCard[] = [];
  const pending = [...cards];

  while (pending.length > 0) {
    let index = 0;

    const lastTwo = out.slice(-2);
    if (lastTwo.length === 2 && lastTwo[0]!.subjectId === lastTwo[1]!.subjectId) {
      const different = pending.findIndex((card) => card.subjectId !== lastTwo[1]!.subjectId);
      if (different !== -1) index = different;
    }

    out.push(pending.splice(index, 1)[0]!);
  }

  return out;
}

export function buildQueue(
  cards: QueueCard[],
  now: Date,
  cap: number = DAILY_REVIEW_CAP,
): QueueCard[] {
  const due = cards.filter((card) => card.due.getTime() <= now.getTime());

  const relearning = due
    .filter((card) => card.state === "RELEARNING" || card.state === "LEARNING")
    .sort((a, b) => overdueMs(b, now) - overdueMs(a, now) || a.id.localeCompare(b.id));

  const review = due
    .filter((card) => card.state === "REVIEW")
    .sort((a, b) => overdueMs(b, now) - overdueMs(a, now) || a.id.localeCompare(b.id));

  const fresh = due
    .filter((card) => card.state === "NEW")
    .sort((a, b) => a.due.getTime() - b.due.getTime() || a.id.localeCompare(b.id));

  const established = interleave([...relearning, ...review]);

  // Weave new cards in at most one in four, counting positions in the final queue.
  const queue: QueueCard[] = [];
  let nextNew = 0;

  for (const card of established) {
    queue.push(card);
    if (queue.length % NEW_CARD_EVERY === 0 && nextNew < fresh.length) {
      queue.push(fresh[nextNew]!);
      nextNew += 1;
    }
    if (queue.length >= cap) return queue.slice(0, cap);
  }

  /*
   * A deck with nothing established is a first session, and all-new is the only thing
   * it can be. Otherwise the leftover new cards are deliberately *not* appended: the
   * one-in-four rule exists so a session never becomes a wall of unfamiliar material,
   * and dumping the remainder at the end would break exactly that. They wait for
   * tomorrow, which is also what the daily cap is for.
   */
  if (established.length === 0) {
    while (nextNew < fresh.length && queue.length < cap) {
      queue.push(fresh[nextNew]!);
      nextNew += 1;
    }
  }

  return queue.slice(0, cap);
}
