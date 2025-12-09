-- Rename currentMode to currentApp on Conversation
ALTER TABLE "Conversation" RENAME COLUMN "currentMode" TO "currentApp";

-- CreateTable: Event (append-only log)
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable: NegotiationApp
CREATE TABLE "NegotiationApp" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentQuote" DECIMAL(10,2),
    "researchNotes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'researching',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NegotiationApp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Event_conversationId_createdAt_idx" ON "Event"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Event_userId_createdAt_idx" ON "Event"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Event_type_createdAt_idx" ON "Event"("type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NegotiationApp_conversationId_key" ON "NegotiationApp"("conversationId");

-- CreateIndex
CREATE INDEX "NegotiationApp_conversationId_idx" ON "NegotiationApp"("conversationId");

-- CreateIndex
CREATE INDEX "NegotiationApp_userId_idx" ON "NegotiationApp"("userId");
