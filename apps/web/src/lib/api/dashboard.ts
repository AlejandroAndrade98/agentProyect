import { apiRequest } from '@/lib/api/core';
import type {
  DashboardLeadsOverview,
  DashboardRecentActivity,
  DashboardRecentActivityQuery,
  DashboardSummary,
  DashboardTasksOverview,
} from '@/types/dashboard';

export function getDashboardSummary(token: string) {
  return apiRequest<DashboardSummary>('/dashboard/summary', {
    token,
  });
}

export function getDashboardLeads(token: string) {
  return apiRequest<DashboardLeadsOverview>('/dashboard/leads', {
    token,
  });
}

export function getDashboardTasks(token: string) {
  return apiRequest<DashboardTasksOverview>('/dashboard/tasks', {
    token,
  });
}

export function getDashboardRecentActivity(
  token: string,
  query?: DashboardRecentActivityQuery,
) {
  return apiRequest<DashboardRecentActivity>('/dashboard/recent-activity', {
    token,
    query,
  });
}