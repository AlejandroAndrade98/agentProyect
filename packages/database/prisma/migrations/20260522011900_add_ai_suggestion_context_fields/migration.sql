-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityEventType" ADD VALUE 'AI_SUGGESTION_CREATED';
ALTER TYPE "ActivityEventType" ADD VALUE 'AI_SUGGESTION_ACCEPTED';
ALTER TYPE "ActivityEventType" ADD VALUE 'AI_SUGGESTION_REJECTED';

-- AlterTable
ALTER TABLE "AiSuggestion" ADD COLUMN     "companyId" TEXT,
ADD COLUMN     "confidenceScore" DOUBLE PRECISION,
ADD COLUMN     "contactId" TEXT,
ADD COLUMN     "entityId" TEXT,
ADD COLUMN     "entityType" "EntityType",
ADD COLUMN     "leadId" TEXT,
ADD COLUMN     "metadataJson" JSONB,
ADD COLUMN     "noteId" TEXT,
ADD COLUMN     "taskId" TEXT,
ADD COLUMN     "title" TEXT;

-- CreateIndex
CREATE INDEX "AiSuggestion_organizationId_entityType_entityId_idx" ON "AiSuggestion"("organizationId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "AiSuggestion_organizationId_leadId_idx" ON "AiSuggestion"("organizationId", "leadId");

-- CreateIndex
CREATE INDEX "AiSuggestion_organizationId_companyId_idx" ON "AiSuggestion"("organizationId", "companyId");

-- CreateIndex
CREATE INDEX "AiSuggestion_organizationId_contactId_idx" ON "AiSuggestion"("organizationId", "contactId");

-- CreateIndex
CREATE INDEX "AiSuggestion_organizationId_taskId_idx" ON "AiSuggestion"("organizationId", "taskId");

-- CreateIndex
CREATE INDEX "AiSuggestion_organizationId_noteId_idx" ON "AiSuggestion"("organizationId", "noteId");
