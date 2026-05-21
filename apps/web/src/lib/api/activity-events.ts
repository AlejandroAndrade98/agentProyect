import { apiRequest } from '@/lib/api/core';
import type { ActivityEvent, ActivityEventsQuery } from '@/types/activity';
import type { PaginatedResponse } from '@/types/crm';

export function getActivityEvents(
  token: string,
  query: ActivityEventsQuery = {},
) {
  return apiRequest<PaginatedResponse<ActivityEvent>>('/activity-events', {
    method: 'GET',
    token,
    query: query as Record<string, string | number | boolean | undefined>,
  });
}