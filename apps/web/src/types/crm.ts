import type { CurrentUser } from './user';

export type ImportanceLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type Source =
  | 'MANUAL'
  | 'AI_SUGGESTION'
  | 'IMPORT'
  | 'EMAIL'
  | 'MEETING'
  | 'OTHER';

export type SortOrder = 'asc' | 'desc';

export type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type PaginatedResponse<T> = {
  data: T[];
  meta: PaginationMeta;
};

export type Company = {
  id: string;
  organizationId: string;
  name: string;
  website: string | null;
  industry: string | null;
  city: string | null;
  country: string | null;
  notes: string | null;
  importanceLevel: ImportanceLevel;
  source: Source;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CompanyContactPreview = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
};

export type CompanyLeadPreview = {
  id: string;
  title: string;
  status: string;
  priority: ImportanceLevel;
  estimatedBudget: number | null;
  createdAt: string;
};

export type CompanyNotePreview = {
  id: string;
  title: string | null;
  content: string;
  createdAt: string;
};

export type CompanyDetail = Company & {
  contacts?: CompanyContactPreview[];
  leads?: CompanyLeadPreview[];
  linkedNotes?: CompanyNotePreview[];
};

export type CreateCompanyInput = {
  name: string;
  website?: string;
  industry?: string;
  city?: string;
  country?: string;
  notes?: string;
  importanceLevel?: ImportanceLevel;
  source?: Source;
};

export type UpdateCompanyInput = Partial<CreateCompanyInput>;

export type QueryCompaniesParams = Record<
  string,
  string | number | boolean | undefined
> & {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?:
    | 'name'
    | 'industry'
    | 'city'
    | 'country'
    | 'importanceLevel'
    | 'source'
    | 'createdAt'
    | 'updatedAt';
  sortOrder?: SortOrder;
  importanceLevel?: ImportanceLevel;
  source?: Source;
  city?: string;
  country?: string;
  industry?: string;
};

export type CompanyIncludeQuery = Record<
  string,
  string | number | boolean | undefined
> & {
  include?: 'contacts' | 'leads' | 'notes' | 'contacts,leads,notes';
};

export type Contact = {
  id: string;
  organizationId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  companyId: string | null;
  jobTitle: string | null;
  linkedinUrl: string | null;
  city: string | null;
  country: string | null;
  notes: string | null;
  expertise: string | null;
  importanceLevel: ImportanceLevel;
  source: Source;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  company?: Company | null;
};

export type ContactLeadPreview = {
  id: string;
  title: string;
  status: string;
  priority: ImportanceLevel;
  estimatedBudget: number | null;
  createdAt: string;
};

export type ContactTaskPreview = {
  id: string;
  title: string;
  status: string;
  priority: ImportanceLevel;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
};

export type ContactNotePreview = {
  id: string;
  title: string | null;
  content: string;
  createdAt: string;
};

export type ContactDetail = Contact & {
  company?: Company | null;
  leads?: ContactLeadPreview[];
  tasks?: ContactTaskPreview[];
  linkedNotes?: ContactNotePreview[];
};

export type CreateContactInput = {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  companyId?: string;
  jobTitle?: string;
  linkedinUrl?: string;
  city?: string;
  country?: string;
  notes?: string;
  expertise?: string;
  importanceLevel?: ImportanceLevel;
  source?: Source;
};

export type UpdateContactInput = Partial<CreateContactInput>;

export type QueryContactsParams = Record<
  string,
  string | number | boolean | undefined
> & {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?:
    | 'firstName'
    | 'lastName'
    | 'email'
    | 'jobTitle'
    | 'city'
    | 'country'
    | 'importanceLevel'
    | 'source'
    | 'createdAt'
    | 'updatedAt';
  sortOrder?: SortOrder;
  companyId?: string;
  importanceLevel?: ImportanceLevel;
  source?: Source;
  city?: string;
  country?: string;
};

export type ContactIncludeQuery = Record<
  string,
  string | number | boolean | undefined
> & {
  include?:
    | 'company'
    | 'leads'
    | 'tasks'
    | 'notes'
    | 'company,leads,tasks,notes';
};

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
  nextStep: string | null;
  lastContactAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LeadTaskPreview = {
  id: string;
  title: string;
  description: string | null;
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
  nextStep?: string;
  lastContactAt?: string;
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
  archivedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
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

export type Product = {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  category: string | null;
  isActive: boolean;
  archivedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateProductInput = {
  name: string;
  description?: string;
  category?: string;
  isActive?: boolean;
};

export type UpdateProductInput = Partial<CreateProductInput>;

export type QueryProductsParams = Record<
  string,
  string | number | boolean | undefined
> & {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: 'name' | 'category' | 'isActive' | 'createdAt' | 'updatedAt';
  sortOrder?: SortOrder;
  category?: string;
  isActive?: boolean;
};

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
  archivedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
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
  sortBy?: 'title' | 'importanceLevel' | 'source' | 'createdAt' | 'updatedAt';
  sortOrder?: SortOrder;
  importanceLevel?: ImportanceLevel;
  source?: Source;
  companyId?: string;
  contactId?: string;
  leadId?: string;
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