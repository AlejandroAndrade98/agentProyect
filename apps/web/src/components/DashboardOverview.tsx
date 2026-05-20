'use client';

import { useEffect, useState } from 'react';

import {
  ApiClientError,
  getDashboardLeads,
  getDashboardRecentActivity,
  getDashboardSummary,
  getDashboardTasks,
} from '@/lib/api-client';
import type {
  DashboardLeadsOverview,
  DashboardRecentActivity,
  DashboardSummary,
  DashboardTasksOverview,
} from '@/types/dashboard';
import { useAuth } from '@/hooks/useAuth';

type DashboardData = {
  summary: DashboardSummary;
  leads: DashboardLeadsOverview;
  tasks: DashboardTasksOverview;
  recentActivity: DashboardRecentActivity;
};

export function DashboardOverview() {
  const { token } = useAuth();

  const [data, setData] = useState<DashboardData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboardData() {
      if (!token) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const [summary, leads, tasks, recentActivity] = await Promise.all([
          getDashboardSummary(token),
          getDashboardLeads(token),
          getDashboardTasks(token),
          getDashboardRecentActivity(token, {
            limit: 8,
          }),
        ]);

        if (!isMounted) {
          return;
        }

        setData({
          summary,
          leads,
          tasks,
          recentActivity,
        });
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (error instanceof ApiClientError) {
          setErrorMessage(error.message);
        } else if (error instanceof Error) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage('Could not load dashboard data.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadDashboardData();

    return () => {
      isMounted = false;
    };
  }, [token]);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
        Loading dashboard data...
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {errorMessage}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
        No dashboard data available.
      </div>
    );
  }

  const openLeads =
    data.leads.leadsByStatus.find((item) => item.status === 'NEW')?.count ?? 0;

  const pendingTasks =
    data.tasks.tasksByStatus.find((item) => item.status === 'TODO')?.count ?? 0;

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Companies</p>
          <p className="mt-3 text-3xl font-semibold text-slate-950">
            {data.summary.companies.total}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Contacts</p>
          <p className="mt-3 text-3xl font-semibold text-slate-950">
            {data.summary.contacts.total}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Open leads</p>
          <p className="mt-3 text-3xl font-semibold text-slate-950">
            {data.summary.leads.open}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {openLeads} currently in NEW status
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Pending tasks</p>
          <p className="mt-3 text-3xl font-semibold text-slate-950">
            {data.summary.tasks.pending}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {pendingTasks} currently in TODO status
          </p>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-950">
            Leads by status
          </h2>

          <div className="mt-5 space-y-3">
            {data.leads.leadsByStatus.map((item) => (
              <div
                key={item.status}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-slate-600">{item.status}</span>
                <span className="font-semibold text-slate-950">
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-950">
            Tasks by status
          </h2>

          <div className="mt-5 space-y-3">
            {data.tasks.tasksByStatus.map((item) => (
              <div
                key={item.status}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-slate-600">{item.status}</span>
                <span className="font-semibold text-slate-950">
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-950">
            Recent activity
          </h2>

          <div className="mt-5 space-y-4">
            {data.recentActivity.recentActivity.length > 0 ? (
              data.recentActivity.recentActivity.map((event) => (
                <div
                  key={event.id}
                  className="border-b border-slate-100 pb-4 last:border-0 last:pb-0"
                >
                  <p className="text-sm font-medium text-slate-950">
                    {event.title}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{event.type}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">No recent activity yet.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}