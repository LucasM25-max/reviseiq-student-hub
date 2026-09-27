-- ReviseIQ Learn activity (Phase 4)
-- Records what a student did. Never seeded; written only by the app.

-- CreateEnum
CREATE TYPE "ProgressState" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');
CREATE TYPE "AttemptContext" AS ENUM ('LESSON_CHECK', 'PRACTICE', 'MINI_MOCK', 'FULL_MOCK', 'MASTERY_CHECK');
CREATE TYPE "MarkedBy" AS ENUM ('AUTO', 'AI', 'AI_FALLBACK', 'SELF');

-- CreateTable
CREATE TABLE "LessonProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "lastBlockIndex" INTEGER NOT NULL DEFAULT 0,
    "state" "ProgressState" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "totalSeconds" INTEGER NOT NULL DEFAULT 0,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonProgress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LessonCheckAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "blockIndex" INTEGER NOT NULL,
    "chosenKey" TEXT NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "firstCorrect" BOOLEAN NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonCheckAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuestionSet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT,
    "questionIds" TEXT[],
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "QuestionSet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuestionAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "context" "AttemptContext" NOT NULL,
    "setId" TEXT,
    "answerText" TEXT,
    "answerKey" TEXT,
    "awardedMarks" INTEGER NOT NULL DEFAULT 0,
    "maxMarks" INTEGER NOT NULL,
    "markedBy" "MarkedBy" NOT NULL,
    "markDetail" JSONB,
    "aiConfidence" DOUBLE PRECISION,
    "disputed" BOOLEAN NOT NULL DEFAULT false,
    "durationSec" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LessonProgress_userId_lessonId_key" ON "LessonProgress"("userId", "lessonId");
CREATE INDEX "LessonProgress_userId_state_idx" ON "LessonProgress"("userId", "state");

CREATE UNIQUE INDEX "LessonCheckAttempt_userId_lessonId_blockIndex_key" ON "LessonCheckAttempt"("userId", "lessonId", "blockIndex");
CREATE INDEX "LessonCheckAttempt_userId_lessonId_idx" ON "LessonCheckAttempt"("userId", "lessonId");

CREATE INDEX "QuestionSet_userId_createdAt_idx" ON "QuestionSet"("userId", "createdAt");
CREATE INDEX "QuestionSet_userId_lessonId_idx" ON "QuestionSet"("userId", "lessonId");

CREATE UNIQUE INDEX "QuestionAttempt_setId_questionId_key" ON "QuestionAttempt"("setId", "questionId");
CREATE INDEX "QuestionAttempt_userId_questionId_idx" ON "QuestionAttempt"("userId", "questionId");
CREATE INDEX "QuestionAttempt_userId_createdAt_idx" ON "QuestionAttempt"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LessonCheckAttempt" ADD CONSTRAINT "LessonCheckAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LessonCheckAttempt" ADD CONSTRAINT "LessonCheckAttempt_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "QuestionSet" ADD CONSTRAINT "QuestionSet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuestionSet" ADD CONSTRAINT "QuestionSet_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "QuestionAttempt" ADD CONSTRAINT "QuestionAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuestionAttempt" ADD CONSTRAINT "QuestionAttempt_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuestionAttempt" ADD CONSTRAINT "QuestionAttempt_setId_fkey" FOREIGN KEY ("setId") REFERENCES "QuestionSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
