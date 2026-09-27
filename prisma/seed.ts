/**
 * Seeds the curriculum taxonomy (subjects and topics).
 *
 * Idempotent: upserts by stable id, so it is safe to re-run on every deploy. Content
 * (sub-topics, spec points, lessons, notes, questions) is seeded separately from
 * /content in Phase 3 — see docs/plan/04-content-pipeline.md.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { SUBJECTS, topicId } from "../src/lib/curriculum/taxonomy";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env first.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  let subjectCount = 0;
  let topicCount = 0;

  for (const subject of SUBJECTS) {
    await prisma.subject.upsert({
      where: { id: subject.id },
      create: {
        id: subject.id,
        code: subject.code,
        examBoard: "AQA",
        qualCode: subject.qualCode,
        name: subject.name,
        accent: subject.accent,
        order: subject.order,
      },
      update: {
        code: subject.code,
        qualCode: subject.qualCode,
        name: subject.name,
        accent: subject.accent,
        order: subject.order,
      },
    });
    subjectCount += 1;

    for (const [index, topic] of subject.topics.entries()) {
      const id = topicId(subject.id, topic.code);
      await prisma.topic.upsert({
        where: { id },
        create: {
          id,
          subjectId: subject.id,
          code: topic.code,
          number: topic.number,
          title: topic.title,
          paper: topic.paper,
          order: index,
        },
        update: {
          code: topic.code,
          number: topic.number,
          title: topic.title,
          paper: topic.paper,
          order: index,
        },
      });
      topicCount += 1;
    }
  }

  console.log(`[seed] ${subjectCount} subjects, ${topicCount} topics`);
}

main()
  .catch((error) => {
    console.error("[seed] failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
