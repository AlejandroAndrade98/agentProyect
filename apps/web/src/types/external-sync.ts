import type {
  ConnectedAccountProvider,
  ConnectedAccountStatus,
} from './connected-accounts';

export type ExternalEmailMessageConnectedAccount = {
  id: string;
  provider: ConnectedAccountProvider;
  email: string;
  displayName: string | null;
  status: ConnectedAccountStatus;
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
    isActive: boolean;
  } | null;
};

export type ExternalEmailMessage = {
  id: string;
  organizationId?: string;
  connectedAccountId: string;
  provider: ConnectedAccountProvider;
  externalMessageId: string;
  externalThreadId: string | null;
  subject: string | null;
  snippet: string | null;
  fromEmail: string | null;
  fromName: string | null;
  toEmailsJson?: unknown;
  ccEmailsJson?: unknown;
  bccEmailsJson?: unknown;
  labelIdsJson: unknown;
  metadataJson?: unknown;
  internalDate: string | null;
  syncedAt: string;
  createdAt?: string;
  updatedAt?: string;
  connectedAccount?: ExternalEmailMessageConnectedAccount | null;
};

export type QueryExternalEmailMessagesParams = {
  page?: number;
  pageSize?: number;
  q?: string;
  connectedAccountId?: string;
  fromEmail?: string;
  externalThreadId?: string;
  internalDateFrom?: string;
  internalDateTo?: string;
};

export type ExternalSyncPaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  pageCount?: number;
  totalPages?: number;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
};

export type PaginatedExternalEmailMessages = {
  data: ExternalEmailMessage[];
  meta: ExternalSyncPaginationMeta;
};

export type SyncExternalEmailMessagesResult = {
  messagesDeletedAsStale?: number;
  connectedAccountId: string;
  provider: ConnectedAccountProvider;
  email: string;
  syncedAt: string;
  bodyStored: boolean;
  aiAnalysisRun: boolean;
  crmRecordsCreated: boolean;
  messagesFetched?: number;
  messagesStored?: number;
};
