-- Add senderLocks field to Conversation for per-sender response tracking in group chats
ALTER TABLE "Conversation" ADD COLUMN "senderLocks" JSONB;

-- Create GroupChatSettings table for per-group configuration
CREATE TABLE "GroupChatSettings" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "customPrompt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupChatSettings_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint on conversationId
CREATE UNIQUE INDEX "GroupChatSettings_conversationId_key" ON "GroupChatSettings"("conversationId");

-- Create index for conversationId lookups
CREATE INDEX "GroupChatSettings_conversationId_idx" ON "GroupChatSettings"("conversationId");
