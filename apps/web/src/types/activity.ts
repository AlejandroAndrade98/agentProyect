import type { Source } from '@/types/crm';
import type { CurrentUser } from '@/types/user';

export type ActivityEntityType = 'COMPANY' | 'CONTACT' | 'LEAD' | 'TASK' | 'NOTE';

export type ActivityEventType =
  | 'COMPANY_CREATED'
  | 'CONTACT_CREATED'
  | 'LEAD_CREATED'
  | 'TASK_CREATED'
  | 'NOTE_CREATED'
  | 'TASK_COMPLETED'
  | 'LEAD_STATUS_CHANGED'
  | 'LEAD_PRIORITY_CHANGED'
  | 'TASK_STATUS_CHANGED'
  | 'TASK_ASSIGNED';

export type ActivityEventActor = {
  id: string;
  email: string;
  name: string | null;
  role: CurrentUser['role'];
  organizationId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ActivityEvent = {
  id: string;
  organizationId: string;
  type: ActivityEventType;
  entityType: ActivityEntityType;
  entityId: string;
  title: string;
  description: string | null;
  source: Source | null;
  actorUserId: string | null;
  companyId: string | null;
  contactId: string | null;
  leadId: string | null;
  taskId: string | null;
  noteId: string | null;
  metadataJson: unknown | null;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;

  actor?: ActivityEventActor | null;
  actorUser?: ActivityEventActor | null;
};

export type ActivityEventsQuery = {
  page?: number;
  pageSize?: number;
  type?: ActivityEventType;
  entityType?: ActivityEntityType;
  entityId?: string;
  companyId?: string;
  contactId?: string;
  leadId?: string;
  taskId?: string;
  noteId?: string;
  sortOrder?: 'asc' | 'desc';
};