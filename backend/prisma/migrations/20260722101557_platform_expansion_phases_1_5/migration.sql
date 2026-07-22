-- CreateEnum
CREATE TYPE "PostOrigin" AS ENUM ('NEWS', 'CALENDAR', 'REPURPOSE', 'TREND', 'MANUAL');

-- CreateEnum
CREATE TYPE "TrendVerdict" AS ENUM ('ACT_NOW', 'PLAN', 'WATCH', 'PASS');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('FOUNDER_BRIEFING_DAILY', 'FOUNDER_BRIEFING_WEEKLY');

-- CreateEnum
CREATE TYPE "EngagementKind" AS ENUM ('DM', 'MENTION', 'COMMENT');

-- CreateEnum
CREATE TYPE "EngagementStatus" AS ENUM ('NEW', 'TRIAGED', 'REPLIED', 'IGNORED', 'ESCALATED');

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "meta" JSONB,
ADD COLUMN     "origin" "PostOrigin" NOT NULL DEFAULT 'NEWS';

-- CreateTable
CREATE TABLE "BrandStrategy" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "positioningStatement" TEXT,
    "targetAudience" TEXT,
    "voiceDos" TEXT[],
    "voiceDonts" TEXT[],
    "platformFlex" JSONB,
    "driftNotes" TEXT,
    "driftCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandStrategy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentPillar" (
    "id" TEXT NOT NULL,
    "strategyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "targetPercentage" INTEGER NOT NULL DEFAULT 20,
    "topicBank" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentPillar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CadenceRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "weekday" INTEGER NOT NULL,
    "timeOfDay" TEXT NOT NULL,
    "pillarId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CadenceRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarSlot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "pillarId" TEXT,
    "isFlex" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "generatedPostId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalendarSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepurposeSource" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepurposeSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepurposeInsight" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "generatedPostId" TEXT,

    CONSTRAINT "RepurposeInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrendSignal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sourceUrl" TEXT,
    "sourceNewsItemId" TEXT,
    "relevanceScore" INTEGER NOT NULL,
    "authenticityScore" INTEGER NOT NULL,
    "actionabilityScore" INTEGER NOT NULL,
    "totalScore" INTEGER NOT NULL,
    "verdict" "TrendVerdict" NOT NULL,
    "respondByAt" TIMESTAMP(3),
    "generatedPostId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrendSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ReportType" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EngagementItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT,
    "platform" "Platform" NOT NULL,
    "kind" "EngagementKind" NOT NULL,
    "category" TEXT,
    "priority" TEXT,
    "sentiment" TEXT,
    "authorHandle" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "permalink" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "status" "EngagementStatus" NOT NULL DEFAULT 'NEW',
    "slaDueAt" TIMESTAMP(3),
    "replyBody" TEXT,
    "repliedAt" TIMESTAMP(3),
    "crisisEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EngagementItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrisisEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "triageCategory" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "apologyDraft" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrisisEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImpersonatorReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "impersonatingHandle" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DETECTED',
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImpersonatorReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BrandStrategy_userId_key" ON "BrandStrategy"("userId");

-- CreateIndex
CREATE INDEX "ContentPillar_strategyId_idx" ON "ContentPillar"("strategyId");

-- CreateIndex
CREATE INDEX "CadenceRule_userId_active_idx" ON "CadenceRule"("userId", "active");

-- CreateIndex
CREATE INDEX "CalendarSlot_userId_scheduledFor_idx" ON "CalendarSlot"("userId", "scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarSlot_userId_platform_scheduledFor_key" ON "CalendarSlot"("userId", "platform", "scheduledFor");

-- CreateIndex
CREATE INDEX "RepurposeSource_userId_idx" ON "RepurposeSource"("userId");

-- CreateIndex
CREATE INDEX "RepurposeInsight_sourceId_idx" ON "RepurposeInsight"("sourceId");

-- CreateIndex
CREATE INDEX "TrendSignal_userId_createdAt_idx" ON "TrendSignal"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Report_userId_type_createdAt_idx" ON "Report"("userId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "EngagementItem_userId_status_idx" ON "EngagementItem"("userId", "status");

-- CreateIndex
CREATE INDEX "CrisisEvent_userId_status_idx" ON "CrisisEvent"("userId", "status");

-- AddForeignKey
ALTER TABLE "BrandStrategy" ADD CONSTRAINT "BrandStrategy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentPillar" ADD CONSTRAINT "ContentPillar_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "BrandStrategy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CadenceRule" ADD CONSTRAINT "CadenceRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarSlot" ADD CONSTRAINT "CalendarSlot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepurposeSource" ADD CONSTRAINT "RepurposeSource_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepurposeInsight" ADD CONSTRAINT "RepurposeInsight_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "RepurposeSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrendSignal" ADD CONSTRAINT "TrendSignal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngagementItem" ADD CONSTRAINT "EngagementItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngagementItem" ADD CONSTRAINT "EngagementItem_crisisEventId_fkey" FOREIGN KEY ("crisisEventId") REFERENCES "CrisisEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrisisEvent" ADD CONSTRAINT "CrisisEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImpersonatorReport" ADD CONSTRAINT "ImpersonatorReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
