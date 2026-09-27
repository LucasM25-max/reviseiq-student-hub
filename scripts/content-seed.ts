/**
 * `npm run content:seed`
 *
 * Rebuilds the content tables in Postgres from /content.
 *
 * Files are the source of truth; Postgres is a query layer (doc 04). So this script is
 * **idempotent** — every row is upserted by its stable id, and anything in the database
 * that is no longer in /content is deleted. Running it twice in a row produces the same
 * database and reports zero changes the second time.
 *
 * It refuses to write anything unless `content:validate` would pass, so a broken content
 * file can never reach the database.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { Prisma, PrismaClient } from "../src/generated/prisma/client";
import { analyseCoverage } from "../src/lib/content/coverage";
import { loadContent, type LoadedContent } from "../src/lib/content/registry";
import { topicId } from "../src/lib/curriculum/taxonomy";

/**
 * Prisma types JSON columns as `InputJsonValue`, a structural type that our precise zod
 * types do not satisfy (an interface with known keys has no index signature). The values
 * really are JSON — zod has already proven it — so the cast is safe and is kept in one
 * place rather than sprinkled through the file.
 */
const json = (value: unknown) => value as Prisma.InputJsonValue;

/** Nullable JSON columns need `Prisma.DbNull` to write a SQL NULL, not a JSON `null`. */
const nullableJson = (value: unknown) =>
  value === undefined || value === null ? Prisma.DbNull : (value as Prisma.InputJsonValue);

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env first.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const counts = {
  subTopics: 0,
  specPoints: 0,
  lessons: 0,
  lessonBlockLinks: 0,
  noteSections: 0,
  practicals: 0,
  blurtPrompts: 0,
  questions: 0,
  questionSpecPoints: 0,
  markSchemes: 0,
  deleted: 0,
};

