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

export type PaginatedOrganizationUsers = PaginatedResponse<OrganizationUser>;