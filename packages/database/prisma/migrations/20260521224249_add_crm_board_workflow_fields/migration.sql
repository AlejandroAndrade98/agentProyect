-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "pipelinePosition" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "statusChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "boardPosition" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "statusChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "Lead_organizationId_status_pipelinePosition_idx" ON "Lead"("organizationId", "status", "pipelinePosition");

-- CreateIndex
CREATE INDEX "Lead_organizationId_statusChangedAt_idx" ON "Lead"("organizationId", "statusChangedAt");

-- CreateIndex
CREATE INDEX "Task_organizationId_status_boardPosition_idx" ON "Task"("organizationId", "status", "boardPosition");

-- CreateIndex
CREATE INDEX "Task_organizationId_statusChangedAt_idx" ON "Task"("organizationId", "statusChangedAt");
