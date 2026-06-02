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
  dismissedAt?: string | null;
  dismissedByUserId?: string | null;
  dismissedReason?: string | null;
  connectedAccount?: ExternalEmailMessageConnectedAccount | null;
};

export type ExternalCalendarEventConnectedAccount =
  ExternalEmailMessageConnectedAccount;

export type ExternalCalendarEvent = {
  id: string;
  organizationId?: string;
  connectedAccountId: string;
  provider: ConnectedAccountProvider;
  externalCalendarId: string;
  externalEventId: string;
  iCalUid: string | null;
  status: string | null;
  summary: string | null;
  description: string | null;
  location: string | null;
  startAt: string | null;
  endAt: string | null;
  isAllDay: boolean;
  organizerEmail: string | null;
  organizerName: string | null;
  attendeesJson: unknown;
  htmlLink: string | null;
  metadataJson?: unknown;
  syncedAt: string;
  createdAt?: string;
  updatedAt?: string;
  connectedAccount?: ExternalCalendarEventConnectedAccount | null;
};

export type QueryExternalEmailMessagesParams = {
  page?: number;
  pageSize?: number;
  view?: 'active' | 'dismissed';
  q?: string;
  connectedAccountId?: string;
  fromEmail?: string;
  externalThreadId?: string;
  internalDateFrom?: string;
  internalDateTo?: string;
};

export type QueryExternalCalendarEventsParams = {
  page?: number;
  pageSize?: number;
  q?: string;
  connectedAccountId?: string;
  externalCalendarId?: string;
  startFrom?: string;
  startTo?: string;
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

export type PaginatedExternalCalendarEvents = {
  data: ExternalCalendarEvent[];
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

export type GmailSearchPreviewInput = {
  searchText?: string;
  sender?: string;
  dateFrom?: string;
  dateTo?: string;
  maxResults?: number;
};

export type GmailSearchPreviewMessage = {
  providerMessageId: string;
  threadId: string | null;
  subject: string | null;
  senderEmail: string | null;
  senderName: string | null;
  snippet: string | null;
  internalDate: string | null;
  alreadyImported: boolean;
  dismissed: boolean;
};

export type GmailSearchPreviewResult = {
  messages: GmailSearchPreviewMessage[];
  meta: {
    maxResults: number;
    resultSizeEstimate: number | null;
    bodyStored: boolean;
    aiAnalysisRun: boolean;
    crmRecordsCreated: boolean;
  };
};

export type ImportSelectedExternalEmailMessagesInput = {
  providerMessageIds: string[];
};

export type ImportSelectedExternalEmailMessagesResult = {
  connectedAccountId: string;
  provider: ConnectedAccountProvider;
  email: string;
  requested: number;
  imported: number;
  alreadyExisting: number;
  restored: number;
  skipped: number;
  syncedAt: string;
  bodyStored: boolean;
  aiAnalysisRun: boolean;
  crmRecordsCreated: boolean;
};

export type SyncExternalCalendarEventsResult = {
  eventsDeletedAsStale?: number;
  connectedAccountId: string;
  provider: ConnectedAccountProvider;
  email: string;
  syncedAt: string;
  bodyStored: boolean;
  aiAnalysisRun: boolean;
  crmRecordsCreated: boolean;
  eventsFetched?: number;
  eventsStored?: number;
};
