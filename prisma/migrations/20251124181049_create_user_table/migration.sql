-- AlterTable: Update existing User table to match new schema
-- Drop old constraints and indexes if they exist
DROP INDEX IF EXISTS "User_userId_idx";
DROP INDEX IF EXISTS "User_userId_key";

-- Remove userId column if it exists
ALTER TABLE "User" DROP COLUMN IF EXISTS "userId";

-- Make phoneNumber nullable if it isn't already
ALTER TABLE "User" ALTER COLUMN "phoneNumber" DROP NOT NULL;

-- Add email column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='User' AND column_name='email') THEN
        ALTER TABLE "User" ADD COLUMN "email" TEXT;
    END IF;
END $$;

-- Ensure indexes exist
CREATE UNIQUE INDEX IF NOT EXISTS "User_phoneNumber_key" ON "User"("phoneNumber");
CREATE INDEX IF NOT EXISTS "User_phoneNumber_idx" ON "User"("phoneNumber");

