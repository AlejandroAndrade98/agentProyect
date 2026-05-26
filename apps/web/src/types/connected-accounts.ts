import type { UserRole } from './user';

export type ConnectedAccountProvider = 'GOOGLE' | 'MICROSOFT';

export type ConnectedAccountStatus =
  | 'PENDING'
  | 'CONNECTED'
  | 'DISCONNECT_REQUESTED'
  | 'DISCONNECTED'
  | 'REVOKED'
  | 'ERROR';

export type ConnectedAccountCapability = 'EMAIL' | 'CALENDAR';

export type ConnectedAccountSyncStatus =
  | 'NOT_STARTED'
  | 'INITIAL_SYNC_PENDING'
  | 'INITIAL_SYNC_RUNNING'
  | 'ACTIVE'
  | 'PAUSED'
  | 'ERROR';

export type ConnectedAccountUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
};

export type ConnectedAccountSyncState = {
  id: string;
  capability: ConnectedAccountCapability;
  status: ConnectedAccountSyncStatus;
  syncFrom: string | null;
  initialSyncCompletedAt: string | null;
  lastSyncAttemptAt: string | null;
  lastSuccessfulSyncAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ConnectedAccount = {
  id: string;
  organizationId: string;
  userId: string;
  user: ConnectedAccountUser;
  provider: ConnectedAccountProvider;
  email: string;
  displayName: string | null;
  externalAccountId: string | null;
  status: ConnectedAccountStatus;
  capabilities: ConnectedAccountCapability[];
  scopesJson: unknown;
  tokenExpiresAt: string | null;
  connectedAt: string | null;
  disconnectRequestedAt: string | null;
  disconnectedAt: string | null;
  revokedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  syncStates: ConnectedAccountSyncState[];
};

export type ConnectedAccountsQuery = {
  page?: number;
  pageSize?: number;
  provider?: ConnectedAccountProvider;
  status?: ConnectedAccountStatus;
  capability?: ConnectedAccountCapability;
  userId?: string;
  search?: string;
};

export type ConnectedAccountsResponse = {
  data: ConnectedAccount[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

export type CreateDevConnectedAccountInput = {
  provider: ConnectedAccountProvider;
  email: string;
  displayName?: string;
  externalAccountId?: string;
  capabilities?: ConnectedAccountCapability[];
};