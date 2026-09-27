# 07 — Flashcards and FSRS-6

**D11:** cards exist _only_ because the student got a question wrong. No pre-authored core deck, no
student-written cards. The deck is a personal record of mistakes.
**D12:** scheduled with **FSRS-6** via `ts-fsrs`.

---

## 1. Why FSRS

FSRS models two latent quantities per card — **stability** (how long the memory lasts) and
**difficulty** (how hard this item is for this person) — and schedules each review for the moment
recall probability drops to a target retention. Unlike SM-2 it uses _when_ you reviewed, not just
how you rated, and it cannot fall into "ease hell". In practice it reaches the same retention with
roughly 20–30% fewer reviews — which, for a student with 40 minutes on a Tuesday, is the whole point.

Implementation: **`ts-fsrs`** (MIT, implements FSRS-6). Optional server-side parameter optimisation
via `@open-spaced-repetition/binding` once there is enough review history (§7).

```ts
// /lib/fsrs — the only place ts-fsrs is imported
const scheduler = fsrs({
  request_retention: 0.9, // target recall probability
  maximum_interval: 365, // a GCSE course is ~2 years; longer intervals are pointless
  enable_fuzz: true, // spreads due dates so no single day spikes
});
```

`maximum_interval: 365` is deliberate — default FSRS settings will happily schedule a card for 2050.
For an exam with a fixed date, anything beyond a year is wasted scheduling.

---

## 2. Card creation

### Trigger

A card is created when **all** of these hold:

- the attempt context is `PRACTICE`, `MINI_MOCK`, `FULL_MOCK` or `MASTERY_CHECK` — **not**
  `LESSON_CHECK` (inline lesson checks are for teaching, not for punishing)
- the student scored **less than full marks**
- at least one mark-scheme point was missed
- no live (non-retired) card already exists for that `(specPointId, markPointId)` pair

### One card per missed mark point, not per question

A 6-mark question missed entirely should not produce one unusable 6-mark card. It produces up to
three atomic cards, one per missed idea. Atomic cards are the entire basis of spaced repetition
working at all.

### Anti-flood caps

The failure mode to design against is a bad mock generating 60 cards and the student quitting.

| Cap                        | Value                                                                    |
| -------------------------- | ------------------------------------------------------------------------ |
| Cards per question         | 3                                                                        |
| Cards per practice session | 8                                                                        |
| Cards per mock             | 15 (the highest-value missed points by spec-point weight × exam urgency) |
| Cards per day              | 25                                                                       |

Beyond the cap, the missed points still lower `SpecPointMastery`, so Today schedules more questions
on them — the knowledge gap is recorded, it just doesn't arrive as cards.

### Card text generation — and a cost trick

Card text is a function of `(question, markPointId, specPoint)` only. **It does not depend on the
student.** So it is generated **once, globally, and shared**:

```prisma
/// Addition to doc 03. Generated on first need, reused by every student thereafter.
model CardTemplate {
  id          String @id                      // "<questionId>:<markPointId>"
  questionId  String
  markPointId String
  specPointId String
  cardType    CardType
  front       String @db.Text
  back        String @db.Text
  hint        String?
  generatedBy String                          // model + prompt version
  reviewed    Boolean @default(false)         // human spot-check flag
  createdAt   DateTime @default(now())
}
```

At steady state almost every card creation is a **free** database lookup. Only genuinely novel
(question, mark point) pairs cost an API call — about **$0.001**, once, ever.

Generation rules for the card text:

- Front is a **single** question answerable in one sentence; never "explain X" for 4 marks.
- Back is the missed mark point, in the mark scheme's own language plus a short clarifier.
- Never reference the original question's context ("in the graph above") — the card must stand alone.
- Prefer `DEFINITION` type for terminology, `CLOZE` for sequences and equations, `QA` otherwise.

### Provenance

Every card shows _"From a question you got wrong on 14 Oct"_ with a link back to that attempt. This
makes the deck feel earned rather than imposed, and it lets a student challenge a card that came
from a mark they disputed.

---

## 3. Review session

**Route:** `/revise/flashcards`, or a Today deep link with a frozen card list.

### Rating buttons (standard FSRS four)

| Key | Rating    | Meaning                            |
| --- | --------- | ---------------------------------- |
| `1` | **Again** | Didn't know it — counts as a lapse |
| `2` | **Hard**  | Recalled, but it was a struggle    |
| `3` | **Good**  | Recalled correctly                 |
| `4` | **Easy**  | Instant and effortless             |

