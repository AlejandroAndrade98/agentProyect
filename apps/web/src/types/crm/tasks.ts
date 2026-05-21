import type { CurrentUser } from '../user';
import type { ImportanceLevel, SortOrder } from './common';
import type { Contact } from './contacts';
import type { Lead, Priority } from './leads';

export type TaskStatus =
  | 'TODO'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'ARCHIVED';

export type Task = {
  id: string;
  organizationId: string;
  title: string;
  description: string | null;
  leadId: string | null;
  contactId: string | null;
  assignedToUserId: string | null;
  status: TaskStatus;
  priority: Priority;
  importanceLevel: ImportanceLevel;
  dueDate: string | null;
  completedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lead?: Lead | null;
  contact?: Contact | null;
  user?: CurrentUser | null;
};

export type TaskDetail = Task & {
  lead?: Lead | null;
  contact?: Contact | null;
  user?: CurrentUser | null;
};

export type CreateTaskInput = {
  title: string;
  description?: string;
  leadId?: string;
  contactId?: string;
  assignedToUserId?: string;
  status?: TaskStatus;
  priority?: Priority;
  importanceLevel?: ImportanceLevel;
  dueDate?: string;
};

export type UpdateTaskInput = Partial<CreateTaskInput>;

export type QueryTasksParams = Record<
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
    | 'dueDate'
    | 'completedAt'
    | 'createdAt'
    | 'updatedAt';
  sortOrder?: SortOrder;
  status?: TaskStatus;
  priority?: Priority;
  importanceLevel?: ImportanceLevel;
  leadId?: string;
  contactId?: string;
  assignedToUserId?: string;
};

export type TaskIncludeQuery = Record<
  string,
  string | number | boolean | undefined
> & {
  include?:
    | 'lead'
    | 'contact'
    | 'assignedUser'
    | 'lead,contact,assignedUser';
};