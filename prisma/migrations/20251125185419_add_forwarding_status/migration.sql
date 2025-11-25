-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "forwarded" BOOLEAN,
ADD COLUMN     "rejectionReason" TEXT;
