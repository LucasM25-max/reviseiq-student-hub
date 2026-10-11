-- Phase 7 completion — the school calendar and RAG suggestions.

-- CreateEnum
CREATE TYPE "RagSuggestionSource" AS ENUM ('SCHOOL_TEST', 'MASTERY', 'BLURT');
CREATE TYPE "CalendarKind" AS ENUM ('TERM', 'HALF_TERM', 'HOLIDAY', 'STUDY_LEAVE', 'EXAM_SEASON');

-- CreateTable
CREATE TABLE "RagSuggestion" (
  "id"           TEXT NOT NULL,
  "userId"       TEXT NOT NULL,
  "subTopicId"   TEXT NOT NULL,
  "suggested"    "RagValue" NOT NULL,
  "reason"       TEXT NOT NULL,
  "source"       "RagSuggestionSource" NOT NULL,
  "schoolTestId" TEXT,
  "acceptedAt"   TIMESTAMP(3),
  "dismissedAt"  TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RagSuggestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TermPeriod" (
  "id"            TEXT NOT NULL,
  "userId"        TEXT NOT NULL,
  "kind"          "CalendarKind" NOT NULL,
  "startDate"     DATE NOT NULL,
  "endDate"       DATE NOT NULL,
  "minutesPerDay" INTEGER,
  "label"         TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TermPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RagSuggestion_userId_subTopicId_source_key" ON "RagSuggestion"("userId", "subTopicId", "source");
CREATE INDEX "RagSuggestion_userId_createdAt_idx" ON "RagSuggestion"("userId", "createdAt");
CREATE INDEX "TermPeriod_userId_startDate_idx" ON "TermPeriod"("userId", "startDate");

-- AddForeignKey
ALTER TABLE "RagSuggestion" ADD CONSTRAINT "RagSuggestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RagSuggestion" ADD CONSTRAINT "RagSuggestion_subTopicId_fkey" FOREIGN KEY ("subTopicId") REFERENCES "SubTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TermPeriod" ADD CONSTRAINT "TermPeriod_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
