-- ReviseIQ initial schema (Phases 0-2)

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('STUDENT', 'ADMIN');
CREATE TYPE "YearGroup" AS ENUM ('YEAR_10', 'YEAR_11', 'OTHER');
CREATE TYPE "ReminderChannel" AS ENUM ('NONE', 'EMAIL', 'PUSH', 'BOTH');
CREATE TYPE "OnboardingStep" AS ENUM ('SUBJECTS', 'SETUP', 'RAG', 'AVAILABILITY', 'DONE');
CREATE TYPE "SubjectCode" AS ENUM ('BIOLOGY', 'CHEMISTRY', 'PHYSICS');
CREATE TYPE "TierChoice" AS ENUM ('FOUNDATION', 'HIGHER', 'UNSURE');
CREATE TYPE "RagScope" AS ENUM ('TOPIC', 'SUBTOPIC');
CREATE TYPE "RagValue" AS ENUM ('NOT_LEARNT', 'RED', 'AMBER', 'GREEN');
CREATE TYPE "RagSource" AS ENUM ('USER', 'SUGGESTED_ACCEPTED', 'IMPORTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "name" TEXT,
    "image" TEXT,
    "passwordHash" TEXT,
    "dateOfBirth" DATE,
    "role" "Role" NOT NULL DEFAULT 'STUDENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("provider","providerAccountId")
);

-- CreateTable
CREATE TABLE "Session" (
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("sessionToken")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("identifier","token")
);

-- CreateTable
CREATE TABLE "Authenticator" (
    "credentialID" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "credentialPublicKey" TEXT NOT NULL,
    "counter" INTEGER NOT NULL,
    "credentialDeviceType" TEXT NOT NULL,
    "credentialBackedUp" BOOLEAN NOT NULL,
    "transports" TEXT,

    CONSTRAINT "Authenticator_pkey" PRIMARY KEY ("credentialID")
);

-- CreateTable
CREATE TABLE "EmailVerificationToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateBucket" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "windowEnd" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateBucket_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "StudentProfile" (
    "userId" TEXT NOT NULL,
    "displayName" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/London',
    "yearGroup" "YearGroup" NOT NULL DEFAULT 'YEAR_11',
    "dailyGoalMinutes" INTEGER NOT NULL DEFAULT 30,
    "holidayGoalMinutes" INTEGER NOT NULL DEFAULT 60,
    "onboardingStep" "OnboardingStep" NOT NULL DEFAULT 'SUBJECTS',
    "onboardingCompletedAt" TIMESTAMP(3),
    "streakCurrent" INTEGER NOT NULL DEFAULT 0,
    "streakLongest" INTEGER NOT NULL DEFAULT 0,
    "streakFreezesLeft" INTEGER NOT NULL DEFAULT 2,
    "lastActiveDate" DATE,
    "examsCompletedAt" TIMESTAMP(3),
    "congratulationsSeenAt" TIMESTAMP(3),
    "schedulingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "reminderChannel" "ReminderChannel" NOT NULL DEFAULT 'NONE',
    "reminderTimes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reduceMotion" BOOLEAN NOT NULL DEFAULT false,
    "dyslexiaFont" BOOLEAN NOT NULL DEFAULT false,
    "theme" TEXT NOT NULL DEFAULT 'system',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL,
    "code" "SubjectCode" NOT NULL,
    "examBoard" TEXT NOT NULL DEFAULT 'AQA',
    "qualCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accent" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Topic" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "paper" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubTopic" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "SubTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubjectEnrolment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "tier" "TierChoice" NOT NULL DEFAULT 'UNSURE',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubjectEnrolment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamDate" (
    "id" TEXT NOT NULL,
    "enrolmentId" TEXT NOT NULL,
    "paper" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ExamDate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RagRating" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scope" "RagScope" NOT NULL,
    "topicId" TEXT,
    "subTopicId" TEXT,
    "value" "RagValue" NOT NULL,
    "source" "RagSource" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RagRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilitySlot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "minutes" INTEGER NOT NULL,
    "preferredStart" TEXT,

    CONSTRAINT "AvailabilitySlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");
CREATE INDEX "Account_userId_idx" ON "Account"("userId");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Authenticator_userId_idx" ON "Authenticator"("userId");
CREATE UNIQUE INDEX "EmailVerificationToken_tokenHash_key" ON "EmailVerificationToken"("tokenHash");
CREATE INDEX "EmailVerificationToken_userId_idx" ON "EmailVerificationToken"("userId");
CREATE INDEX "EmailVerificationToken_expiresAt_idx" ON "EmailVerificationToken"("expiresAt");
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");
CREATE INDEX "RateBucket_windowEnd_idx" ON "RateBucket"("windowEnd");
CREATE UNIQUE INDEX "Subject_code_key" ON "Subject"("code");
CREATE UNIQUE INDEX "Topic_subjectId_code_key" ON "Topic"("subjectId", "code");
CREATE INDEX "Topic_subjectId_order_idx" ON "Topic"("subjectId", "order");
CREATE UNIQUE INDEX "SubTopic_topicId_code_key" ON "SubTopic"("topicId", "code");
CREATE INDEX "SubTopic_topicId_order_idx" ON "SubTopic"("topicId", "order");
CREATE UNIQUE INDEX "SubjectEnrolment_userId_subjectId_key" ON "SubjectEnrolment"("userId", "subjectId");
CREATE INDEX "SubjectEnrolment_userId_idx" ON "SubjectEnrolment"("userId");
CREATE UNIQUE INDEX "ExamDate_enrolmentId_paper_key" ON "ExamDate"("enrolmentId", "paper");
CREATE UNIQUE INDEX "RagRating_userId_topicId_key" ON "RagRating"("userId", "topicId");
CREATE UNIQUE INDEX "RagRating_userId_subTopicId_key" ON "RagRating"("userId", "subTopicId");
CREATE INDEX "RagRating_userId_value_idx" ON "RagRating"("userId", "value");
CREATE UNIQUE INDEX "AvailabilitySlot_userId_weekday_key" ON "AvailabilitySlot"("userId", "weekday");
CREATE INDEX "AvailabilitySlot_userId_idx" ON "AvailabilitySlot"("userId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Authenticator" ADD CONSTRAINT "Authenticator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubTopic" ADD CONSTRAINT "SubTopic_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubjectEnrolment" ADD CONSTRAINT "SubjectEnrolment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubjectEnrolment" ADD CONSTRAINT "SubjectEnrolment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExamDate" ADD CONSTRAINT "ExamDate_enrolmentId_fkey" FOREIGN KEY ("enrolmentId") REFERENCES "SubjectEnrolment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RagRating" ADD CONSTRAINT "RagRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RagRating" ADD CONSTRAINT "RagRating_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RagRating" ADD CONSTRAINT "RagRating_subTopicId_fkey" FOREIGN KEY ("subTopicId") REFERENCES "SubTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AvailabilitySlot" ADD CONSTRAINT "AvailabilitySlot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
