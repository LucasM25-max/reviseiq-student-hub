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
import { hashPassword } from "../src/lib/auth/password-hash";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env first.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

/** Development-only demo credentials. Documented in the README. */
const DEMO_EMAIL = "demo@reviseiq.app";
const DEMO_PASSWORD = "revise-with-me-2026";

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

  await seedDemoStudent();
}

/**
 * A known-good account for development and preview environments.
 *
 * Sandboxes get rebuilt, and each rebuild takes the database with it. Because sessions
 * are stateless JWTs signed with a secret derived from the project path, the browser
 * keeps a token that still decodes perfectly while the account behind it no longer
 * exists — so the only way back in is to register again, every single time. Seeding a
 * fixed account means there is always a way in.
 *
 * Never created in production: the guard is on NODE_ENV, and the credentials are
 * published in the README, so this must never become a real account anywhere.
 */
async function seedDemoStudent() {
  if (process.env.NODE_ENV === "production") {
    console.log("[seed] skipping the demo student — NODE_ENV is production");
    return;
  }

  const passwordHash = await hashPassword(DEMO_PASSWORD);

  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    create: {
      email: DEMO_EMAIL,
      name: "Demo Student",
      passwordHash,
      // Verified and old enough, so the demo lands directly in onboarding.
      emailVerified: new Date(),
      dateOfBirth: new Date("2009-05-17"),
    },
    update: { passwordHash, deletedAt: null },
    select: { id: true },
  });

  // Reset to the start of onboarding so the flow is testable from a clean state.
  await prisma.studentProfile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, onboardingStep: "SUBJECTS" },
    update: { onboardingStep: "SUBJECTS", onboardingCompletedAt: null },
  });

  console.log(`[seed] demo student ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error("[seed] failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
