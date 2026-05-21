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