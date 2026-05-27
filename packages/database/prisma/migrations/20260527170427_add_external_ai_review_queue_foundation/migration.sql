-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AiSuggestionType" ADD VALUE 'ANALYZE_EXTERNAL_EMAIL';
ALTER TYPE "AiSuggestionType" ADD VALUE 'ANALYZE_EXTERNAL_CALENDAR_EVENT';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AiUsageFeature" ADD VALUE 'EXTERNAL_EMAIL_ANALYSIS';
ALTER TYPE "AiUsageFeature" ADD VALUE 'EXTERNAL_CALENDAR_ANALYSIS';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EntityType" ADD VALUE 'EXTERNAL_EMAIL_MESSAGE';
ALTER TYPE "EntityType" ADD VALUE 'EXTERNAL_CALENDAR_EVENT';

-- AlterTable
ALTER TABLE "AiSuggestion" ADD COLUMN     "externalCalendarEventId" TEXT,
ADD COLUMN     "externalEmailMessageId" TEXT;

-- CreateIndex
CREATE INDEX "AiSuggestion_organizationId_externalEmailMessageId_idx" ON "AiSuggestion"("organizationId", "externalEmailMessageId");

-- CreateIndex
CREATE INDEX "AiSuggestion_organizationId_externalCalendarEventId_idx" ON "AiSuggestion"("organizationId", "externalCalendarEventId");

-- AddForeignKey
ALTER TABLE "AiSuggestion" ADD CONSTRAINT "AiSuggestion_externalEmailMessageId_fkey" FOREIGN KEY ("externalEmailMessageId") REFERENCES "ExternalEmailMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiSuggestion" ADD CONSTRAINT "AiSuggestion_externalCalendarEventId_fkey" FOREIGN KEY ("externalCalendarEventId") REFERENCES "ExternalCalendarEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
