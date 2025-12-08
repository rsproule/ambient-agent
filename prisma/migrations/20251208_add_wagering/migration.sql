-- CreateEnum
CREATE TYPE "WagerStatus" AS ENUM ('open', 'active', 'pending_verification', 'resolved', 'cancelled');

-- CreateEnum
CREATE TYPE "VerificationType" AS ENUM ('subjective', 'deadline', 'photo_proof');

-- CreateTable
CREATE TABLE "Wager" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "creatorPhone" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "sides" TEXT[],
    "verificationType" "VerificationType" NOT NULL,
    "verificationConfig" JSONB,
    "status" "WagerStatus" NOT NULL DEFAULT 'open',
    "deadline" TIMESTAMP(3),
    "result" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "proofUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wager_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WagerPosition" (
    "id" TEXT NOT NULL,
    "wagerId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "matchedAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WagerPosition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Wager_conversationId_status_idx" ON "Wager"("conversationId", "status");

-- CreateIndex
CREATE INDEX "Wager_deadline_idx" ON "Wager"("deadline");

-- CreateIndex
CREATE INDEX "WagerPosition_wagerId_idx" ON "WagerPosition"("wagerId");

-- CreateIndex
CREATE INDEX "WagerPosition_phone_idx" ON "WagerPosition"("phone");

-- AddForeignKey
ALTER TABLE "WagerPosition" ADD CONSTRAINT "WagerPosition_wagerId_fkey" FOREIGN KEY ("wagerId") REFERENCES "Wager"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add wageringEnabled flag to GroupChatSettings
ALTER TABLE "GroupChatSettings" ADD COLUMN "wageringEnabled" BOOLEAN NOT NULL DEFAULT false;
