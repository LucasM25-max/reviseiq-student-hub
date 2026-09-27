import "server-only";

import { prisma } from "@/lib/db/prisma";

import {
  lessonBlockSchema,
  practicalSchema,
  type LessonBlock,
  type PracticalDef,
} from "./schema";

/**
 * Reads seeded content out of Postgres for the app.
 *
 * The app reads the database, not /content, because the database is the query layer the
 * whole product joins against (doc 04). The one wrinkle is that JSON columns come back
 * as `unknown`, so anything stored as JSON is re-parsed with the same zod schema that
 * validated it on the way in. That is cheap and it means a schema change that outruns a
 * re-seed surfaces as a clear error instead of a runtime crash deep in a component.
 */

/** URL slug → seeded subject id. Subjects are a fixed, small set (D6). */
const SUBJECT_BY_SLUG: Record<string, string> = {
  biology: "aqa-biology",
  chemistry: "aqa-chemistry",
  physics: "aqa-physics",
};

export const subjectIdFromSlug = (slug: string): string | undefined =>
  SUBJECT_BY_SLUG[slug.toLowerCase()];

export const subjectSlugFromId = (id: string): string => id.replace(/^aqa-/, "");

/** "4.1.1" ⇄ "4-1-1". Dots are legal in a path segment but read badly and encode oddly. */
export const codeToSlug = (code: string) => code.replaceAll(".", "-");
export const slugToCode = (slug: string) => slug.replaceAll("-", ".");

export async function getSubTopicBySlug(subjectSlug: string, subTopicSlug: string) {
  const subjectId = subjectIdFromSlug(subjectSlug);
  if (!subjectId) return null;

  return prisma.subTopic.findFirst({
    where: { code: slugToCode(subTopicSlug), topic: { subjectId } },
    include: { topic: { include: { subject: true } } },
  });
}

export async function getLessonsForSubTopic(subTopicId: string) {
  return prisma.lesson.findMany({
    where: { subTopicId },
    orderBy: { order: "asc" },
    select: { id: true, slug: true, title: true, summary: true, estMinutes: true, order: true },
  });
}

export type LessonWithBlocks = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  estMinutes: number;
  order: number;
  subTopicId: string;
  blocks: LessonBlock[];
};

export async function getLesson(
  subTopicId: string,
  slug: string,
): Promise<LessonWithBlocks | null> {
  const lesson = await prisma.lesson.findUnique({
    where: { subTopicId_slug: { subTopicId, slug } },
  });
  if (!lesson) return null;

  const blocks = lessonBlockSchema.array().safeParse(lesson.blocks);
  if (!blocks.success) {
    throw new Error(
      `Lesson "${lesson.id}" has blocks that no longer match the schema. Re-run \`npm run content:seed\`.`,
    );
  }

  return {
    id: lesson.id,
    slug: lesson.slug,
    title: lesson.title,
    summary: lesson.summary,
    estMinutes: lesson.estMinutes,
    order: lesson.order,
    subTopicId: lesson.subTopicId,
    blocks: blocks.data,
  };
}

export async function getNoteSections(subTopicId: string) {
  return prisma.noteSection.findMany({
    where: { subTopicId },
    orderBy: { order: "asc" },
  });
}

export async function getPracticalByNumber(
  subjectSlug: string,
  number: number,
): Promise<PracticalDef | null> {
  const subjectId = subjectIdFromSlug(subjectSlug);
  if (!subjectId) return null;

  const row = await prisma.practical.findUnique({
    where: { subjectId_number: { subjectId, number } },
  });
  if (!row) return null;

  // `method` and `faults` are JSON columns; parse the whole row back through the schema
  // so the component gets the same fully-typed object the content file declared.
  const parsed = practicalSchema.safeParse(row);
  if (!parsed.success) {
    throw new Error(
      `Practical "${row.id}" no longer matches the schema. Re-run \`npm run content:seed\`.`,
    );
  }
  return parsed.data;
}

/** Sub-topics that actually have a lesson, used to link the Learn index to real content. */
export async function getSubTopicsWithContent(subjectId: string) {
  return prisma.subTopic.findMany({
    where: { topic: { subjectId }, lessons: { some: {} } },
    orderBy: { order: "asc" },
    select: {
      id: true,
      code: true,
      title: true,
      topicId: true,
      _count: { select: { lessons: true, questions: true } },
    },
  });
}
