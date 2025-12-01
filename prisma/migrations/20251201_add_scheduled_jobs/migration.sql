-- CreateEnum
CREATE TYPE "ScheduledJobNotifyMode" AS ENUM ('always', 'significant');

-- AlterTable: Add per-hook tracking fields to UserContext
ALTER TABLE "UserContext" ADD COLUMN "hookLastRunTimes" JSONB;
ALTER TABLE "UserContext" ADD COLUMN "hookCooldowns" JSONB;

-- CreateTable: ScheduledJob
CREATE TABLE "ScheduledJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "cronSchedule" TEXT NOT NULL,
    "timezone" TEXT,
    "notifyMode" "ScheduledJobNotifyMode" NOT NULL DEFAULT 'significant',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "lastResult" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduledJob_userId_idx" ON "ScheduledJob"("userId");

-- CreateIndex
CREATE INDEX "ScheduledJob_enabled_nextRunAt_idx" ON "ScheduledJob"("enabled", "nextRunAt");

-- AddForeignKey
ALTER TABLE "ScheduledJob" ADD CONSTRAINT "ScheduledJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

