/*
  Warnings:

  - You are about to drop the column `maxAiRequestsPerMonth` on the `Organization` table. All the data in the column will be lost.
  - You are about to drop the `UsageRecord` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "AiUsageFeature" AS ENUM ('LEAD_NEXT_STEPS');

-- CreateEnum
CREATE TYPE "AiUsageStatus" AS ENUM ('SUCCESS', 'FAILED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "AiCreditTransactionType" AS ENUM ('MANUAL_GRANT', 'MONTHLY_GRANT', 'USAGE_DEBIT', 'MANUAL_ADJUSTMENT', 'REFUND');

-- DropForeignKey
ALTER TABLE "UsageRecord" DROP CONSTRAINT "UsageRecord_organizationId_fkey";

-- AlterTable
ALTER TABLE "Organization" DROP COLUMN "maxAiRequestsPerMonth",
ADD COLUMN     "aiCreditsBalance" INTEGER NOT NULL DEFAULT 10000,
ADD COLUMN     "aiCreditsUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "aiDefaultUserMonthlyCreditsLimit" INTEGER NOT NULL DEFAULT 2000,
ADD COLUMN     "aiEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "aiMonthlyCreditsLimit" INTEGER NOT NULL DEFAULT 10000;

-- DropTable
DROP TABLE "UsageRecord";

-- CreateTable
CREATE TABLE "OrganizationUsageSummary" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "activeUsersCount" INTEGER NOT NULL DEFAULT 0,
    "activeLeadsCount" INTEGER NOT NULL DEFAULT 0,
    "storageUsedMb" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationUsageSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiUsageRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "aiSuggestionId" TEXT,
    "feature" "AiUsageFeature" NOT NULL,
    "status" "AiUsageStatus" NOT NULL DEFAULT 'SUCCESS',
    "provider" TEXT,
    "model" TEXT,
    "tokensInput" INTEGER NOT NULL DEFAULT 0,
    "tokensOutput" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "creditsUsed" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiCreditTransaction" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "usageRecordId" TEXT,
    "aiSuggestionId" TEXT,
    "type" "AiCreditTransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceAfter" INTEGER,
    "reason" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiCreditTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiUserUsageLimit" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "aiEnabled" BOOLEAN NOT NULL DEFAULT true,
    "monthlyCreditsLimit" INTEGER NOT NULL DEFAULT 2000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiUserUsageLimit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrganizationUsageSummary_organizationId_idx" ON "OrganizationUsageSummary"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationUsageSummary_organizationId_year_month_idx" ON "OrganizationUsageSummary"("organizationId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationUsageSummary_organizationId_month_year_key" ON "OrganizationUsageSummary"("organizationId", "month", "year");

-- CreateIndex
CREATE INDEX "AiUsageRecord_organizationId_idx" ON "AiUsageRecord"("organizationId");

-- CreateIndex
CREATE INDEX "AiUsageRecord_organizationId_createdAt_idx" ON "AiUsageRecord"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsageRecord_organizationId_feature_idx" ON "AiUsageRecord"("organizationId", "feature");

-- CreateIndex
CREATE INDEX "AiUsageRecord_organizationId_status_idx" ON "AiUsageRecord"("organizationId", "status");

-- CreateIndex
CREATE INDEX "AiUsageRecord_organizationId_userId_idx" ON "AiUsageRecord"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "AiUsageRecord_organizationId_aiSuggestionId_idx" ON "AiUsageRecord"("organizationId", "aiSuggestionId");

-- CreateIndex
CREATE INDEX "AiUsageRecord_userId_idx" ON "AiUsageRecord"("userId");

-- CreateIndex
CREATE INDEX "AiUsageRecord_aiSuggestionId_idx" ON "AiUsageRecord"("aiSuggestionId");

-- CreateIndex
CREATE INDEX "AiCreditTransaction_organizationId_idx" ON "AiCreditTransaction"("organizationId");

-- CreateIndex
CREATE INDEX "AiCreditTransaction_organizationId_createdAt_idx" ON "AiCreditTransaction"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AiCreditTransaction_organizationId_type_idx" ON "AiCreditTransaction"("organizationId", "type");

-- CreateIndex
CREATE INDEX "AiCreditTransaction_organizationId_actorUserId_idx" ON "AiCreditTransaction"("organizationId", "actorUserId");

-- CreateIndex
CREATE INDEX "AiCreditTransaction_organizationId_usageRecordId_idx" ON "AiCreditTransaction"("organizationId", "usageRecordId");

-- CreateIndex
CREATE INDEX "AiCreditTransaction_organizationId_aiSuggestionId_idx" ON "AiCreditTransaction"("organizationId", "aiSuggestionId");

-- CreateIndex
CREATE INDEX "AiCreditTransaction_actorUserId_idx" ON "AiCreditTransaction"("actorUserId");

-- CreateIndex
CREATE INDEX "AiCreditTransaction_usageRecordId_idx" ON "AiCreditTransaction"("usageRecordId");

-- CreateIndex
CREATE INDEX "AiCreditTransaction_aiSuggestionId_idx" ON "AiCreditTransaction"("aiSuggestionId");

-- CreateIndex
CREATE UNIQUE INDEX "AiUserUsageLimit_userId_key" ON "AiUserUsageLimit"("userId");

-- CreateIndex
CREATE INDEX "AiUserUsageLimit_organizationId_idx" ON "AiUserUsageLimit"("organizationId");

-- CreateIndex
CREATE INDEX "AiUserUsageLimit_organizationId_aiEnabled_idx" ON "AiUserUsageLimit"("organizationId", "aiEnabled");

-- CreateIndex
CREATE INDEX "AiUserUsageLimit_organizationId_userId_idx" ON "AiUserUsageLimit"("organizationId", "userId");

-- AddForeignKey
ALTER TABLE "OrganizationUsageSummary" ADD CONSTRAINT "OrganizationUsageSummary_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsageRecord" ADD CONSTRAINT "AiUsageRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsageRecord" ADD CONSTRAINT "AiUsageRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsageRecord" ADD CONSTRAINT "AiUsageRecord_aiSuggestionId_fkey" FOREIGN KEY ("aiSuggestionId") REFERENCES "AiSuggestion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiCreditTransaction" ADD CONSTRAINT "AiCreditTransaction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiCreditTransaction" ADD CONSTRAINT "AiCreditTransaction_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiCreditTransaction" ADD CONSTRAINT "AiCreditTransaction_usageRecordId_fkey" FOREIGN KEY ("usageRecordId") REFERENCES "AiUsageRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiCreditTransaction" ADD CONSTRAINT "AiCreditTransaction_aiSuggestionId_fkey" FOREIGN KEY ("aiSuggestionId") REFERENCES "AiSuggestion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUserUsageLimit" ADD CONSTRAINT "AiUserUsageLimit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUserUsageLimit" ADD CONSTRAINT "AiUserUsageLimit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
