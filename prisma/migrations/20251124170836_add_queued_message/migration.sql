-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('pending', 'processing', 'completed', 'failed');

-- CreateTable
CREATE TABLE "QueuedMessage" (
    "id" TEXT NOT NULL,
    "target" JSONB NOT NULL,
    "source" TEXT NOT NULL,
    "bribePayload" JSONB,
    "payload" JSONB NOT NULL,
    "status" "MessageStatus" NOT NULL DEFAULT 'pending',
    "processedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QueuedMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QueuedMessage_status_createdAt_idx" ON "QueuedMessage"("status", "createdAt");

