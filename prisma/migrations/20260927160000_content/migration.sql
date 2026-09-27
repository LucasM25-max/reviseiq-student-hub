-- ReviseIQ content spine (Phase 3)
-- Content is seeded from /content and is never edited by hand or by the app.

-- CreateEnum
CREATE TYPE "Tier" AS ENUM ('BOTH', 'FOUNDATION', 'HIGHER');
CREATE TYPE "Coverage" AS ENUM ('FULL', 'PARTIAL');
CREATE TYPE "QuestionType" AS ENUM ('MCQ', 'SHORT', 'CALCULATION', 'EXTENDED', 'PRACTICAL', 'DATA_RESPONSE');
CREATE TYPE "AO" AS ENUM ('AO1', 'AO2', 'AO3');

-- CreateTable
CREATE TABLE "SpecPoint" (
    "id" TEXT NOT NULL,
    "subTopicId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "tier" "Tier" NOT NULL DEFAULT 'BOTH',
    "mathsSkills" TEXT[],
    "wsSkills" TEXT[],
    "practicalIds" TEXT[],
    "coverage" "Coverage" NOT NULL DEFAULT 'FULL',
    "blockedBy" TEXT[],
    "order" INTEGER NOT NULL,

    CONSTRAINT "SpecPoint_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL,
    "subTopicId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "estMinutes" INTEGER NOT NULL,
    "tier" "Tier" NOT NULL DEFAULT 'BOTH',
    "blocks" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LessonBlockSpecPoint" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "specPointId" TEXT NOT NULL,
    "blockIndex" INTEGER NOT NULL,
    "recap" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "LessonBlockSpecPoint_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NoteSection" (
    "id" TEXT NOT NULL,
    "subTopicId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "tier" "Tier" NOT NULL DEFAULT 'BOTH',
    "specPointCodes" TEXT[],
    "order" INTEGER NOT NULL,

    CONSTRAINT "NoteSection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Practical" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "requirement" TEXT NOT NULL,
    "aim" TEXT NOT NULL,
    "apparatus" TEXT[],
    "method" JSONB NOT NULL,
    "safety" TEXT[],
    "faults" JSONB NOT NULL,
    "subTopicIds" TEXT[],
    "atSkills" TEXT[],
    "coverage" "Coverage" NOT NULL DEFAULT 'FULL',
    "blockedBy" TEXT[],

    CONSTRAINT "Practical_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BlurtPrompt" (
    "id" TEXT NOT NULL,
    "subTopicId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "expectedPoints" JSONB NOT NULL,
    "tier" "Tier" NOT NULL DEFAULT 'BOTH',
    "estMinutes" INTEGER NOT NULL DEFAULT 4,
    "order" INTEGER NOT NULL,

    CONSTRAINT "BlurtPrompt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "primarySubTopicId" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "tier" "Tier" NOT NULL DEFAULT 'BOTH',
    "paper" INTEGER NOT NULL,
    "marks" INTEGER NOT NULL,
    "commandWord" TEXT NOT NULL,
    "ao" "AO" NOT NULL,
    "difficulty" INTEGER NOT NULL,
    "stem" TEXT NOT NULL,
    "assets" JSONB,
    "options" JSONB,
    "correctKey" TEXT,
    "estSeconds" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "retired" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuestionSpecPoint" (
    "questionId" TEXT NOT NULL,
    "specPointId" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,

    CONSTRAINT "QuestionSpecPoint_pkey" PRIMARY KEY ("questionId", "specPointId")
);

CREATE TABLE "MarkScheme" (
    "questionId" TEXT NOT NULL,
    "points" JSONB NOT NULL,
    "guidance" TEXT,
    "ecfRules" TEXT,
    "modelAnswer" TEXT,
    "numericAnswer" JSONB,

    CONSTRAINT "MarkScheme_pkey" PRIMARY KEY ("questionId")
);

-- CreateIndex
CREATE INDEX "SpecPoint_subTopicId_order_idx" ON "SpecPoint"("subTopicId", "order");
CREATE UNIQUE INDEX "Lesson_subTopicId_slug_key" ON "Lesson"("subTopicId", "slug");
CREATE INDEX "Lesson_subTopicId_order_idx" ON "Lesson"("subTopicId", "order");
CREATE UNIQUE INDEX "LessonBlockSpecPoint_lessonId_blockIndex_specPointId_key" ON "LessonBlockSpecPoint"("lessonId", "blockIndex", "specPointId");
CREATE INDEX "LessonBlockSpecPoint_specPointId_idx" ON "LessonBlockSpecPoint"("specPointId");
CREATE UNIQUE INDEX "NoteSection_subTopicId_slug_key" ON "NoteSection"("subTopicId", "slug");
CREATE INDEX "NoteSection_subTopicId_order_idx" ON "NoteSection"("subTopicId", "order");
CREATE UNIQUE INDEX "Practical_subjectId_number_key" ON "Practical"("subjectId", "number");
CREATE INDEX "BlurtPrompt_subTopicId_order_idx" ON "BlurtPrompt"("subTopicId", "order");
CREATE INDEX "Question_subjectId_tier_paper_idx" ON "Question"("subjectId", "tier", "paper");
CREATE INDEX "Question_primarySubTopicId_tier_idx" ON "Question"("primarySubTopicId", "tier");
CREATE INDEX "QuestionSpecPoint_specPointId_idx" ON "QuestionSpecPoint"("specPointId");

-- AddForeignKey
ALTER TABLE "SpecPoint" ADD CONSTRAINT "SpecPoint_subTopicId_fkey" FOREIGN KEY ("subTopicId") REFERENCES "SubTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_subTopicId_fkey" FOREIGN KEY ("subTopicId") REFERENCES "SubTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LessonBlockSpecPoint" ADD CONSTRAINT "LessonBlockSpecPoint_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LessonBlockSpecPoint" ADD CONSTRAINT "LessonBlockSpecPoint_specPointId_fkey" FOREIGN KEY ("specPointId") REFERENCES "SpecPoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NoteSection" ADD CONSTRAINT "NoteSection_subTopicId_fkey" FOREIGN KEY ("subTopicId") REFERENCES "SubTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Practical" ADD CONSTRAINT "Practical_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BlurtPrompt" ADD CONSTRAINT "BlurtPrompt_subTopicId_fkey" FOREIGN KEY ("subTopicId") REFERENCES "SubTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Question" ADD CONSTRAINT "Question_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Question" ADD CONSTRAINT "Question_primarySubTopicId_fkey" FOREIGN KEY ("primarySubTopicId") REFERENCES "SubTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuestionSpecPoint" ADD CONSTRAINT "QuestionSpecPoint_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuestionSpecPoint" ADD CONSTRAINT "QuestionSpecPoint_specPointId_fkey" FOREIGN KEY ("specPointId") REFERENCES "SpecPoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarkScheme" ADD CONSTRAINT "MarkScheme_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
