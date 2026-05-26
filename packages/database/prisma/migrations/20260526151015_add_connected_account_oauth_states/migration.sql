-- CreateEnum
CREATE TYPE "ConnectedAccountOAuthStateStatus" AS ENUM ('PENDING', 'USED', 'EXPIRED', 'CANCELLED', 'ERROR');

-- CreateTable
CREATE TABLE "ConnectedAccountOAuthState" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "ConnectedAccountProvider" NOT NULL,
    "capabilities" "ConnectedAccountCapability"[],
    "status" "ConnectedAccountOAuthStateStatus" NOT NULL DEFAULT 'PENDING',
    "stateHash" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "scopesJson" JSONB,
    "pkceCodeChallenge" TEXT,
    "encryptedPkceCodeVerifier" TEXT,
    "tokenEncryptionVersion" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConnectedAccountOAuthState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConnectedAccountOAuthState_stateHash_key" ON "ConnectedAccountOAuthState"("stateHash");

-- CreateIndex
CREATE INDEX "ConnectedAccountOAuthState_organizationId_idx" ON "ConnectedAccountOAuthState"("organizationId");

-- CreateIndex
CREATE INDEX "ConnectedAccountOAuthState_organizationId_userId_idx" ON "ConnectedAccountOAuthState"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "ConnectedAccountOAuthState_organizationId_provider_idx" ON "ConnectedAccountOAuthState"("organizationId", "provider");

-- CreateIndex
CREATE INDEX "ConnectedAccountOAuthState_organizationId_status_idx" ON "ConnectedAccountOAuthState"("organizationId", "status");

-- CreateIndex
CREATE INDEX "ConnectedAccountOAuthState_organizationId_expiresAt_idx" ON "ConnectedAccountOAuthState"("organizationId", "expiresAt");

-- CreateIndex
CREATE INDEX "ConnectedAccountOAuthState_userId_idx" ON "ConnectedAccountOAuthState"("userId");

-- AddForeignKey
ALTER TABLE "ConnectedAccountOAuthState" ADD CONSTRAINT "ConnectedAccountOAuthState_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectedAccountOAuthState" ADD CONSTRAINT "ConnectedAccountOAuthState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
