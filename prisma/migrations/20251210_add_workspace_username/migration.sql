-- AlterTable
ALTER TABLE "User" ADD COLUMN "workspaceUsername" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_workspaceUsername_key" ON "User"("workspaceUsername");
