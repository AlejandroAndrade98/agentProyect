export type ImportanceLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type Source = 'MANUAL' | 'IMPORT' | 'AI' | 'INTEGRATION';

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