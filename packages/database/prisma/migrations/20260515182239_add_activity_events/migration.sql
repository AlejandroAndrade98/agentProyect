-- CreateEnum
CREATE TYPE "ActivityEventType" AS ENUM ('COMPANY_CREATED', 'CONTACT_CREATED', 'LEAD_CREATED', 'TASK_CREATED', 'TASK_COMPLETED', 'NOTE_CREATED');

-- CreateTable
CREATE TABLE "ActivityEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "ActivityEventType" NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "source" "Source" NOT NULL DEFAULT 'MANUAL',
    "actorUserId" TEXT,
    "companyId" TEXT,
    "contactId" TEXT,
    "leadId" TEXT,
    "taskId" TEXT,
    "noteId" TEXT,
    "metadataJson" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivityEvent_organizationId_idx" ON "ActivityEvent"("organizationId");

-- CreateIndex
CREATE INDEX "ActivityEvent_organizationId_occurredAt_idx" ON "ActivityEvent"("organizationId", "occurredAt");

-- CreateIndex
CREATE INDEX "ActivityEvent_organizationId_type_idx" ON "ActivityEvent"("organizationId", "type");

-- CreateIndex
CREATE INDEX "ActivityEvent_organizationId_entityType_entityId_idx" ON "ActivityEvent"("organizationId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "ActivityEvent_organizationId_companyId_idx" ON "ActivityEvent"("organizationId", "companyId");

-- CreateIndex
CREATE INDEX "ActivityEvent_organizationId_contactId_idx" ON "ActivityEvent"("organizationId", "contactId");

-- CreateIndex
CREATE INDEX "ActivityEvent_organizationId_leadId_idx" ON "ActivityEvent"("organizationId", "leadId");

-- CreateIndex
CREATE INDEX "ActivityEvent_organizationId_taskId_idx" ON "ActivityEvent"("organizationId", "taskId");

-- CreateIndex
CREATE INDEX "ActivityEvent_organizationId_noteId_idx" ON "ActivityEvent"("organizationId", "noteId");

-- CreateIndex
CREATE INDEX "ActivityEvent_actorUserId_idx" ON "ActivityEvent"("actorUserId");

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
