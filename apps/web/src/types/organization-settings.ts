import type { PaginatedResponse } from './crm';
import type {
  OrganizationAccountType,
  OrganizationStatus,
  PlatformOrganizationCounts,
} from './platform';

export type OrganizationUserRole =
  | 'SUPER_ADMIN'
  | 'OWNER'
  | 'ADMIN'
  | 'SALES'
  | 'VIEWER';

export type CurrentOrganizationResponse = {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  plan: string;
  accountType: OrganizationAccountType;
  status: OrganizationStatus;
  statusReason: string | null;
  billingEmail: string | null;
  supportEmail: string | null;
  timezone: string;
  locale: string;
  trialEndsAt: string | null;
  activatedAt: string | null;
  suspendedAt: string | null;
  cancelledAt: string | null;
  maxUsers: number;
  maxActiveLeads: number;
  aiEnabled: boolean;
  aiMonthlyCreditsLimit: number;
  aiDefaultUserMonthlyCreditsLimit: number;
  aiCreditsBalance: number;
  aiCreditsUpdatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count: PlatformOrganizationCounts;
};

export type UpdateCurrentOrganizationInput = {
  name?: string;
  industry?: string;
  billingEmail?: string;
  supportEmail?: string;
  timezone?: string;
  locale?: string;
};

export type OrganizationUser = {
  id: string;
  email: string;
  name: string;
  role: OrganizationUserRole;
  isActive: boolean;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
};

export type QueryOrganizationUsersParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  role?: OrganizationUserRole;
  isActive?: string;
  sortBy?: 'createdAt' | 'email' | 'name' | 'role';
  sortOrder?: 'asc' | 'desc';
};

export type OrganizationInvitationStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'REVOKED'
  | 'EXPIRED';

export type OrganizationInvitationUser = {
  id: string;
  email: string;
  name: string;
  role: OrganizationUserRole;
};

export type OrganizationInvitation = {
  id: string;
  email: string;
  role: OrganizationUserRole;
  status: OrganizationInvitationStatus;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
  invitedBy: OrganizationInvitationUser | null;
  acceptedBy: OrganizationInvitationUser | null;
};

export type QueryOrganizationInvitationsParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: OrganizationInvitationStatus;
  role?: OrganizationUserRole;
  sortBy?: 'createdAt' | 'email' | 'role' | 'status' | 'expiresAt';
  sortOrder?: 'asc' | 'desc';
};

export type CreateOrganizationInvitationInput = {
  email: string;
  role: OrganizationUserRole;
};

export type CreateOrganizationInvitationResponse = {
  invitation: OrganizationInvitation;
  acceptanceToken: string;
};

export type PaginatedOrganizationInvitations =
  PaginatedResponse<OrganizationInvitation>;

export type PaginatedOrganizationUsers = PaginatedResponse<OrganizationUser>;

export type OrganizationInvitationPreview = {
  id: string;
  email: string;
  role: OrganizationUserRole;
  status: OrganizationInvitationStatus;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  organization: {
    id: string;
    name: string;
    slug: string;
    accountType: string;
    status: string;
  };
};

export type AcceptOrganizationInvitationInput = {
  token: string;
  name: string;
  password: string;
};

export type AcceptOrganizationInvitationResponse = {
  message: string;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  user: {
    id: string;
    email: string;
    name: string;
    role: OrganizationUserRole;
    isActive: boolean;
    organizationId: string;
    createdAt: string;
  };
  invitation: OrganizationInvitation;
};