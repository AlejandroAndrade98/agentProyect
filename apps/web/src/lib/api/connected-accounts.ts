import { apiRequest } from './core';
import type {
  ConnectedAccount,
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