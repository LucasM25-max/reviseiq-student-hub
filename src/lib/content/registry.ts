/**
 * Loads /content, parses every file against the zod schemas, and cross-references every
 * id that points at something else.
 *
 * Schema parsing alone is not enough. A lesson can be perfectly well-formed and still
 * point at a diagram that does not exist, a spec point that was renamed, or a question
 * that was deleted. Those are the failures that reach students, so they are checked here
 * and they fail the build.
 *
 * Returns *all* problems rather than throwing on the first one — fixing content one
 * error per run is miserable.
 */
import { rawContent } from "@content/index";

import { getDiagram, getStructure } from "./diagrams";
import {
  blurtPromptSchema,
  lessonSchema,
  notesPageSchema,
  practicalSchema,
  questionSchema,
  taxonomySchema,
  type BlurtPromptDef,
  type LessonDef,
  type NotesPageDef,
  type PracticalDef,
  type QuestionDef,
  type SpecPointDef,
  type SubTopicDef,
  type TaxonomyDef,
} from "./schema";
import { getWidget } from "./widgets";

export type ContentIssue = {
  /** Where the problem is, e.g. `lesson bio-4112-l1 › blocks.3.diagramId`. */
  where: string;
  message: string;
};

export type LoadedContent = {
  taxonomies: TaxonomyDef[];
  practicals: PracticalDef[];
  lessons: LessonDef[];
  notes: NotesPageDef[];
  questions: QuestionDef[];
  blurtPrompts: BlurtPromptDef[];
  /** Flattened lookups, built once. */
  subTopics: Map<string, SubTopicDef>;
  specPoints: Map<string, SpecPointDef>;
  /** subTopicId for each spec point, so coverage can group without re-walking. */
  specPointSubTopic: Map<string, string>;
};

export type LoadResult =
  { ok: true; content: LoadedContent; issues: [] } | { ok: false; issues: ContentIssue[] };

/**
 * The shape `loadContent` consumes. Everything is `unknown` because this is the
 * *untrusted* side of the boundary — the whole job of this module is to turn unknown
 * data into typed content or a list of reasons why it cannot.
 */
export type RawContentInput = {
  taxonomies: unknown[];
  practicals: unknown[];
  lessons: unknown[];
  notes: unknown[];
  questions: unknown[];
  blurtPrompts: unknown[];
};

/** Turns a zod error into one issue per problem, with a readable path. */
function zodIssues(
  where: string,
  error: { issues: readonly { path: PropertyKey[]; message: string }[] },
): ContentIssue[] {
  return error.issues.map((issue) => ({
    where: issue.path.length > 0 ? `${where} › ${issue.path.map(String).join(".")}` : where,
    message: issue.message,
  }));
}

function checkUnique(
  issues: ContentIssue[],
  where: string,
  label: string,
  ids: string[],
): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      issues.push({ where, message: `duplicate ${label} "${id}"` });
    }
    seen.add(id);
  }
}