async function seed(content: LoadedContent): Promise<void> {
  // --- Sub-topics and spec points -----------------------------------------
  const subTopicIds: string[] = [];
  const specPointIds: string[] = [];

  for (const taxonomy of content.taxonomies) {
    const parentTopicId = topicId(taxonomy.subjectId, taxonomy.topicCode);
    const topic = await prisma.topic.findUnique({ where: { id: parentTopicId } });
    if (!topic) {
      throw new Error(
        `Topic "${parentTopicId}" does not exist. Run \`npm run db:seed\` (the taxonomy seed) first.`,
      );
    }

    for (const subTopic of taxonomy.subTopics) {
      const data = {
        topicId: parentTopicId,
        code: subTopic.code,
        title: subTopic.title,
        order: subTopic.order,
      };
      await prisma.subTopic.upsert({
        where: { id: subTopic.id },
        create: { id: subTopic.id, ...data },
        update: data,
      });
      subTopicIds.push(subTopic.id);
      counts.subTopics += 1;

      for (const [index, specPoint] of subTopic.specPoints.entries()) {
        const specData = {
          subTopicId: subTopic.id,
          code: specPoint.code,
          statement: specPoint.statement,
          tier: specPoint.tier,
          mathsSkills: specPoint.mathsSkills,
          wsSkills: specPoint.wsSkills,
          practicalIds: specPoint.practicalIds,
          coverage: specPoint.coverage,
          blockedBy: specPoint.blockedBy,
          order: index,
        };
        await prisma.specPoint.upsert({
          where: { id: specPoint.id },
          create: { id: specPoint.id, ...specData },
          update: specData,
        });
        specPointIds.push(specPoint.id);
        counts.specPoints += 1;
      }
    }
  }

  // --- Practicals ----------------------------------------------------------
  for (const practical of content.practicals) {
    const data = {
      subjectId: practical.subjectId,
      number: practical.number,
      title: practical.title,
      requirement: practical.requirement,
      aim: practical.aim,
      apparatus: practical.apparatus,
      method: json(practical.method),
      safety: practical.safety,
      faults: json(practical.faults),
      subTopicIds: practical.subTopicIds,
      atSkills: practical.atSkills,
      coverage: practical.coverage,
      blockedBy: practical.blockedBy,
    };
    await prisma.practical.upsert({
      where: { id: practical.id },
      create: { id: practical.id, ...data },
      update: data,
    });
    counts.practicals += 1;
  }

  // --- Lessons -------------------------------------------------------------
  for (const lesson of content.lessons) {
    const data = {
      subTopicId: lesson.subTopicId,
      slug: lesson.slug,
      title: lesson.title,
      summary: lesson.summary,
      order: lesson.order,
      estMinutes: lesson.estMinutes,
      tier: lesson.tier,
      blocks: json(lesson.blocks),
    };
    await prisma.lesson.upsert({
      where: { id: lesson.id },
      create: { id: lesson.id, ...data },
      update: data,
    });
    counts.lessons += 1;

    // The flattened block → spec point index. Rebuilt wholesale because block indices
    // shift whenever a block is inserted, so upserting by id would leave stale rows.
    await prisma.lessonBlockSpecPoint.deleteMany({ where: { lessonId: lesson.id } });
    const links = lesson.blocks.flatMap((block, blockIndex) =>
      block.specPoints.map((specPointId) => ({
        id: `${lesson.id}:${blockIndex}:${specPointId}`,
        lessonId: lesson.id,
        specPointId,
        blockIndex,
        recap: block.recap,
      })),
    );
    if (links.length > 0) {
      await prisma.lessonBlockSpecPoint.createMany({ data: links });
      counts.lessonBlockLinks += links.length;
    }
  }

  // --- Note sections -------------------------------------------------------
  const noteSectionIds: string[] = [];
  for (const page of content.notes) {
    for (const [index, section] of page.sections.entries()) {
      const data = {
        subTopicId: page.subTopicId,
        slug: section.slug,
        title: section.title,
        body: section.body,
        tier: section.tier,
        specPointCodes: section.specPointCodes,
        order: index,
      };
      await prisma.noteSection.upsert({
        where: { id: section.id },
        create: { id: section.id, ...data },
        update: data,
      });
      noteSectionIds.push(section.id);
      counts.noteSections += 1;
    }
  }

  // --- Blurt prompts -------------------------------------------------------
  for (const [index, prompt] of content.blurtPrompts.entries()) {
    const data = {
      subTopicId: prompt.subTopicId,
      prompt: prompt.prompt,
      expectedPoints: json(prompt.expectedPoints),
      tier: prompt.tier,
      estMinutes: prompt.estMinutes,
      order: index,
    };
    await prisma.blurtPrompt.upsert({
      where: { id: prompt.id },
      create: { id: prompt.id, ...data },
      update: data,
    });
    counts.blurtPrompts += 1;
  }

  // --- Questions, their spec point links and mark schemes -------------------
  for (const question of content.questions) {
    const data = {
      subjectId: question.subjectId,
      primarySubTopicId: question.primarySubTopicId,
      type: question.type,
      tier: question.tier,
      paper: question.paper,
      marks: question.marks,
      commandWord: question.commandWord,
      ao: question.ao,
      difficulty: question.difficulty,
      stem: question.stem,
      assets: nullableJson(question.assets),
      options: nullableJson(question.options),
      correctKey: question.correctKey ?? null,
      estSeconds: question.estSeconds,
      retired: question.retired,
    };
    await prisma.question.upsert({
      where: { id: question.id },
      create: { id: question.id, ...data },
      update: data,
    });
    counts.questions += 1;

    await prisma.questionSpecPoint.deleteMany({ where: { questionId: question.id } });
    await prisma.questionSpecPoint.createMany({
      data: question.specPoints.map((ref) => ({
        questionId: question.id,
        specPointId: ref.code,
        weight: ref.weight,
      })),
    });
    counts.questionSpecPoints += question.specPoints.length;

    const scheme = {
      points: json(question.markScheme.points),
      guidance: question.markScheme.guidance ?? null,
      ecfRules: question.markScheme.ecfRules ?? null,
      modelAnswer: question.markScheme.modelAnswer ?? null,
      numericAnswer: nullableJson(question.markScheme.numericAnswer),
    };
    await prisma.markScheme.upsert({
      where: { questionId: question.id },
      create: { questionId: question.id, ...scheme },
      update: scheme,
    });
    counts.markSchemes += 1;
  }

  // --- Prune ----------------------------------------------------------------
  // /content is the source of truth, so anything here that is not in /content was
  // deleted or renamed upstream and must not linger.
  //
  // These run **in sequence, children first**, deliberately. An earlier version used
  // `Promise.all`, which fires them concurrently: deleting a SpecPoint cascades into
  // QuestionSpecPoint at the same moment deleting a Question cascades into the same
  // table, which is a deadlock waiting for a large enough content set. Sequential
  // deletes cost milliseconds on a set this size and cannot interleave.
  const questionIds = content.questions.map((question) => question.id);
  const lessonIds = content.lessons.map((lesson) => lesson.id);
  const blurtPromptIds = content.blurtPrompts.map((prompt) => prompt.id);
  const practicalIds = content.practicals.map((practical) => practical.id);

  const prunes: [string, () => Promise<{ count: number }>][] = [
    ["question", () => prisma.question.deleteMany({ where: { id: { notIn: questionIds } } })],
    ["lesson", () => prisma.lesson.deleteMany({ where: { id: { notIn: lessonIds } } })],
    [
      "noteSection",
      () => prisma.noteSection.deleteMany({ where: { id: { notIn: noteSectionIds } } }),
    ],
    [
      "blurtPrompt",
      () => prisma.blurtPrompt.deleteMany({ where: { id: { notIn: blurtPromptIds } } }),
    ],
    [
      "practical",
      () => prisma.practical.deleteMany({ where: { id: { notIn: practicalIds } } }),
    ],
    [
      "specPoint",
      () => prisma.specPoint.deleteMany({ where: { id: { notIn: specPointIds } } }),
    ],
    ["subTopic", () => prisma.subTopic.deleteMany({ where: { id: { notIn: subTopicIds } } })],
  ];

  for (const [, run] of prunes) {
    const result = await run();
    counts.deleted += result.count;
  }
}

async function main(): Promise<void> {
  const result = loadContent();
  if (!result.ok) {
    console.error(
      `[content:seed] refusing to seed — content has ${result.issues.length} problem(s).`,
    );
    console.error("[content:seed] run `npm run content:validate` for detail.");
    process.exitCode = 1;
    return;
  }

  const report = analyseCoverage(result.content);
  if (report.errors.length > 0) {
    console.error(
      `[content:seed] refusing to seed — ${report.errors.length} coverage gate failure(s).`,
    );
    console.error("[content:seed] run `npm run content:validate` for detail.");
    process.exitCode = 1;
    return;
  }

  await seed(result.content);

  console.log(
    `[content:seed] ${counts.subTopics} sub-topics, ${counts.specPoints} spec points, ` +
      `${counts.lessons} lessons (${counts.lessonBlockLinks} block links), ` +
      `${counts.noteSections} note sections, ${counts.practicals} practicals, ` +
      `${counts.blurtPrompts} blurt prompts, ${counts.questions} questions ` +
      `(${counts.questionSpecPoints} spec point links, ${counts.markSchemes} mark schemes)` +
      (counts.deleted > 0 ? `, ${counts.deleted} stale row(s) removed` : ""),
  );
}

main()
  .catch((error) => {
    console.error("[content:seed] failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
