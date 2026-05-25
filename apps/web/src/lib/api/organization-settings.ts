import type {
  CreateOrganizationInvitationInput,
  CreateOrganizationInvitationResponse,
  CurrentOrganizationResponse,
  PaginatedOrganizationInvitations,
  PaginatedOrganizationUsers,
  QueryOrganizationInvitationsParams,
  QueryOrganizationUsersParams,
  UpdateCurrentOrganizationInput,
  OrganizationInvitation,
  AcceptOrganizationInvitationInput,
  AcceptOrganizationInvitationResponse,
  OrganizationInvitationPreview,
  OrganizationUser,
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

export function getOrganizationInvitations(
  token: string,
  params: QueryOrganizationInvitationsParams = {},
) {
  return apiRequest<PaginatedOrganizationInvitations>(
    '/organization/invitations',
    {
      token,
      query: params,
    },
  );
}

export function createOrganizationInvitation(
  token: string,
  input: CreateOrganizationInvitationInput,
) {
  return apiRequest<CreateOrganizationInvitationResponse>(
    '/organization/invitations',
    {
      method: 'POST',
      token,
      body: input,
    },
  );
}

export function revokeOrganizationInvitation(token: string, id: string) {
  return apiRequest<OrganizationInvitation>(
    `/organization/invitations/${id}/revoke`,
    {
      method: 'PATCH',
      token,
    },
  );
}

export function getOrganizationInvitationPreview(invitationToken: string) {
  return apiRequest<OrganizationInvitationPreview>(
    `/organization/invitations/accept/${invitationToken}`,
  );
}

export function acceptOrganizationInvitation(
  input: AcceptOrganizationInvitationInput,
) {
  return apiRequest<AcceptOrganizationInvitationResponse>(
    '/organization/invitations/accept',
    {
      method: 'POST',
      body: input,
    },
  );
}

export function deactivateOrganizationUser(token: string, userId: string) {
  return apiRequest<OrganizationUser>(
    `/organization/users/${userId}/deactivate`,
    {
      method: 'PATCH',
      token,
    },
  );
}

export function reactivateOrganizationUser(token: string, userId: string) {
  return apiRequest<OrganizationUser>(
    `/organization/users/${userId}/reactivate`,
    {
      method: 'PATCH',
      token,
    },
  );
}