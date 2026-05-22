import type {
  MyAiUsageResponse,
  OrganizationAiUsageResponse,
  PaginatedAiUsageRecords,
  QueryAiUsageRecordsParams,
} from '@/types/ai-usage';

import { apiRequest } from './core';

export function getMyAiUsage(token: string) {
  return apiRequest<MyAiUsageResponse>('/ai-usage/me', {
    token,
  });
}

export function getOrganizationAiUsage(token: string) {
  return apiRequest<OrganizationAiUsageResponse>('/ai-usage/organization', {
    token,
  });
}

export function getAiUsageRecords(
  token: string,
  params: QueryAiUsageRecordsParams = {},
) {
  return apiRequest<PaginatedAiUsageRecords>('/ai-usage/records', {
    token,
    query: params,
  });
}