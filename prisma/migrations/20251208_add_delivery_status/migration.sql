-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('pending', 'sent', 'failed', 'timeout');

-- AlterTable
ALTER TABLE "Message" ADD COLUMN "deliveryStatus" "DeliveryStatus";
ALTER TABLE "Message" ADD COLUMN "deliveryError" TEXT;

-- CreateIndex
CREATE INDEX "Message_messageId_idx" ON "Message"("messageId");
