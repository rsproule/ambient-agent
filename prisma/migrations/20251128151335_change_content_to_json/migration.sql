/*
  Warnings:

  - Changed the type of `content` on the `Message` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/

-- Step 1: Add a temporary JSONB column
ALTER TABLE "Message" ADD COLUMN "content_new" JSONB;

-- Step 2: Convert existing TEXT content to JSONB (wrap strings in JSON quotes)
-- This converts text to a JSON string value
UPDATE "Message" SET "content_new" = to_jsonb("content");

-- Step 3: Make the new column NOT NULL (safe now that data is copied)
ALTER TABLE "Message" ALTER COLUMN "content_new" SET NOT NULL;

-- Step 4: Drop the old TEXT column
ALTER TABLE "Message" DROP COLUMN "content";

-- Step 5: Rename the new column to "content"
ALTER TABLE "Message" RENAME COLUMN "content_new" TO "content";
