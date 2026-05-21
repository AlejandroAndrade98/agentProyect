import type { CurrentUser } from '../user';
import type { ImportanceLevel, Source, SortOrder } from './common';
import type { Company } from './companies';
import type { Contact } from './contacts';
import type { Lead } from './leads';

export type Note = {
  id: string;
  organizationId: string;
  title: string | null;
  content: string;
  companyId: string | null;
  contactId: string | null;
  leadId: string | null;
  createdByUserId: string;
  importanceLevel: ImportanceLevel;
  source: Source;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  company?: Company | null;
  contact?: Contact | null;
  lead?: Lead | null;
  createdBy?: CurrentUser | null;
};

export type NoteDetail = Note & {
  company?: Company | null;
  contact?: Contact | null;
  lead?: Lead | null;
  createdBy?: CurrentUser | null;
};

export type CreateNoteInput = {
  title?: string;
  content: string;
  companyId?: string;
  contactId?: string;
  leadId?: string;
  importanceLevel?: ImportanceLevel;
  source?: Source;
};

export type UpdateNoteInput = Partial<CreateNoteInput>;

export type QueryNotesParams = Record<
  string,
  string | number | boolean | undefined
> & {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?:
    | 'title'
    | 'importanceLevel'
    | 'source'
    | 'createdAt'
    | 'updatedAt';
  sortOrder?: SortOrder;
  importanceLevel?: ImportanceLevel;
  source?: Source;
  companyId?: string;
  contactId?: string;
  leadId?: string;
  createdByUserId?: string;
};

export type NoteIncludeQuery = Record<
  string,
  string | number | boolean | undefined
> & {
  include?:
    | 'company'
    | 'contact'
    | 'lead'
    | 'createdBy'
    | 'company,contact,lead,createdBy';
};