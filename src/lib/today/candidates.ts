/**
 * Candidate generation (doc 05 §3) and the hard rules applied before scoring (§5b).
 *
 * One pass per enrolled sub-topic, producing the tasks its effective RAG calls for,
 * plus the globally-generated ones. Nothing is scored here — generation decides what
 * is *possible*, scoring decides what is *best*.
 */

import { gateFor, hasLearningNowFlag, type GateState } from "@/lib/today/gate";
import {
  cardOverdue,
  combine,
  coverageDebt,
  examUrgency,
  forgettingRisk,
  masteryGap,
  ragWeight,
  recencyPenalty,
  schoolTestUrgency,
  subjectFatigue,
  swapPenalty,
  varietyBonus,
} from "@/lib/today/scoring";
import { CARDS, COLD_START, NO_NEW_LESSONS, QUESTION_SET_SIZE } from "@/lib/today/weights";
import type {
  Candidate,
  ContentSubTopic,
  PlanMode,
  PlannerInput,
  RagValue,
} from "@/lib/today/types";

/** `subTopicRating ?? topicRating`, as specified. */
export function effectiveRag(
  subTopic: { id: string; topicId?: string },
  rag: PlannerInput["rag"],
): RagValue {
  const own = rag.find((entry) => entry.scope === "SUBTOPIC" && entry.id === subTopic.id);
  if (own) return own.value;

  const parent = subTopic.topicId
    ? rag.find((entry) => entry.scope === "TOPIC" && entry.id === subTopic.topicId)
    : undefined;

  return parent?.value ?? "NOT_LEARNT";
}

/** Foundation students never get Higher-only content (§5b rule 1). */
function allowsHigher(tier: string): boolean {
  return tier === "HIGHER";
}

/**
 * Picks the questions for a set.
 *
 * Red gets scaffolded work — low-mark, single-spec-point first. Amber targets the
 * lowest-mastery spec points. Green is a small confirmation set with at least one
 * higher-mark item, because a confirmation set of four one-markers confirms nothing.
 */
export function selectQuestions(
  subTopic: ContentSubTopic,
  rag: RagValue,
  mastery: PlannerInput["mastery"],
  allowHigher: boolean,
  size: number,
): string[] {
  const pool = subTopic.questions.filter((question) => allowHigher || !question.higherOnly);
  if (pool.length === 0) return [];

  const masteryFor = (specPointIds: string[]): number => {
    const seen = mastery.filter((entry) => specPointIds.includes(entry.specPointId));
    if (seen.length === 0) return 0;
    return seen.reduce((sum, entry) => sum + entry.mastery, 0) / seen.length;
  };

  const sorted = [...pool].sort((a, b) => {
    if (rag === "RED") {
      // Scaffolded: easiest and smallest first, single spec point before compound.
      return (
        a.marks - b.marks ||
        a.specPointIds.length - b.specPointIds.length ||
        a.difficulty - b.difficulty ||
        a.id.localeCompare(b.id)
      );
    }

    if (rag === "GREEN") {
      // Confirmation: lead with something substantial.
      return b.marks - a.marks || a.difficulty - b.difficulty || a.id.localeCompare(b.id);
    }

    // Amber and everything else: weakest spec points first.
    return (
      masteryFor(a.specPointIds) - masteryFor(b.specPointIds) ||
      a.difficulty - b.difficulty ||
      a.id.localeCompare(b.id)
    );
  });

  const chosen = sorted.slice(0, size);

  // A Green confirmation set must include at least one higher-mark item.
  if (rag === "GREEN" && chosen.length > 0 && !chosen.some((question) => question.marks >= 3)) {
    const bigger = sorted.find((question) => question.marks >= 3);
    if (bigger) chosen[chosen.length - 1] = bigger;
  }

  return chosen.map((question) => question.id);
}

const minutesForQuestions = (subTopic: ContentSubTopic, ids: string[]): number => {
  const seconds = ids.reduce(
    (sum, id) => sum + (subTopic.questions.find((q) => q.id === id)?.estSeconds ?? 90),
    0,
  );
  return Math.max(1, Math.round(seconds / 60));
};

export type GenerationResult = {
  candidates: Candidate[];
  gates: Array<{ subjectId: string; subjectName: string; gate: GateState }>;
};

