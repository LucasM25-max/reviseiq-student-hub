/**
 * Coverage analysis.
 *
 * The point of this module is to be **honest**. It is easy to write a report that says
 * everything is green; the useful report is the one that says which spec points have no
 * questions, which are only taught by recap material, and which are knowingly partial and
 * why. A gap that is declared is a plan. A gap that is hidden is a bug that surfaces in
 * an exam.
 *
 * Gates come from docs/plan/04-content-pipeline.md and the slice's §7 blueprint. They are
 * separated into **errors** (fail the build) and **warnings** (print, do not fail), because
 * a sub-topic that is mid-authoring should not be able to block a deploy of unrelated work
 * — but it should be impossible to forget about.
 */
import type { LoadedContent } from "./registry";
import type { QuestionDef, SpecPointDef } from "./schema";

/** Quality gates from doc 04. */
export const GATES = {
  minQuestionsPerSubTopic: 8,
  minQuestionTypes: 3,
  minExtendedQuestions: 1,
  /** AO1 / AO2 / AO3 target share of marks, and the tolerance in percentage points. */
  aoTarget: { AO1: 40, AO2: 40, AO3: 20 },
  aoTolerancePoints: 5,
  /** AQA requires practical questions to be at least 15% of exam marks. */
  minPracticalMarkShare: 15,
} as const;

export type SpecPointCoverage = {
  specPoint: SpecPointDef;
  subTopicId: string;
  /** Lesson blocks that teach it, excluding recap blocks. */
  teachingBlocks: number;
  /** Note sections whose spec point codes include this point's code. */
  noteSections: number;
  questions: number;
  marks: number;
  /** FULL with teaching and questions, PARTIAL if declared so, GAP if nothing covers it. */
  status: "covered" | "partial" | "gap";
};

export type SubTopicCoverage = {
  subTopicId: string;
  title: string;
  code: string;
  specPoints: SpecPointCoverage[];
  questionCount: number;
  markTotal: number;
  questionTypes: string[];
  extendedCount: number;
  lessonCount: number;
  noteSectionCount: number;
  blurtCount: number;
  aoMarks: Record<"AO1" | "AO2" | "AO3", number>;
  aoShare: Record<"AO1" | "AO2" | "AO3", number>;
  practicalMarks: number;
  practicalMarkShare: number;
};

export type CoverageReport = {
  subTopics: SubTopicCoverage[];
  errors: string[];
  warnings: string[];
  /** Faults in a required practical that no question assesses. */
  unassessedFaults: { practicalId: string; faultId: string }[];
};

const round1 = (value: number) => Math.round(value * 10) / 10;

