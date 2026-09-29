-- Phase 6 — flashcards (FSRS-6) and semi-blurting.
--
-- CardTemplate is global: card text depends only on (question, mark point, spec point),
-- so it is generated once and shared. Flashcard carries one student's FSRS state, and
-- CardReview stores the full prior state so undo can restore it exactly.

-- CreateEnum
CREATE TYPE "CardType" AS ENUM ('QA', 'DEFINITION', 'CLOZE');
CREATE TYPE "CardState" AS ENUM ('NEW', 'LEARNING', 'REVIEW', 'RELEARNING');
CREATE TYPE "CardRating" AS ENUM ('AGAIN', 'HARD', 'GOOD', 'EASY');

-- CreateTable
CREATE TABLE "CardTemplate" (
  "id"          TEXT NOT NULL,
  "questionId"  TEXT NOT NULL,
  "markPointId" TEXT NOT NULL,
  "specPointId" TEXT NOT NULL,
  "cardType"    "CardType" NOT NULL DEFAULT 'QA',
  "front"       TEXT NOT NULL,
  "back"        TEXT NOT NULL,
  "hint"        TEXT,
  "generatedBy" TEXT NOT NULL,
  "reviewed"    BOOLEAN NOT NULL DEFAULT false,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CardTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Flashcard" (
  "id"              TEXT NOT NULL,
  "userId"          TEXT NOT NULL,
  "templateId"      TEXT NOT NULL,
  "specPointId"     TEXT NOT NULL,
  "due"             TIMESTAMP(3) NOT NULL,
  "stability"       DOUBLE PRECISION NOT NULL DEFAULT 0,
  "difficulty"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "elapsedDays"     INTEGER NOT NULL DEFAULT 0,
  "scheduledDays"   INTEGER NOT NULL DEFAULT 0,
  "reps"            INTEGER NOT NULL DEFAULT 0,
  "lapses"          INTEGER NOT NULL DEFAULT 0,
  "learningSteps"   INTEGER NOT NULL DEFAULT 0,
  "state"           "CardState" NOT NULL DEFAULT 'NEW',
  "lastReview"      TIMESTAMP(3),
  "leech"           BOOLEAN NOT NULL DEFAULT false,
  "suspendedAt"     TIMESTAMP(3),
  "retiredAt"       TIMESTAMP(3),
  "sourceAttemptId" TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Flashcard_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CardReview" (
  "id"                 TEXT NOT NULL,
  "cardId"             TEXT NOT NULL,
  "userId"             TEXT NOT NULL,
  "rating"             "CardRating" NOT NULL,
  "reviewedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "durationMs"         INTEGER NOT NULL DEFAULT 0,
  "priorDue"           TIMESTAMP(3) NOT NULL,
  "priorStability"     DOUBLE PRECISION NOT NULL,
  "priorDifficulty"    DOUBLE PRECISION NOT NULL,
  "priorElapsedDays"   INTEGER NOT NULL,
  "priorScheduledDays" INTEGER NOT NULL,
  "priorReps"          INTEGER NOT NULL,
  "priorLapses"        INTEGER NOT NULL,
  "priorLearningSteps" INTEGER NOT NULL,
  "priorState"         "CardState" NOT NULL,
  "priorLastReview"    TIMESTAMP(3),

  CONSTRAINT "CardReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BlurtAttempt" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "promptId"    TEXT NOT NULL,
  "text"        TEXT NOT NULL,
  "coveragePct" INTEGER NOT NULL DEFAULT 0,
  "detail"      JSONB,
  "markedBy"    "MarkedBy" NOT NULL DEFAULT 'AI_FALLBACK',
  "durationSec" INTEGER NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BlurtAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CardTemplate_questionId_idx" ON "CardTemplate"("questionId");
CREATE INDEX "CardTemplate_specPointId_idx" ON "CardTemplate"("specPointId");

CREATE UNIQUE INDEX "Flashcard_userId_templateId_key" ON "Flashcard"("userId", "templateId");
CREATE INDEX "Flashcard_userId_due_idx" ON "Flashcard"("userId", "due");
CREATE INDEX "Flashcard_userId_specPointId_idx" ON "Flashcard"("userId", "specPointId");

CREATE INDEX "CardReview_cardId_reviewedAt_idx" ON "CardReview"("cardId", "reviewedAt");
CREATE INDEX "CardReview_userId_reviewedAt_idx" ON "CardReview"("userId", "reviewedAt");

CREATE INDEX "BlurtAttempt_userId_createdAt_idx" ON "BlurtAttempt"("userId", "createdAt");
CREATE INDEX "BlurtAttempt_promptId_idx" ON "BlurtAttempt"("promptId");

-- AddForeignKey
ALTER TABLE "CardTemplate" ADD CONSTRAINT "CardTemplate_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CardTemplate" ADD CONSTRAINT "CardTemplate_specPointId_fkey" FOREIGN KEY ("specPointId") REFERENCES "SpecPoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Flashcard" ADD CONSTRAINT "Flashcard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Flashcard" ADD CONSTRAINT "Flashcard_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CardTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Flashcard" ADD CONSTRAINT "Flashcard_specPointId_fkey" FOREIGN KEY ("specPointId") REFERENCES "SpecPoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CardReview" ADD CONSTRAINT "CardReview_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Flashcard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BlurtAttempt" ADD CONSTRAINT "BlurtAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BlurtAttempt" ADD CONSTRAINT "BlurtAttempt_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "BlurtPrompt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
