-- CreateTable
CREATE TABLE "ExternalEmailMessage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "connectedAccountId" TEXT NOT NULL,
    "provider" "ConnectedAccountProvider" NOT NULL,
    "externalMessageId" TEXT NOT NULL,
    "externalThreadId" TEXT,
    "subject" TEXT,
    "snippet" TEXT,
    "fromEmail" TEXT,
    "fromName" TEXT,
    "toEmailsJson" JSONB,
    "ccEmailsJson" JSONB,
    "bccEmailsJson" JSONB,
    "labelIdsJson" JSONB,
    "internalDate" TIMESTAMP(3),
    "metadataJson" JSONB,
    "syncedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ExternalEmailMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalCalendarEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "connectedAccountId" TEXT NOT NULL,
    "provider" "ConnectedAccountProvider" NOT NULL,
    "externalCalendarId" TEXT NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "iCalUid" TEXT,
    "status" TEXT,
    "summary" TEXT,
    "description" TEXT,
    "location" TEXT,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "isAllDay" BOOLEAN NOT NULL DEFAULT false,
    "organizerEmail" TEXT,
    "organizerName" TEXT,
    "attendeesJson" JSONB,
    "htmlLink" TEXT,
    "metadataJson" JSONB,
    "syncedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ExternalCalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExternalEmailMessage_organizationId_idx" ON "ExternalEmailMessage"("organizationId");

-- CreateIndex
CREATE INDEX "ExternalEmailMessage_connectedAccountId_idx" ON "ExternalEmailMessage"("connectedAccountId");

-- CreateIndex
CREATE INDEX "ExternalEmailMessage_externalThreadId_idx" ON "ExternalEmailMessage"("externalThreadId");

-- CreateIndex
CREATE INDEX "ExternalEmailMessage_fromEmail_idx" ON "ExternalEmailMessage"("fromEmail");

-- CreateIndex
CREATE INDEX "ExternalEmailMessage_internalDate_idx" ON "ExternalEmailMessage"("internalDate");

-- CreateIndex
CREATE INDEX "ExternalEmailMessage_deletedAt_idx" ON "ExternalEmailMessage"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalEmailMessage_connectedAccountId_externalMessageId_key" ON "ExternalEmailMessage"("connectedAccountId", "externalMessageId");

-- CreateIndex
CREATE INDEX "ExternalCalendarEvent_organizationId_idx" ON "ExternalCalendarEvent"("organizationId");

-- CreateIndex
CREATE INDEX "ExternalCalendarEvent_connectedAccountId_idx" ON "ExternalCalendarEvent"("connectedAccountId");

-- CreateIndex
CREATE INDEX "ExternalCalendarEvent_externalCalendarId_idx" ON "ExternalCalendarEvent"("externalCalendarId");

-- CreateIndex
CREATE INDEX "ExternalCalendarEvent_iCalUid_idx" ON "ExternalCalendarEvent"("iCalUid");

-- CreateIndex
CREATE INDEX "ExternalCalendarEvent_startAt_idx" ON "ExternalCalendarEvent"("startAt");

-- CreateIndex
CREATE INDEX "ExternalCalendarEvent_endAt_idx" ON "ExternalCalendarEvent"("endAt");

-- CreateIndex
CREATE INDEX "ExternalCalendarEvent_deletedAt_idx" ON "ExternalCalendarEvent"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalCalendarEvent_connectedAccountId_externalCalendarId_key" ON "ExternalCalendarEvent"("connectedAccountId", "externalCalendarId", "externalEventId");

-- AddForeignKey
ALTER TABLE "ExternalEmailMessage" ADD CONSTRAINT "ExternalEmailMessage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalEmailMessage" ADD CONSTRAINT "ExternalEmailMessage_connectedAccountId_fkey" FOREIGN KEY ("connectedAccountId") REFERENCES "ConnectedAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalCalendarEvent" ADD CONSTRAINT "ExternalCalendarEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalCalendarEvent" ADD CONSTRAINT "ExternalCalendarEvent_connectedAccountId_fkey" FOREIGN KEY ("connectedAccountId") REFERENCES "ConnectedAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
