import type {
  OnboardPlatformOrganizationInput,
  OnboardPlatformOrganizationResponse,
  PaginatedPlatformOrganizations,
  PlatformOrganizationDetail,
  QueryPlatformOrganizationsParams,
  UpdatePlatformOrganizationInput,
  UpdatePlatformOrganizationStatusInput,
  CreatePlatformOwnerInvitationInput,
  CreatePlatformOwnerInvitationResponse,
  RevokePlatformOwnerInvitationResponse
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

export function onboardPlatformOrganization(
  token: string,
  input: OnboardPlatformOrganizationInput,
) {
  return apiRequest<OnboardPlatformOrganizationResponse>(
    '/platform/organizations/onboard',
    {
      method: 'POST',
      token,
      body: input,
    },
  );
}

export function createPlatformOwnerInvitation(
  token: string,
  organizationId: string,
  input: CreatePlatformOwnerInvitationInput,
) {
  return apiRequest<CreatePlatformOwnerInvitationResponse>(
    `/platform/organizations/${organizationId}/owner-invitation`,
    {
      method: 'POST',
      token,
      body: input,
    },
  );
}

export function revokePlatformOwnerInvitation(
  token: string,
  organizationId: string,
  invitationId: string,
) {
  return apiRequest<RevokePlatformOwnerInvitationResponse>(
    `/platform/organizations/${organizationId}/owner-invitation/${invitationId}/revoke`,
    {
      method: 'PATCH',
      token,
    },
  );
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