export function generateCandidates(input: PlannerInput, mode: PlanMode): GenerationResult {
  const candidates: Candidate[] = [];
  const gates: GenerationResult["gates"] = [];

  const coldStart = input.accountAgeDays <= COLD_START.days;

  // One gate per subject, not one globally.
  for (const enrolment of input.enrolments) {
    const subjectSubTopics = input.contentIndex.subTopics.filter(
      (subTopic) => subTopic.subjectId === enrolment.subjectId,
    );
    const subjectRag = input.rag.filter((entry) =>
      entry.scope === "SUBTOPIC"
        ? subjectSubTopics.some((subTopic) => subTopic.id === entry.id)
        : subjectSubTopics.some((subTopic) => subTopic.id.startsWith(entry.id)),
    );

    gates.push({
      subjectId: enrolment.subjectId,
      subjectName: enrolment.subjectName,
      gate: gateFor(subjectRag, input.gateShutDays),
    });
  }

  const gateFor_ = (subjectId: string): GateState =>
    gates.find((entry) => entry.subjectId === subjectId)?.gate ?? {
      open: true,
      reason: "nothing-learnt-yet",
      blockingCount: 0,
    };

  for (const subTopic of input.contentIndex.subTopics) {
    const enrolment = input.enrolments.find((entry) => entry.subjectId === subTopic.subjectId);
    if (!enrolment) continue;

    const rag = effectiveRag(subTopic, input.rag);
    const gate = gateFor_(subTopic.subjectId);
    const allowHigher = allowsHigher(enrolment.tier);

    const test = schoolTestUrgency(subTopic.id, input.schoolTests, input.now);
    const learningNow = hasLearningNowFlag(subTopic.id, input.learningNow, input.now);

    /*
     * A school test covering this sub-topic generates the normal candidate set
     * regardless of RAG, and the gate opens for it: blocking a student from a lesson
     * on something they are tested on in four days would be indefensible.
     */
    const gateOpenHere = gate.open || learningNow || test.urgency > 0;

    const base = {
      subjectId: subTopic.subjectId,
      subjectSlug: enrolment.subjectSlug,
      subTopicId: subTopic.id,
      fromSchoolTest: test.urgency > 0,
    };

    const terms = {
      rag: ragWeight(rag, gateOpenHere),
      urgency: examUrgency(enrolment, subTopic.paper, input.now),
      schoolTest: test.urgency,
      masteryGap: masteryGap(subTopic.specPointIds, input.mastery),
      forgettingRisk: forgettingRisk(subTopic.specPointIds, input.mastery, input.now),
      coverageDebt: coverageDebt(subTopic.specPointIds, input.mastery),
      cardOverdue: 0,
      fatigue: subjectFatigue(subTopic.subjectId, input.recentHistory, input.now),
    };

    const push = (
      partial: Omit<Candidate, "score" | "terms" | keyof typeof base> & Partial<typeof base>,
      extra: Partial<typeof terms> = {},
    ) => {
      const full = { ...terms, ...extra };
      const all = {
        ...full,
        variety: varietyBonus(partial.type, subTopic.subjectId, input.recentHistory, input.now),
        recency: recencyPenalty(partial.type, subTopic.id, input.recentHistory, input.now),
        swap: swapPenalty(partial.type, subTopic.id, input.recentHistory, input.now),
      };

      candidates.push({
        ...base,
        ...partial,
        terms: all,
        score: combine(all),
      } as Candidate);
    };

    // --- Lessons -----------------------------------------------------------
    const unseenLesson = subTopic.lessons.find(
      (lesson) =>
        !input.completedLessonIds.includes(lesson.id) && (allowHigher || !lesson.higherOnly),
    );

    const lessonsAllowed = !NO_NEW_LESSONS.includes(mode);

    if (unseenLesson && lessonsAllowed) {
      const wanted = rag === "NOT_LEARNT" ? gateOpenHere : rag === "RED";
      if (wanted) {
        push({
          key: `lesson:${unseenLesson.id}`,
          type: "LESSON",
          ref: {
            kind: "LESSON",
            lessonId: unseenLesson.id,
            lessonSlug: unseenLesson.slug,
            subTopicCode: subTopic.code,
          },
          estMinutes: unseenLesson.estMinutes,
          title: `${subTopic.title} — lesson`,
          higherOnly: unseenLesson.higherOnly,
        });
      }
    }

    // --- Notes and blurt ---------------------------------------------------
    if ((rag === "RED" || rag === "AMBER") && subTopic.noteSections.length > 0) {
      const weakest = [...subTopic.noteSections].sort(
        (a, b) =>
          masteryGap(a.specPointIds, input.mastery) - masteryGap(b.specPointIds, input.mastery),
      );
      const section =
        rag === "AMBER" ? weakest[weakest.length - 1]! : subTopic.noteSections[0]!;

      push({
        key: `notes:${subTopic.id}:${section.anchor}`,
        type: "NOTES",
        ref: { kind: "NOTES", subTopicCode: subTopic.code, anchor: section.anchor },
        estMinutes: section.estMinutes,
        title: `${subTopic.title} — notes`,
        higherOnly: false,
      });
    }

    if ((rag === "RED" || rag === "AMBER") && subTopic.blurtPrompts.length > 0) {
      const prompt = subTopic.blurtPrompts[0]!;
      push({
        key: `blurt:${prompt.id}`,
        type: "BLURT",
        ref: { kind: "BLURT", promptId: prompt.id },
        estMinutes: prompt.estMinutes,
        title: `${subTopic.title} — blurt it`,
        higherOnly: false,
      });
    }

    // --- Questions ---------------------------------------------------------
    if (rag !== "NOT_LEARNT" || gateOpenHere) {
      const size =
        rag === "RED"
          ? QUESTION_SET_SIZE.red
          : rag === "GREEN"
            ? QUESTION_SET_SIZE.green
            : QUESTION_SET_SIZE.amber;

      const ids = selectQuestions(subTopic, rag, input.mastery, allowHigher, size);

      if (ids.length > 0) {
        push({
          key: `questions:${subTopic.id}`,
          type: "QUESTIONS",
          ref: { kind: "QUESTIONS", questionIds: ids },
          estMinutes: minutesForQuestions(subTopic, ids),
          title: `${ids.length} questions on ${subTopic.title}`,
          higherOnly: false,
        });
      }
    }

    // --- Cold-start diagnostics (doc 05 §7) --------------------------------
    if (coldStart && (rag === "AMBER" || rag === "GREEN")) {
      const ids = selectQuestions(
        subTopic,
        "AMBER",
        input.mastery,
        allowHigher,
        QUESTION_SET_SIZE.diagnostic,
      );
      if (ids.length > 0) {
        push({
          key: `diagnostic:${subTopic.id}`,
          type: "DIAGNOSTIC",
          ref: { kind: "DIAGNOSTIC", questionIds: ids },
          estMinutes: minutesForQuestions(subTopic, ids),
          title: `Where are you with ${subTopic.title}?`,
          higherOnly: false,
        });
      }
    }

    /*
     * --- Sub-topic RAG refinement (D19) ------------------------------------
     *
     * A topic-level rating is a blunt instrument: "Red at cell biology" says
     * nothing about which half. The first time a topic is actually worked on, a
     * sixty-second prompt splits it into sub-topics, and everything downstream
     * gets sharper. Only offered where a topic rating is doing the work and no
     * sub-topic rating exists yet, so it never asks twice.
     */
    const hasOwnRating = input.rag.some(
      (entry) => entry.scope === "SUBTOPIC" && entry.id === subTopic.id,
    );
    const parentRating = input.rag.find(
      (entry) => entry.scope === "TOPIC" && subTopic.id.startsWith(entry.id),
    );

    if (!hasOwnRating && parentRating) {
      push({
        key: `rag-refine:${subTopic.id}`,
        type: "RAG_REFINE",
        ref: { kind: "RAG_REFINE", topicId: parentRating.id },
        estMinutes: 1,
        title: `Rate ${subTopic.title} on its own`,
        higherOnly: false,
      });
    }

    // --- Practicals --------------------------------------------------------
    for (const practical of subTopic.practicals) {
      push({
        key: `practical:${practical.id}`,
        type: "PRACTICAL",
        ref: { kind: "PRACTICAL", practicalNumber: practical.number },
        estMinutes: practical.estMinutes,
        title: `Required practical ${practical.number}`,
        higherOnly: false,
      });
    }
  }

  // --- Flashcards, generated globally --------------------------------------
  if (input.dueCards.total > 0) {
    const cap = Math.min(
      input.dueCards.total,
      Math.floor((input.targetMinutes * CARDS.maxShare) / CARDS.minutesPerCard),
      CARDS.dailyCap,
    );

    if (cap > 0) {
      const subjectId =
        Object.entries(input.dueCards.bySubject).sort((a, b) => b[1] - a[1])[0]?.[0] ??
        input.enrolments[0]?.subjectId ??
        "";

      const terms = {
        cardOverdue: cardOverdue(input.dueCards),
        variety: 1,
        recency: 0,
        swap: 0,
      };

      candidates.push({
        key: "flashcards",
        type: "FLASHCARDS",
        subjectId,
        subjectSlug:
          input.enrolments.find((entry) => entry.subjectId === subjectId)?.subjectSlug ?? "",
        ref: { kind: "FLASHCARDS", cardCount: cap },
        estMinutes: Math.max(1, Math.round(cap * CARDS.minutesPerCard)),
        title: `Review ${cap} flashcard${cap === 1 ? "" : "s"}`,
        terms,
        score: combine(terms),
        fromSchoolTest: false,
        higherOnly: false,
      });
    }
  }

  return { candidates, gates };
}
