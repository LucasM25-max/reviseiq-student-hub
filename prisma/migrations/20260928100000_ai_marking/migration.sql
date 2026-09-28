-- Phase 5 — AI marking.
--
-- Adds the exact-answer cache, the cost/reliability ledger, rolling spec point mastery,
-- and the dispute + prompt-version columns the marker writes onto an attempt.

-- CreateEnum
CREATE TYPE "AiFeature" AS ENUM ('MARK', 'MARK_BATCH', 'BLURT', 'TUTOR', 'CARD_TEXT');
CREATE TYPE "AiOutcome" AS ENUM (
  'OK',
  'CACHED',
  'FALLBACK_NO_KEY',
  'FALLBACK_QUOTA',
  'FALLBACK_CEILING',
  'FALLBACK_ERROR',
  'FALLBACK_SCHEMA',
  'ERROR'
);

-- AlterTable
ALTER TABLE "QuestionAttempt"
  ADD COLUMN "promptVersion" TEXT,
  ADD COLUMN "disputeReason" TEXT,
  ADD COLUMN "disputedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "MarkCache" (
  "key"           TEXT NOT NULL,
  "questionId"    TEXT NOT NULL,
  "model"         TEXT NOT NULL,
  "promptVersion" TEXT NOT NULL,
  "result"        JSONB NOT NULL,
  "hits"          INTEGER NOT NULL DEFAULT 0,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MarkCache_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "AiUsage" (
  "id"            TEXT NOT NULL,
  "userId"        TEXT,
  "feature"       "AiFeature" NOT NULL,
  "model"         TEXT NOT NULL,
  "promptVersion" TEXT NOT NULL,
  "inputTokens"   INTEGER NOT NULL DEFAULT 0,
  "outputTokens"  INTEGER NOT NULL DEFAULT 0,
  "costMicroUsd"  INTEGER NOT NULL DEFAULT 0,
  "latencyMs"     INTEGER NOT NULL DEFAULT 0,
  "outcome"       "AiOutcome" NOT NULL,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SpecPointMastery" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "specPointId" TEXT NOT NULL,
  "mastery"     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "attempts"    INTEGER NOT NULL DEFAULT 0,
  "marksEarned" INTEGER NOT NULL DEFAULT 0,
  "marksTotal"  INTEGER NOT NULL DEFAULT 0,
  "lastSeenAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SpecPointMastery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarkCache_questionId_idx" ON "MarkCache"("questionId");
CREATE INDEX "MarkCache_lastUsedAt_idx" ON "MarkCache"("lastUsedAt");

CREATE INDEX "AiUsage_userId_createdAt_idx" ON "AiUsage"("userId", "createdAt");
CREATE INDEX "AiUsage_createdAt_idx" ON "AiUsage"("createdAt");
CREATE INDEX "AiUsage_feature_createdAt_idx" ON "AiUsage"("feature", "createdAt");

CREATE UNIQUE INDEX "SpecPointMastery_userId_specPointId_key" ON "SpecPointMastery"("userId", "specPointId");
CREATE INDEX "SpecPointMastery_userId_mastery_idx" ON "SpecPointMastery"("userId", "mastery");

-- AddForeignKey
ALTER TABLE "AiUsage" ADD CONSTRAINT "AiUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SpecPointMastery" ADD CONSTRAINT "SpecPointMastery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SpecPointMastery" ADD CONSTRAINT "SpecPointMastery_specPointId_fkey" FOREIGN KEY ("specPointId") REFERENCES "SpecPoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
