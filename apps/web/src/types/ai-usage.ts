import type { PaginatedResponse } from './crm';

export type AiUsageFeature = 'LEAD_NEXT_STEPS';

export type AiUsageStatus = 'SUCCESS' | 'FAILED' | 'BLOCKED';

export type AiUsageUser = {
  id: string;
  email: string;
  name: string;
  role: string;
};

export type AiUsageSuggestion = {
  id: string;
  title: string | null;
  type: string;
  status: string;
  leadId: string | null;
  createdAt: string;
};

export type MyAiUsageResponse = {
  period: {
    startDate: string;
    endDate: string;
  };
  user: {
    id: string;
    aiEnabled: boolean;
    monthlyCreditsLimit: number;
    creditsUsed: number;
    creditsRemaining: number;
    requestsCount: number;
    tokensInput: number;
    tokensOutput: number;
    totalTokens: number;
    estimatedCostUsd: number;
  };
  organization: {
    id: string;
    name: string;
    aiEnabled: boolean;
    creditsBalance: number;
    monthlyCreditsLimit: number;
    defaultUserMonthlyCreditsLimit: number;
    creditsUpdatedAt: string | null;
  };
};

export type OrganizationAiUsageResponse = {
  period: {
    startDate: string;
    endDate: string;
  };
  organization: {
    id: string;
    name: string;
    aiEnabled: boolean;
    aiMonthlyCreditsLimit: number;
    aiDefaultUserMonthlyCreditsLimit: number;
    aiCreditsBalance: number;
    aiCreditsUpdatedAt: string | null;
    creditsUsed: number;
    creditsRemainingMonthly: number;
  };
  summary: {
    requestsCount: number;
    creditsUsed: number;
    tokensInput: number;
    tokensOutput: number;
    totalTokens: number;
    estimatedCostUsd: number;
  };
  usageByFeature: Array<{
    feature: AiUsageFeature;
    requestsCount: number;
    creditsUsed: number;
    totalTokens: number;
    estimatedCostUsd: number;
  }>;
  usageByUser: Array<{
    userId: string | null;
    user: AiUsageUser | null;
    requestsCount: number;
    creditsUsed: number;
    totalTokens: number;
    estimatedCostUsd: number;
  }>;
};

export type AiUsageRecord = {
  id: string;
  organizationId: string;
  userId: string | null;
  user: AiUsageUser | null;
  aiSuggestionId: string | null;
  aiSuggestion: AiUsageSuggestion | null;
  feature: AiUsageFeature;
  status: AiUsageStatus;
  provider: string | null;
  model: string | null;
  tokensInput: number;
  tokensOutput: number;
  totalTokens: number;
  creditsUsed: number;
  estimatedCostUsd: number;
  errorCode: string | null;
  errorMessage: string | null;
  metadataJson: Record<string, unknown> | null;
  createdAt: string;
};

export type QueryAiUsageRecordsParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  feature?: AiUsageFeature;
  status?: AiUsageStatus;
  userId?: string;
  aiSuggestionId?: string;
  sortBy?:
    | 'createdAt'
    | 'creditsUsed'
    | 'tokensInput'
    | 'tokensOutput'
    | 'totalTokens'
    | 'estimatedCostUsd';
  sortOrder?: 'asc' | 'desc';
};

export type PaginatedAiUsageRecords = PaginatedResponse<AiUsageRecord>;