import type { PaginatedResponse } from './crm';

export type OrganizationAccountType = 'INDIVIDUAL' | 'COMPANY';

export type OrganizationStatus =
  | 'TRIAL'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'CANCELLED';

export type PlatformOrganizationOwner = {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt?: string;
};

export type PlatformOrganizationCounts = {
  users: number;
  companies: number;
  contacts: number;
  leads: number;
  tasks: number;
  notes: number;
  products?: number;
  activityEvents?: number;
  aiSuggestions?: number;
  aiUsageRecords: number;
  aiCreditTransactions?: number;
  invitations: number;
};

export type PlatformOrganizationListItem = {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  plan: string;
  accountType: OrganizationAccountType;
  status: OrganizationStatus;
  billingEmail: string | null;
  supportEmail: string | null;
  timezone: string;
  locale: string;
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
  users: PlatformOrganizationOwner[];
};

export type PlatformOrganizationUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: string;
};

export type PlatformOrganizationInvitation = {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  invitedBy: PlatformOrganizationOwner | null;
  acceptedBy: PlatformOrganizationOwner | null;
};

export type PlatformOrganizationDetail = Omit<
  PlatformOrganizationListItem,
  'users'
> & {
  statusReason: string | null;
  trialEndsAt: string | null;
  activatedAt: string | null;
  suspendedAt: string | null;
  cancelledAt: string | null;
  users: PlatformOrganizationUser[];
  invitations: PlatformOrganizationInvitation[];
};

export type QueryPlatformOrganizationsParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  accountType?: OrganizationAccountType;
  status?: OrganizationStatus;
  plan?: string;
  aiEnabled?: string;
  sortBy?:
    | 'createdAt'
    | 'updatedAt'
    | 'name'
    | 'status'
    | 'accountType'
    | 'aiCreditsBalance'
    | 'aiMonthlyCreditsLimit';
  sortOrder?: 'asc' | 'desc';
};

export type UpdatePlatformOrganizationInput = {
  name?: string;
  industry?: string;
  plan?: string;
  accountType?: OrganizationAccountType;
  status?: OrganizationStatus;
  billingEmail?: string;
  supportEmail?: string;
  timezone?: string;
  locale?: string;
  statusReason?: string;
  maxUsers?: number;
  maxActiveLeads?: number;
  aiMonthlyCreditsLimit?: number;
  aiDefaultUserMonthlyCreditsLimit?: number;
  aiCreditsBalance?: number;
};

export type UpdatePlatformOrganizationStatusInput = {
  status: OrganizationStatus;
  statusReason?: string;
};

export type OnboardPlatformOrganizationInput = {
  organizationName: string;
  slug: string;
  ownerEmail: string;
  industry?: string;
  plan?: string;
  accountType?: OrganizationAccountType;
  status?: Extract<OrganizationStatus, 'TRIAL' | 'ACTIVE'>;
  billingEmail?: string;
  supportEmail?: string;
  timezone?: string;
  locale?: string;
  trialEndsAt?: string;
  statusReason?: string;
  maxUsers?: number;
  maxActiveLeads?: number;
  aiEnabled?: boolean;
  aiMonthlyCreditsLimit?: number;
  aiDefaultUserMonthlyCreditsLimit?: number;
  aiCreditsBalance?: number;
};

export type PlatformOwnerOnboardingInvitation = {
  id: string;
  organizationId: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  invitedBy: PlatformOrganizationOwner | null;
  acceptanceToken: string;
};

export type OnboardPlatformOrganizationResponse = {
  organization: PlatformOrganizationDetail;
  ownerInvitation: PlatformOwnerOnboardingInvitation;
};

export type PaginatedPlatformOrganizations =
  PaginatedResponse<PlatformOrganizationListItem>;