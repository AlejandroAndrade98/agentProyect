-- AlterTable
ALTER TABLE "ExternalEmailMessage"
ADD COLUMN "dismissedAt" TIMESTAMP(3),
ADD COLUMN "dismissedByUserId" TEXT,
ADD COLUMN "dismissedReason" TEXT;

-- CreateIndex
CREATE INDEX "ExternalEmailMessage_dismissedAt_idx" ON "ExternalEmailMessage"("dismissedAt");
