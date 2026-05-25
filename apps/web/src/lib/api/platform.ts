import type {
  PaginatedPlatformOrganizations,
  PlatformOrganizationDetail,
  QueryPlatformOrganizationsParams,
  UpdatePlatformOrganizationInput,
  UpdatePlatformOrganizationStatusInput,
} from '@/types/platform';

import { apiRequest } from './core';

export function getPlatformOrganizations(
  token: string,
  params: QueryPlatformOrganizationsParams = {},
) {
  return apiRequest<PaginatedPlatformOrganizations>('/platform/organizations', {
    token,
    query: params,
  });
}

export function getPlatformOrganization(token: string, id: string) {
  return apiRequest<PlatformOrganizationDetail>(
    `/platform/organizations/${id}`,
    {
      token,
    },
  );
}

export function updatePlatformOrganization(
  token: string,
  id: string,
  input: UpdatePlatformOrganizationInput,
) {
  return apiRequest<PlatformOrganizationDetail>(
    `/platform/organizations/${id}`,
    {
      method: 'PATCH',
      token,
      body: input,
    },
  );
}

export function updatePlatformOrganizationStatus(
  token: string,
  id: string,
  input: UpdatePlatformOrganizationStatusInput,
) {
  return apiRequest<PlatformOrganizationDetail>(
    `/platform/organizations/${id}/status`,
    {
      method: 'PATCH',
      token,
      body: input,
    },
  );
}