### Interaction rules

- **Keyboard-first**: `Space` flips, `1`–`4` grade, `U` undoes, `S` suspends. Touch targets on the
  same actions for tablet.
- **< 100 ms** perceived response: FSRS is computed client-side, UI advances optimistically, the
  write is fire-and-forget with a retry queue.
- **Undo** the last review, restoring the previous FSRS state exactly (which is why `CardReview`
  stores the full prior state, not just the rating).
- Progress ring showing remaining cards, plus a "you can stop any time" affordance — a session that
  can't be exited gracefully doesn't get started.
- Daily cap of **40** reviews (doc 05 §6), prioritised by overdue days. The rest wait rather than
  forming a wall.

### Ordering within a session

1. Relearning cards (recently lapsed) first — they are the most fragile
2. Overdue review cards, most overdue first
3. New cards, interleaved at most 1 in 4 so a session never becomes all-new
4. Light interleaving across subjects — interleaved practice beats blocked practice for retention

---

## 4. Retirement, leeches and suspension

| Situation                                                                    | Behaviour                                                                                                                                                                                                                 |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Student later answers a **question** on that spec point at full marks, twice | Card **retires** (`retiredAt` set). The evidence that matters is exam performance, not card performance.                                                                                                                  |
| Card reaches **8 lapses**                                                    | Marked a **leech**: auto-suspended, and Today is told to schedule a `NOTES` or `LESSON` task for that spec point instead. Eight failures means the underlying idea was never understood; more repetitions won't fix that. |
| Student manually suspends                                                    | Hidden from the queue, visible in a "suspended" list, restorable.                                                                                                                                                         |
| Source question retired or corrected                                         | Cards derived from it are suspended and flagged for regeneration.                                                                                                                                                         |
| Source mark disputed and overturned                                          | Cards from that attempt are deleted.                                                                                                                                                                                      |

Retirement is what stops the deck growing forever. Without it, a student in month six is reviewing
cards from mistakes they stopped making in month two.

---

## 5. Interaction with Today

- Due cards are **always** a candidate task and are placed **first** in the session (doc 05 §6) —
  they decay fastest and they are an easy start.
- Card count is capped so flashcards never consume more than ~30% of a session.
- Cards contribute to `SpecPointMastery` at a **lower weight** than exam questions. Recognising an
  answer on a card is not the same as producing it under exam conditions, and the app should never
  let card success alone move a topic to Green.
- A spec point with many lapsing cards raises `forgettingRisk`, which surfaces notes and questions
  on it — the two systems reinforce each other rather than running in parallel.

---

## 6. Empty-state and cold start

A brand-new student has no cards. This is a direct consequence of D11 and must be designed for, not
apologised for:

- The Revise flashcards tile shows: _"Your deck builds itself. Every question you get wrong becomes
  a card here."_ — with a button straight into a diagnostic question set.
- Today's first-week diagnostics (doc 05 §7) exist largely to seed this deck.
- The first card created is worth celebrating — a small, one-off moment that explains the mechanic.

---

## 7. Parameter optimisation (later)

FSRS ships with sensible default parameters. Once a student has **≥ 400 reviews**, their parameters
can be optimised against their own history using `@open-spaced-repetition/binding` server-side, and
stored per user.

Sequencing:

1. **Phase 5:** default parameters for everyone. Correct and completely fine.
2. **Later:** pooled optimisation — fit one parameter set across all users' review logs, ship it as
   the new default. Benefits every student, including new ones, with one job.
3. **Later still:** per-user optimisation as a nightly job for students above the review threshold.

Per-user optimisation is a marginal gain over a good pooled default and is explicitly **not** a
v1 concern.

---

## 8. Testing

- The `ts-fsrs` wrapper is pure: unit-test that state transitions, intervals and due dates match the
  library's expectations across all four ratings and all four states.
- Property test: `due` is always in the future after a review; stability never goes negative;
  `Again` always shortens the interval relative to `Good`.
- Simulation test: a synthetic student over 180 simulated days, asserting that the deck reaches a
  steady state rather than growing without bound — the single most important invariant, given
  cards are created automatically.
- Card-generation tests: the anti-flood caps hold under a catastrophic mock (every question wrong).