export function analyseCoverage(content: LoadedContent): CoverageReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  const questionsBySubTopic = new Map<string, QuestionDef[]>();
  for (const question of content.questions) {
    if (question.retired) continue;
    const list = questionsBySubTopic.get(question.primarySubTopicId) ?? [];
    list.push(question);
    questionsBySubTopic.set(question.primarySubTopicId, list);
  }

  const subTopics: SubTopicCoverage[] = [];

  for (const [subTopicId, subTopic] of content.subTopics) {
    const questions = questionsBySubTopic.get(subTopicId) ?? [];
    const lessons = content.lessons.filter((lesson) => lesson.subTopicId === subTopicId);
    const notePages = content.notes.filter((page) => page.subTopicId === subTopicId);
    const noteSections = notePages.flatMap((page) => page.sections);
    const blurts = content.blurtPrompts.filter((prompt) => prompt.subTopicId === subTopicId);

    const specPointCoverage: SpecPointCoverage[] = subTopic.specPoints.map((specPoint) => {
      // Recap blocks are excluded deliberately (D39): prior-stage material is not GCSE
      // teaching, and must never be the only thing covering a spec point. The schema
      // already forbids a recap block from claiming coverage; this is the second line.
      const teachingBlocks = lessons.reduce(
        (count, lesson) =>
          count +
          lesson.blocks.filter(
            (block) => !block.recap && block.specPoints.includes(specPoint.id),
          ).length,
        0,
      );
      const matchingNotes = noteSections.filter((section) =>
        section.specPointCodes.includes(specPoint.code),
      ).length;
      const matchingQuestions = questions.filter((question) =>
        question.specPoints.some((ref) => ref.code === specPoint.id),
      );
      const marks = matchingQuestions.reduce((sum, question) => sum + question.marks, 0);

      let status: SpecPointCoverage["status"];
      if (teachingBlocks === 0 && matchingQuestions.length === 0) status = "gap";
      else if (specPoint.coverage === "PARTIAL") status = "partial";
      else status = "covered";

      return {
        specPoint,
        subTopicId,
        teachingBlocks,
        noteSections: matchingNotes,
        questions: matchingQuestions.length,
        marks,
        status,
      };
    });

    const markTotal = questions.reduce((sum, question) => sum + question.marks, 0);
    const aoMarks = { AO1: 0, AO2: 0, AO3: 0 };
    for (const question of questions) aoMarks[question.ao] += question.marks;
    const aoShare = {
      AO1: markTotal === 0 ? 0 : round1((aoMarks.AO1 / markTotal) * 100),
      AO2: markTotal === 0 ? 0 : round1((aoMarks.AO2 / markTotal) * 100),
      AO3: markTotal === 0 ? 0 : round1((aoMarks.AO3 / markTotal) * 100),
    };
    const practicalMarks = questions
      .filter((question) => question.practicalId)
      .reduce((sum, question) => sum + question.marks, 0);
    const practicalMarkShare = markTotal === 0 ? 0 : round1((practicalMarks / markTotal) * 100);

    const questionTypes = [...new Set(questions.map((question) => question.type))].sort();
    const extendedCount = questions.filter((question) => question.type === "EXTENDED").length;

    subTopics.push({
      subTopicId,
      title: subTopic.title,
      code: subTopic.code,
      specPoints: specPointCoverage,
      questionCount: questions.length,
      markTotal,
      questionTypes,
      extendedCount,
      lessonCount: lessons.length,
      noteSectionCount: noteSections.length,
      blurtCount: blurts.length,
      aoMarks,
      aoShare,
      practicalMarks,
      practicalMarkShare,
    });

    // --- Gates -------------------------------------------------------------
    const label = `${subTopic.code} ${subTopic.title}`;

    if (questions.length < GATES.minQuestionsPerSubTopic) {
      errors.push(
        `${label}: ${questions.length} questions, needs at least ${GATES.minQuestionsPerSubTopic}`,
      );
    }
    if (questionTypes.length < GATES.minQuestionTypes) {
      errors.push(
        `${label}: ${questionTypes.length} question type(s), needs at least ${GATES.minQuestionTypes}`,
      );
    }
    if (extendedCount < GATES.minExtendedQuestions) {
      errors.push(
        `${label}: ${extendedCount} extended-response questions, needs at least ${GATES.minExtendedQuestions}`,
      );
    }
    if (lessons.length === 0) errors.push(`${label}: no lessons`);
    if (noteSections.length === 0) errors.push(`${label}: no revision notes`);

    for (const ao of ["AO1", "AO2", "AO3"] as const) {
      const drift = Math.abs(aoShare[ao] - GATES.aoTarget[ao]);
      if (markTotal > 0 && drift > GATES.aoTolerancePoints) {
        errors.push(
          `${label}: ${ao} is ${aoShare[ao]}% of marks, target ${GATES.aoTarget[ao]}% ±${GATES.aoTolerancePoints}`,
        );
      }
    }

    // Only enforced where the sub-topic actually owns a required practical.
    const ownsPractical = content.practicals.some((practical) =>
      practical.subTopicIds.includes(subTopicId),
    );
    if (ownsPractical && practicalMarkShare < GATES.minPracticalMarkShare) {
      errors.push(
        `${label}: practical questions are ${practicalMarkShare}% of marks, needs at least ${GATES.minPracticalMarkShare}%`,
      );
    }

    for (const coverage of specPointCoverage) {
      const point = `${label} › ${coverage.specPoint.id}`;
      if (coverage.status === "gap") {
        errors.push(`${point}: nothing teaches or tests it`);
        continue;
      }
      if (coverage.teachingBlocks === 0) {
        errors.push(`${point}: no lesson block teaches it (recap blocks do not count)`);
      }
      if (coverage.questions === 0) {
        errors.push(`${point}: no question tests it`);
      }
      if (coverage.noteSections === 0) {
        warnings.push(
          `${point}: no revision note section is tagged with code ${coverage.specPoint.code}`,
        );
      }
      if (coverage.status === "partial") {
        warnings.push(
          `${point}: declared PARTIAL — ${coverage.specPoint.blockedBy.join("; ")}`,
        );
      }
    }

    if (blurts.length === 0) {
      warnings.push(`${label}: no blurt prompts`);
    }
  }

  // --- Practical faults ------------------------------------------------------
  const unassessedFaults: { practicalId: string; faultId: string }[] = [];
  for (const practical of content.practicals) {
    if (practical.coverage === "PARTIAL") {
      warnings.push(
        `practical ${practical.id}: declared PARTIAL — ${practical.blockedBy.join("; ")}`,
      );
    }
    for (const fault of practical.faults) {
      if (fault.questionIds.length === 0) {
        unassessedFaults.push({ practicalId: practical.id, faultId: fault.id });
      }
    }
  }

  return { subTopics, errors, warnings, unassessedFaults };
}
