import type { CurrentUser } from '../user';
import type { ImportanceLevel, Source, SortOrder } from './common';
import type { Company } from './companies';
import type { Contact } from './contacts';

export type LeadStatus =
  | 'NEW'
  | 'CONTACTED'
  | 'MEETING_SCHEDULED'
  | 'PROPOSAL_SENT'
  | 'NEGOTIATION'
  | 'WON'
  | 'LOST'
  | 'ARCHIVED';

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type Lead = {
  id: string;
  organizationId: string;
  title: string;
  description: string | null;
  companyId: string | null;
  contactId: string | null;
  assignedToUserId: string | null;
  status: LeadStatus;
  priority: Priority;
  importanceLevel: ImportanceLevel;
  source: Source;
  estimatedBudget: number | null;
  expectedCloseDate: string | null;
  lastContactAt: string | null;
  nextStep: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  company?: Company | null;
  contact?: Contact | null;
  user?: CurrentUser | null;
};

export type LeadTaskPreview = {
  id: string;
  title: string;
  status: string;
  priority: Priority;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
};

export type LeadNotePreview = {
  id: string;
  title: string | null;
  content: string;
  createdAt: string;
};

export type LeadDetail = Lead & {
  company?: Company | null;
  contact?: Contact | null;
  user?: CurrentUser | null;
  tasks?: LeadTaskPreview[];
  linkedNotes?: LeadNotePreview[];
};

export type CreateLeadInput = {
  title: string;
  description?: string;
  companyId?: string;
  contactId?: string;
  assignedToUserId?: string;
  status?: LeadStatus;
  priority?: Priority;
  importanceLevel?: ImportanceLevel;
  source?: Source;
  estimatedBudget?: number;
  expectedCloseDate?: string;
  lastContactAt?: string;
  nextStep?: string;
};

export type UpdateLeadInput = Partial<CreateLeadInput>;

export type QueryLeadsParams = Record<
  string,
  string | number | boolean | undefined
> & {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?:
    | 'title'
    | 'status'
    | 'priority'
    | 'importanceLevel'
    | 'source'
    | 'estimatedBudget'
    | 'expectedCloseDate'
    | 'lastContactAt'
    | 'createdAt'
    | 'updatedAt';
  sortOrder?: SortOrder;
  status?: LeadStatus;
  priority?: Priority;
  importanceLevel?: ImportanceLevel;
  source?: Source;
  companyId?: string;
  contactId?: string;
  assignedToUserId?: string;
};

export type LeadIncludeQuery = Record<
  string,
  string | number | boolean | undefined
> & {
  include?:
    | 'company'
    | 'contact'
    | 'assignedUser'
    | 'tasks'
    | 'notes'
    | 'company,contact,assignedUser,tasks,notes';
};