-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('pending', 'processing', 'completed', 'failed');

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "isGroup" BOOLEAN NOT NULL DEFAULT false,
    "groupName" TEXT,
    "participants" TEXT[],
    "summary" TEXT,
    "lastMessageAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activeResponseTaskId" TEXT,
    "interruptRequested" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sender" TEXT,
    "messageId" TEXT,
    "attachments" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "name" TEXT,
    "email" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "PrioritizationConfig" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "minimumNotifyPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "customValuePrompt" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrioritizationConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageEvaluation" (
    "id" TEXT NOT NULL,
    "queuedMessageId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "baseValue" DECIMAL(10,2) NOT NULL,
    "bribeAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalValue" DECIMAL(10,2) NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "evaluationReason" TEXT NOT NULL,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_conversationId_key" ON "Conversation"("conversationId");

-- CreateIndex
CREATE INDEX "Conversation_conversationId_idx" ON "Conversation"("conversationId");

-- CreateIndex
CREATE INDEX "Conversation_lastMessageAt_idx" ON "Conversation"("lastMessageAt");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_phoneNumber_key" ON "User"("phoneNumber");

-- CreateIndex
CREATE INDEX "User_phoneNumber_idx" ON "User"("phoneNumber");

-- CreateIndex
CREATE INDEX "QueuedMessage_status_createdAt_idx" ON "QueuedMessage"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PrioritizationConfig_conversationId_key" ON "PrioritizationConfig"("conversationId");

-- CreateIndex
CREATE INDEX "PrioritizationConfig_conversationId_idx" ON "PrioritizationConfig"("conversationId");

-- CreateIndex
CREATE INDEX "MessageEvaluation_queuedMessageId_idx" ON "MessageEvaluation"("queuedMessageId");

-- CreateIndex
CREATE INDEX "MessageEvaluation_conversationId_evaluatedAt_idx" ON "MessageEvaluation"("conversationId", "evaluatedAt");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageEvaluation" ADD CONSTRAINT "MessageEvaluation_queuedMessageId_fkey" FOREIGN KEY ("queuedMessageId") REFERENCES "QueuedMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
