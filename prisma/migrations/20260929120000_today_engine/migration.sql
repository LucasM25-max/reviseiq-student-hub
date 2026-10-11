-- Phase 7 — the Today engine.
--
-- A DayPlan is regenerated rather than mutated: superseding writes a new plan and
-- stamps the old one, so "what was I asked to do on Tuesday" stays answerable.

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'DONE', 'SKIPPED', 'SWAPPED');
CREATE TYPE "SchoolTestKind" AS ENUM ('CLASS_TEST', 'END_OF_TOPIC', 'SCHOOL_MOCK');

-- CreateTable
CREATE TABLE "DayPlan" (
  "id"               TEXT NOT NULL,
  "userId"           TEXT NOT NULL,
  "planDate"         DATE NOT NULL,
  "mode"             TEXT NOT NULL,
  "targetMinutes"    INTEGER NOT NULL,
  "algoVersion"      TEXT NOT NULL,
  "gateMessage"      TEXT,
  "suppressedReason" TEXT,
  "supersededAt"     TIMESTAMP(3),
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DayPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlanTask" (
  "id"            TEXT NOT NULL,
  "planId"        TEXT NOT NULL,
  "order"         INTEGER NOT NULL,
  "type"          TEXT NOT NULL,
  "status"        "TaskStatus" NOT NULL DEFAULT 'PENDING',
  "subjectId"     TEXT,
  "subTopicId"    TEXT,
  "title"         TEXT NOT NULL,
  "rationale"     TEXT NOT NULL,
  "estMinutes"    INTEGER NOT NULL,
  "actualMinutes" INTEGER,
  "targetHref"    TEXT NOT NULL,
  "payload"       JSONB,
  "setId"         TEXT,
  "score"         DOUBLE PRECISION NOT NULL DEFAULT 0,
  "startedAt"     TIMESTAMP(3),
  "completedAt"   TIMESTAMP(3),

  CONSTRAINT "PlanTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LearningNowFlag" (
  "id"         TEXT NOT NULL,
  "userId"     TEXT NOT NULL,
  "subTopicId" TEXT NOT NULL,
  "expiresAt"  TIMESTAMP(3) NOT NULL,
  "auto"       BOOLEAN NOT NULL DEFAULT false,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LearningNowFlag_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SchoolTest" (
  "id"             TEXT NOT NULL,
  "userId"         TEXT NOT NULL,
  "subjectId"      TEXT NOT NULL,
  "date"           DATE NOT NULL,
  "kind"           "SchoolTestKind" NOT NULL DEFAULT 'CLASS_TEST',
  "label"          TEXT,
  "subTopicIds"    TEXT[],
  "outcome"        TEXT,
  "outcomeAskedAt" TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SchoolTest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DayPlan_userId_planDate_idx" ON "DayPlan"("userId", "planDate");
CREATE INDEX "PlanTask_planId_order_idx" ON "PlanTask"("planId", "order");
CREATE UNIQUE INDEX "LearningNowFlag_userId_subTopicId_key" ON "LearningNowFlag"("userId", "subTopicId");
CREATE INDEX "LearningNowFlag_userId_expiresAt_idx" ON "LearningNowFlag"("userId", "expiresAt");
CREATE INDEX "SchoolTest_userId_date_idx" ON "SchoolTest"("userId", "date");

-- AddForeignKey
ALTER TABLE "DayPlan" ADD CONSTRAINT "DayPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanTask" ADD CONSTRAINT "PlanTask_planId_fkey" FOREIGN KEY ("planId") REFERENCES "DayPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LearningNowFlag" ADD CONSTRAINT "LearningNowFlag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LearningNowFlag" ADD CONSTRAINT "LearningNowFlag_subTopicId_fkey" FOREIGN KEY ("subTopicId") REFERENCES "SubTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SchoolTest" ADD CONSTRAINT "SchoolTest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SchoolTest" ADD CONSTRAINT "SchoolTest_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
