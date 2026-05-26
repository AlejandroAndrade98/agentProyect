-- CreateEnum
CREATE TYPE "ConnectedAccountProvider" AS ENUM ('GOOGLE', 'MICROSOFT');

-- CreateEnum
CREATE TYPE "ConnectedAccountStatus" AS ENUM ('PENDING', 'CONNECTED', 'DISCONNECT_REQUESTED', 'DISCONNECTED', 'REVOKED', 'ERROR');

-- CreateEnum
CREATE TYPE "ConnectedAccountCapability" AS ENUM ('EMAIL', 'CALENDAR');

-- CreateEnum
CREATE TYPE "ConnectedAccountSyncStatus" AS ENUM ('NOT_STARTED', 'INITIAL_SYNC_PENDING', 'INITIAL_SYNC_RUNNING', 'ACTIVE', 'PAUSED', 'ERROR');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityEventType" ADD VALUE 'CONNECTED_ACCOUNT_CONNECTED';
ALTER TYPE "ActivityEventType" ADD VALUE 'CONNECTED_ACCOUNT_DISCONNECT_REQUESTED';
ALTER TYPE "ActivityEventType" ADD VALUE 'CONNECTED_ACCOUNT_DISCONNECTED';
ALTER TYPE "ActivityEventType" ADD VALUE 'CONNECTED_ACCOUNT_REVOKED';
ALTER TYPE "ActivityEventType" ADD VALUE 'CONNECTED_ACCOUNT_ERROR';

-- AlterEnum
ALTER TYPE "EntityType" ADD VALUE 'CONNECTED_ACCOUNT';

-- CreateTable
CREATE TABLE "ConnectedAccount" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "ConnectedAccountProvider" NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "externalAccountId" TEXT,
    "status" "ConnectedAccountStatus" NOT NULL DEFAULT 'PENDING',
    "capabilities" "ConnectedAccountCapability"[],
    "scopesJson" JSONB,
    "encryptedAccessToken" TEXT,
    "encryptedRefreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "tokenEncryptionVersion" TEXT,
    "connectedAt" TIMESTAMP(3),
    "disconnectRequestedAt" TIMESTAMP(3),
    "disconnectedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConnectedAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectedAccountSyncState" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "connectedAccountId" TEXT NOT NULL,
    "capability" "ConnectedAccountCapability" NOT NULL,
    "status" "ConnectedAccountSyncStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "syncFrom" TIMESTAMP(3),
    "syncCursor" TEXT,
    "initialSyncCompletedAt" TIMESTAMP(3),
    "lastSyncAttemptAt" TIMESTAMP(3),
    "lastSuccessfulSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConnectedAccountSyncState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConnectedAccount_organizationId_idx" ON "ConnectedAccount"("organizationId");

-- CreateIndex
CREATE INDEX "ConnectedAccount_organizationId_userId_idx" ON "ConnectedAccount"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "ConnectedAccount_organizationId_provider_idx" ON "ConnectedAccount"("organizationId", "provider");

-- CreateIndex
CREATE INDEX "ConnectedAccount_organizationId_status_idx" ON "ConnectedAccount"("organizationId", "status");

-- CreateIndex
CREATE INDEX "ConnectedAccount_organizationId_email_idx" ON "ConnectedAccount"("organizationId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectedAccount_organizationId_userId_key" ON "ConnectedAccount"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "ConnectedAccountSyncState_organizationId_idx" ON "ConnectedAccountSyncState"("organizationId");

-- CreateIndex
CREATE INDEX "ConnectedAccountSyncState_organizationId_connectedAccountId_idx" ON "ConnectedAccountSyncState"("organizationId", "connectedAccountId");

-- CreateIndex
CREATE INDEX "ConnectedAccountSyncState_organizationId_capability_idx" ON "ConnectedAccountSyncState"("organizationId", "capability");

-- CreateIndex
CREATE INDEX "ConnectedAccountSyncState_organizationId_status_idx" ON "ConnectedAccountSyncState"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectedAccountSyncState_connectedAccountId_capability_key" ON "ConnectedAccountSyncState"("connectedAccountId", "capability");

-- AddForeignKey
ALTER TABLE "ConnectedAccount" ADD CONSTRAINT "ConnectedAccount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectedAccount" ADD CONSTRAINT "ConnectedAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectedAccountSyncState" ADD CONSTRAINT "ConnectedAccountSyncState_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectedAccountSyncState" ADD CONSTRAINT "ConnectedAccountSyncState_connectedAccountId_fkey" FOREIGN KEY ("connectedAccountId") REFERENCES "ConnectedAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
