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