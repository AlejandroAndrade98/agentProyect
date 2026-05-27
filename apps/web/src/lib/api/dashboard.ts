import { apiRequest } from '@/lib/api/core';
import type {
  DashboardLeadsOverview,
  DashboardRecentActivity,
  DashboardRecentActivityQuery,
  DashboardSummary,
  DashboardTasksOverview,
  DashboardExternalSyncOverview,
  DashboardManualExternalSyncResult,
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

export function getDashboardExternalSync(token: string) {
  return apiRequest<DashboardExternalSyncOverview>(
    '/dashboard/external-sync',
    {
      token,
    },
  );
}

export function syncDashboardGmailMessages(token: string) {
  return apiRequest<DashboardManualExternalSyncResult>(
    '/external-sync/email-messages/sync',
    {
      method: 'POST',
      token,
    },
  );
}

export function syncDashboardCalendarEvents(token: string) {
  return apiRequest<DashboardManualExternalSyncResult>(
    '/external-sync/calendar-events/sync',
    {
      method: 'POST',
      token,
    },
  );
}