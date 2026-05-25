-- CreateEnum
CREATE TYPE "OrganizationAccountType" AS ENUM ('INDIVIDUAL', 'COMPANY');

-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrganizationInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "accountType" "OrganizationAccountType" NOT NULL DEFAULT 'INDIVIDUAL',
ADD COLUMN     "activatedAt" TIMESTAMP(3),
ADD COLUMN     "billingEmail" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "locale" TEXT NOT NULL DEFAULT 'en',
ADD COLUMN     "status" "OrganizationStatus" NOT NULL DEFAULT 'TRIAL',
ADD COLUMN     "statusReason" TEXT,
ADD COLUMN     "supportEmail" TEXT,
ADD COLUMN     "suspendedAt" TIMESTAMP(3),
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'UTC',
ADD COLUMN     "trialEndsAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "OrganizationInvitation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "status" "OrganizationInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "tokenHash" TEXT NOT NULL,
    "invitedByUserId" TEXT,
    "acceptedByUserId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationInvitation_tokenHash_key" ON "OrganizationInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "OrganizationInvitation_organizationId_idx" ON "OrganizationInvitation"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationInvitation_organizationId_status_idx" ON "OrganizationInvitation"("organizationId", "status");

-- CreateIndex
CREATE INDEX "OrganizationInvitation_organizationId_email_idx" ON "OrganizationInvitation"("organizationId", "email");

-- CreateIndex
CREATE INDEX "OrganizationInvitation_email_idx" ON "OrganizationInvitation"("email");

-- CreateIndex
CREATE INDEX "OrganizationInvitation_expiresAt_idx" ON "OrganizationInvitation"("expiresAt");

-- CreateIndex
CREATE INDEX "OrganizationInvitation_invitedByUserId_idx" ON "OrganizationInvitation"("invitedByUserId");

-- CreateIndex
CREATE INDEX "OrganizationInvitation_acceptedByUserId_idx" ON "OrganizationInvitation"("acceptedByUserId");

-- AddForeignKey
ALTER TABLE "OrganizationInvitation" ADD CONSTRAINT "OrganizationInvitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationInvitation" ADD CONSTRAINT "OrganizationInvitation_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationInvitation" ADD CONSTRAINT "OrganizationInvitation_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
