import { apiRequest } from './core';
import type {
  ConnectedAccount,
  ConnectedAccountCapability,
  ConnectedAccountProvider,
  ConnectedAccountsQuery,
  ConnectedAccountsResponse,
  CreateDevConnectedAccountInput,
} from '@/types/connected-accounts';

export function getConnectedAccounts(
  token: string,
  query?: ConnectedAccountsQuery,
) {
  return apiRequest<ConnectedAccountsResponse>('/connected-accounts', {
    token,
    query,
  });
}

export function getConnectedAccount(token: string, id: string) {
  return apiRequest<ConnectedAccount>(`/connected-accounts/${id}`, {
    token,
  });
}

export function createDevConnectedAccount(
  token: string,
  input: CreateDevConnectedAccountInput,
) {
  return apiRequest<ConnectedAccount>('/connected-accounts/dev-connect', {
    method: 'POST',
    token,
    body: input,
  });
}

export function requestConnectedAccountDisconnect(
  token: string,
  id: string,
) {
  return apiRequest<ConnectedAccount>(
    `/connected-accounts/${id}/disconnect-request`,
    {
      method: 'PATCH',
      token,
    },
  );
}

export function disconnectConnectedAccount(token: string, id: string) {
  return apiRequest<ConnectedAccount>(
    `/connected-accounts/${id}/disconnect`,
    {
      method: 'PATCH',
      token,
    },
  );
}

export type StartGoogleOAuthInput = {
  capabilities?: ConnectedAccountCapability[];
};

export type StartGoogleOAuthResponse = {
  authorizationUrl: string;
  provider: ConnectedAccountProvider;
  capabilities: ConnectedAccountCapability[];
  expiresAt: string;
};

export async function startGoogleOAuth(
  token: string,
  input: StartGoogleOAuthInput = {},
): Promise<StartGoogleOAuthResponse> {
  const params = new URLSearchParams();

  if (input.capabilities && input.capabilities.length > 0) {
    params.set('capabilities', input.capabilities.join(','));
  }

  const query = params.toString();

  return apiRequest<StartGoogleOAuthResponse>(
    `/connected-accounts/oauth/google/start${query ? `?${query}` : ''}`,
    {
      token,
    },
  );
}