-- Migration: Update hook tracking from individual columns to JSON-based approach
-- This provides per-hook scheduling instead of a global cooldown

-- Add new JSON columns for per-hook tracking
ALTER TABLE "UserContext" ADD COLUMN IF NOT EXISTS "hookLastRunTimes" JSONB;
ALTER TABLE "UserContext" ADD COLUMN IF NOT EXISTS "hookCooldowns" JSONB;

-- Remove old columns (if they exist from previous migration)
ALTER TABLE "UserContext" DROP COLUMN IF EXISTS "lastProactiveMessageAt";
ALTER TABLE "UserContext" DROP COLUMN IF EXISTS "proactiveCooldownMinutes";
ALTER TABLE "UserContext" DROP COLUMN IF EXISTS "lastConnectionReminderAt";

