-- AlterTable
ALTER TABLE "ScheduledJob" ADD COLUMN "conversationId" TEXT,
ADD COLUMN "isGroup" BOOLEAN NOT NULL DEFAULT false;

-- Backfill existing records: set conversationId to the user's phone number
UPDATE "ScheduledJob" sj
SET "conversationId" = u."phoneNumber"
FROM "User" u
WHERE sj."userId" = u.id AND u."phoneNumber" IS NOT NULL;

-- For any remaining records without a conversationId, set it to userId as fallback
UPDATE "ScheduledJob"
SET "conversationId" = "userId"
WHERE "conversationId" IS NULL;

-- Now make conversationId required
ALTER TABLE "ScheduledJob" ALTER COLUMN "conversationId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "ScheduledJob_conversationId_idx" ON "ScheduledJob"("conversationId");

