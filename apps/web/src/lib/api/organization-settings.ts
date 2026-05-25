import type {
  CurrentOrganizationResponse,
  PaginatedOrganizationUsers,
  QueryOrganizationUsersParams,
  UpdateCurrentOrganizationInput,
} from '@/types/organization-settings';

import { apiRequest } from './core';

export function getCurrentOrganization(token: string) {
  return apiRequest<CurrentOrganizationResponse>('/organization/current', {
    token,
  });
}

export function updateCurrentOrganization(
  token: string,
  input: UpdateCurrentOrganizationInput,
) {
  return apiRequest<CurrentOrganizationResponse>('/organization/current', {
    method: 'PATCH',
    token,
    body: input,
  });
}

export function getOrganizationUsers(
  token: string,
  params: QueryOrganizationUsersParams = {},
) {
  return apiRequest<PaginatedOrganizationUsers>('/organization/users', {
    token,
    query: params,
  });
}