export function loadContent(raw: RawContentInput = rawContent): LoadResult {
  const issues: ContentIssue[] = [];

  // --- Parse ---------------------------------------------------------------
  const taxonomies: TaxonomyDef[] = [];
  raw.taxonomies.forEach((entry, index) => {
    const parsed = taxonomySchema.safeParse(entry);
    if (parsed.success) taxonomies.push(parsed.data);
    else issues.push(...zodIssues(`taxonomy[${index}]`, parsed.error));
  });

  const practicals: PracticalDef[] = [];
  raw.practicals.forEach((entry, index) => {
    const parsed = practicalSchema.safeParse(entry);
    if (parsed.success) practicals.push(parsed.data);
    else {
      const label =
        typeof entry === "object" && entry !== null && "id" in entry
          ? String(entry.id)
          : `[${index}]`;
      issues.push(...zodIssues(`practical ${label}`, parsed.error));
    }
  });

  const lessons: LessonDef[] = [];
  raw.lessons.forEach((entry, index) => {
    const parsed = lessonSchema.safeParse(entry);
    if (parsed.success) lessons.push(parsed.data);
    else {
      const label =
        typeof entry === "object" && entry !== null && "id" in entry
          ? String(entry.id)
          : `[${index}]`;
      issues.push(...zodIssues(`lesson ${label}`, parsed.error));
    }
  });

  const notes: NotesPageDef[] = [];
  raw.notes.forEach((entry, index) => {
    const parsed = notesPageSchema.safeParse(entry);
    if (parsed.success) notes.push(parsed.data);
    else {
      const label =
        typeof entry === "object" && entry !== null && "subTopicId" in entry
          ? String(entry.subTopicId)
          : `[${index}]`;
      issues.push(...zodIssues(`notes ${label}`, parsed.error));
    }
  });

  const questions: QuestionDef[] = [];
  raw.questions.forEach((entry, index) => {
    const parsed = questionSchema.safeParse(entry);
    if (parsed.success) questions.push(parsed.data);
    else {
      const label =
        typeof entry === "object" && entry !== null && "id" in entry
          ? String(entry.id)
          : `[${index}]`;
      issues.push(...zodIssues(`question ${label}`, parsed.error));
    }
  });

  const blurtPrompts: BlurtPromptDef[] = [];
  raw.blurtPrompts.forEach((entry, index) => {
    const parsed = blurtPromptSchema.safeParse(entry);
    if (parsed.success) blurtPrompts.push(parsed.data);
    else {
      const label =
        typeof entry === "object" && entry !== null && "id" in entry
          ? String(entry.id)
          : `[${index}]`;
      issues.push(...zodIssues(`blurt ${label}`, parsed.error));
    }
  });

  // A schema failure means ids are unreliable, so cross-referencing would produce noise
  // on top of the real errors. Report what we have.
  if (issues.length > 0) return { ok: false, issues };

  // --- Build lookups -------------------------------------------------------
  const subTopics = new Map<string, SubTopicDef>();
  const specPoints = new Map<string, SpecPointDef>();
  const specPointSubTopic = new Map<string, string>();

  for (const taxonomy of taxonomies) {
    checkUnique(
      issues,
      `taxonomy ${taxonomy.subjectId} ${taxonomy.topicCode}`,
      "sub-topic id",
      taxonomy.subTopics.map((subTopic) => subTopic.id),
    );
    for (const subTopic of taxonomy.subTopics) {
      if (subTopics.has(subTopic.id)) {
        issues.push({
          where: `taxonomy ${taxonomy.subjectId}`,
          message: `sub-topic "${subTopic.id}" is defined more than once`,
        });
      }
      subTopics.set(subTopic.id, subTopic);

      checkUnique(
        issues,
        `sub-topic ${subTopic.id}`,
        "spec point id",
        subTopic.specPoints.map((specPoint) => specPoint.id),
      );
      for (const specPoint of subTopic.specPoints) {
        if (specPoints.has(specPoint.id)) {
          issues.push({
            where: `sub-topic ${subTopic.id}`,
            message: `spec point "${specPoint.id}" is defined more than once`,
          });
        }
        specPoints.set(specPoint.id, specPoint);
        specPointSubTopic.set(specPoint.id, subTopic.id);
      }
    }
  }

  const practicalIds = new Set(practicals.map((practical) => practical.id));
  const questionIds = new Set(questions.map((question) => question.id));

  checkUnique(
    issues,
    "practicals",
    "practical id",
    practicals.map((p) => p.id),
  );
  checkUnique(
    issues,
    "lessons",
    "lesson id",
    lessons.map((l) => l.id),
  );
  checkUnique(
    issues,
    "questions",
    "question id",
    questions.map((q) => q.id),
  );
  checkUnique(
    issues,
    "blurt prompts",
    "blurt prompt id",
    blurtPrompts.map((b) => b.id),
  );
  checkUnique(
    issues,
    "notes",
    "note section id",
    notes.flatMap((page) => page.sections.map((section) => section.id)),
  );

  // --- Cross-reference: taxonomy ------------------------------------------
  for (const [specPointId, specPoint] of specPoints) {
    for (const [index, id] of specPoint.practicalIds.entries()) {
      if (!practicalIds.has(id)) {
        issues.push({
          where: `spec point ${specPointId} › practicalIds.${index}`,
          message: `no practical with id "${id}"`,
        });
      }
    }
    // An honest gap says what is blocking it. A silent PARTIAL is just a lie with a flag on it.
    if (specPoint.coverage === "PARTIAL" && specPoint.blockedBy.length === 0) {
      issues.push({
        where: `spec point ${specPointId} › blockedBy`,
        message: "coverage is PARTIAL but nothing is recorded as blocking it",
      });
    }
    if (specPoint.coverage === "FULL" && specPoint.blockedBy.length > 0) {
      issues.push({
        where: `spec point ${specPointId} › blockedBy`,
        message: "coverage is FULL but blockedBy is not empty — one of the two is wrong",
      });
    }
  }

  // --- Cross-reference: lessons -------------------------------------------
  const lessonSlugs = new Map<string, Set<string>>();
  for (const lesson of lessons) {
    const where = `lesson ${lesson.id}`;
    if (!subTopics.has(lesson.subTopicId)) {
      issues.push({
        where: `${where} › subTopicId`,
        message: `no sub-topic "${lesson.subTopicId}"`,
      });
    }

    const slugs = lessonSlugs.get(lesson.subTopicId) ?? new Set<string>();
    if (slugs.has(lesson.slug)) {
      issues.push({
        where: `${where} › slug`,
        message: `"${lesson.slug}" is already used by another lesson in ${lesson.subTopicId}`,
      });
    }
    slugs.add(lesson.slug);
    lessonSlugs.set(lesson.subTopicId, slugs);

    lesson.blocks.forEach((block, blockIndex) => {
      const blockWhere = `${where} › blocks.${blockIndex}`;
      for (const [i, specPointId] of block.specPoints.entries()) {
        if (!specPoints.has(specPointId)) {
          issues.push({
            where: `${blockWhere}.specPoints.${i}`,
            message: `no spec point "${specPointId}"`,
          });
        } else if (specPointSubTopic.get(specPointId) !== lesson.subTopicId) {
          issues.push({
            where: `${blockWhere}.specPoints.${i}`,
            message: `spec point "${specPointId}" belongs to a different sub-topic`,
          });
        }
      }

      if (block.type === "diagram") {
        const diagram = getDiagram(block.diagramId);
        if (!diagram) {
          issues.push({
            where: `${blockWhere}.diagramId`,
            message: `no diagram "${block.diagramId}" in the registry`,
          });
        } else if (Array.isArray(block.labels)) {
          for (const [i, key] of block.labels.entries()) {
            if (!getStructure(block.diagramId, key)) {
              issues.push({
                where: `${blockWhere}.labels.${i}`,
                message: `"${key}" is not a structure on diagram "${block.diagramId}"`,
              });
            }
          }
        }
      }

      if (block.type === "widget" && !getWidget(block.widgetId)) {
        issues.push({
          where: `${blockWhere}.widgetId`,
          message: `no widget "${block.widgetId}" in the registry`,
        });
      }
    });
  }

  // --- Cross-reference: notes ---------------------------------------------
  for (const page of notes) {
    const where = `notes ${page.subTopicId}`;
    if (!subTopics.has(page.subTopicId)) {
      issues.push({
        where: `${where} › subTopicId`,
        message: `no sub-topic "${page.subTopicId}"`,
      });
    }
    checkUnique(
      issues,
      where,
      "section slug",
      page.sections.map((section) => section.slug),
    );
  }

  // --- Cross-reference: questions -----------------------------------------
  for (const question of questions) {
    const where = `question ${question.id}`;
    if (!subTopics.has(question.primarySubTopicId)) {
      issues.push({
        where: `${where} › primarySubTopicId`,
        message: `no sub-topic "${question.primarySubTopicId}"`,
      });
    }
    for (const [i, ref] of question.specPoints.entries()) {
      if (!specPoints.has(ref.code)) {
        issues.push({
          where: `${where} › specPoints.${i}.code`,
          message: `no spec point "${ref.code}"`,
        });
      }
    }
    if (question.practicalId && !practicalIds.has(question.practicalId)) {
      issues.push({
        where: `${where} › practicalId`,
        message: `no practical "${question.practicalId}"`,
      });
    }
    const diagramId = question.assets?.diagramId;
    if (diagramId) {
      if (!getDiagram(diagramId)) {
        issues.push({
          where: `${where} › assets.diagramId`,
          message: `no diagram "${diagramId}" in the registry`,
        });
      } else {
        for (const [i, key] of (question.assets?.diagramLetters ?? []).entries()) {
          if (!getStructure(diagramId, key)) {
            issues.push({
              where: `${where} › assets.diagramLetters.${i}`,
              message: `"${key}" is not a structure on diagram "${diagramId}"`,
            });
          }
        }
      }
    }
    // A data table with ragged rows renders as a broken table, so catch it here.
    const table = question.assets?.dataTable;
    if (table) {
      table.rows.forEach((row, i) => {
        if (row.length !== table.headers.length) {
          issues.push({
            where: `${where} › assets.dataTable.rows.${i}`,
            message: `row has ${row.length} cells but there are ${table.headers.length} headers`,
          });
        }
      });
    }
  }

  // --- Cross-reference: practicals ----------------------------------------
  for (const practical of practicals) {
    const where = `practical ${practical.id}`;
    for (const [i, subTopicId] of practical.subTopicIds.entries()) {
      if (!subTopics.has(subTopicId)) {
        issues.push({
          where: `${where} › subTopicIds.${i}`,
          message: `no sub-topic "${subTopicId}"`,
        });
      }
    }
    checkUnique(
      issues,
      where,
      "fault id",
      practical.faults.map((fault) => fault.id),
    );
    for (const fault of practical.faults) {
      for (const [i, id] of fault.questionIds.entries()) {
        if (!questionIds.has(id)) {
          issues.push({
            where: `${where} › fault ${fault.id} › questionIds.${i}`,
            message: `no question "${id}" — the fault table has been orphaned from the bank`,
          });
        }
      }
    }
    // Method steps are numbered by the author; catch a duplicated or skipped number.
    practical.method.forEach((step, i) => {
      if (step.n !== i + 1) {
        issues.push({
          where: `${where} › method.${i}.n`,
          message: `steps must be numbered consecutively from 1 — expected ${i + 1}, found ${step.n}`,
        });
      }
    });
    if (practical.coverage === "PARTIAL" && practical.blockedBy.length === 0) {
      issues.push({
        where: `${where} › blockedBy`,
        message: "coverage is PARTIAL but nothing is recorded as blocking it",
      });
    }
  }

  // --- Cross-reference: blurt prompts -------------------------------------
  for (const prompt of blurtPrompts) {
    if (!subTopics.has(prompt.subTopicId)) {
      issues.push({
        where: `blurt ${prompt.id} › subTopicId`,
        message: `no sub-topic "${prompt.subTopicId}"`,
      });
    }
    checkUnique(
      issues,
      `blurt ${prompt.id}`,
      "expected point id",
      prompt.expectedPoints.map((point) => point.id),
    );
  }

  if (issues.length > 0) return { ok: false, issues };

  return {
    ok: true,
    issues: [],
    content: {
      taxonomies,
      practicals,
      lessons,
      notes,
      questions,
      blurtPrompts,
      subTopics,
      specPoints,
      specPointSubTopic,
    },
  };
}
