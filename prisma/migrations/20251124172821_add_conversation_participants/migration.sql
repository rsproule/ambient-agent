-- AlterTable: Add groupName and participants to Conversation
ALTER TABLE "Conversation" ADD COLUMN "groupName" TEXT;
ALTER TABLE "Conversation" ADD COLUMN "participants" TEXT[] DEFAULT ARRAY[]::TEXT[];

