-- Add lockAcquiredAt field for lock timeout detection
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "lockAcquiredAt" TIMESTAMP(3);

