'use client';

import { useEffect, useState } from 'react';

import {
  ApiClientError,
  getDashboardLeads,
  getDashboardRecentActivity,
  getDashboardSummary,
  getDashboardTasks,
} from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import type {
  ActivityEventType,
  DashboardActivityEvent,
  DashboardLeadsOverview,
  DashboardRecentActivity,
  DashboardSummary,
  DashboardTasksOverview,
  LeadStatus,
  Priority,
  TaskStatus,
} from '@/types/dashboard';

type DashboardData = {
  summary: DashboardSummary;
  leads: DashboardLeadsOverview;
  tasks: DashboardTasksOverview;
  recentActivity: DashboardRecentActivity;
};

function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatDate(value: string | null) {
  if (!value) {
    return 'No date';
  }

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function getLeadStatusClasses(status: LeadStatus) {
  const classes: Record<LeadStatus, string> = {
    NEW: 'bg-blue-50 text-blue-700 ring-blue-200',
    CONTACTED: 'bg-cyan-50 text-cyan-700 ring-cyan-200',
    MEETING_SCHEDULED: 'bg-violet-50 text-violet-700 ring-violet-200',
    PROPOSAL_SENT: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
    NEGOTIATION: 'bg-amber-50 text-amber-700 ring-amber-200',
    WON: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    LOST: 'bg-red-50 text-red-700 ring-red-200',
    ARCHIVED: 'bg-slate-100 text-slate-600 ring-slate-200',
  };

  return classes[status];
}

function getTaskStatusClasses(status: TaskStatus) {
  const classes: Record<TaskStatus, string> = {
    TODO: 'bg-slate-100 text-slate-700 ring-slate-200',
    IN_PROGRESS: 'bg-blue-50 text-blue-700 ring-blue-200',
    COMPLETED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    CANCELLED: 'bg-red-50 text-red-700 ring-red-200',
    ARCHIVED: 'bg-slate-100 text-slate-600 ring-slate-200',
  };

  return classes[status];
}

function getPriorityClasses(priority: Priority) {
  const classes: Record<Priority, string> = {
    LOW: 'bg-slate-100 text-slate-700 ring-slate-200',
    MEDIUM: 'bg-blue-50 text-blue-700 ring-blue-200',
    HIGH: 'bg-amber-50 text-amber-700 ring-amber-200',
    CRITICAL: 'bg-red-50 text-red-700 ring-red-200',
  };

  return classes[priority];
}

function getActivityLabel(type: ActivityEventType) {
  return formatEnumLabel(type);
}

function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${className}`}
    >
      {children}
    </span>
  );
}

function StatCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: number;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
        {value}
      </p>
      <p className="mt-2 text-xs text-slate-500">{helper}</p>
    </div>
  );
}

function CountRow({
  label,
  count,
  badgeClassName,
}: {
  label: string;
  count: number;
  badgeClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl px-3 py-2 transition hover:bg-slate-50">
      <div className="flex items-center gap-2">
        {badgeClassName ? (
          <span className={`h-2.5 w-2.5 rounded-full ${badgeClassName}`} />
        ) : null}
        <span className="text-sm text-slate-600">{label}</span>
      </div>
      <span className="text-sm font-semibold text-slate-950">{count}</span>
    </div>
  );
}

function ActivityItem({ event }: { event: DashboardActivityEvent }) {
  return (
    <div className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-950">{event.title}</p>
          <p className="mt-1 text-xs text-slate-500">
            {getActivityLabel(event.type)}
          </p>
        </div>
        <span className="shrink-0 text-xs text-slate-400">
          {formatDate(event.occurredAt)}
        </span>
      </div>
      {event.actor ? (
        <p className="mt-2 text-xs text-slate-500">By {event.actor.name}</p>
      ) : null}
    </div>
  );
}

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
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm"
          />
        ))}
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

  const newLeads =
    data.leads.leadsByStatus.find((item) => item.status === 'NEW')?.count ?? 0;

  const todoTasks =
    data.tasks.tasksByStatus.find((item) => item.status === 'TODO')?.count ?? 0;

  const topRecentLeads = data.leads.recentLeads.slice(0, 4);

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Companies"
          value={data.summary.companies.total}
          helper="Active company accounts"
        />

        <StatCard
          label="Contacts"
          value={data.summary.contacts.total}
          helper="People linked to CRM records"
        />

        <StatCard
          label="Open leads"
          value={data.summary.leads.open}
          helper={`${newLeads} currently in New status`}
        />

        <StatCard
          label="Pending tasks"
          value={data.summary.tasks.pending}
          helper={`${todoTasks} currently in To do status`}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-950">
              Leads by status
            </h2>
            <Badge className="bg-blue-50 text-blue-700 ring-blue-200">
              {data.summary.leads.total} total
            </Badge>
          </div>

          <div className="mt-5 space-y-1">
            {data.leads.leadsByStatus.map((item) => (
              <CountRow
                key={item.status}
                label={formatEnumLabel(item.status)}
                count={item.count}
                badgeClassName={
                  item.count > 0 ? 'bg-blue-600' : 'bg-slate-300'
                }
              />
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-950">
              Leads by priority
            </h2>
            <Badge className="bg-slate-100 text-slate-700 ring-slate-200">
              Pipeline
            </Badge>
          </div>

          <div className="mt-5 space-y-1">
            {data.leads.leadsByPriority.map((item) => (
              <CountRow
                key={item.priority}
                label={formatEnumLabel(item.priority)}
                count={item.count}
                badgeClassName={
                  item.priority === 'CRITICAL'
                    ? 'bg-red-500'
                    : item.priority === 'HIGH'
                      ? 'bg-amber-500'
                      : item.priority === 'MEDIUM'
                        ? 'bg-blue-500'
                        : 'bg-slate-400'
                }
              />
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-950">
              Tasks by status
            </h2>
            <Badge className="bg-slate-100 text-slate-700 ring-slate-200">
              Workload
            </Badge>
          </div>

          <div className="mt-5 space-y-1">
            {data.tasks.tasksByStatus.map((item) => (
              <CountRow
                key={item.status}
                label={formatEnumLabel(item.status)}
                count={item.count}
                badgeClassName={
                  item.count > 0 ? 'bg-slate-700' : 'bg-slate-300'
                }
              />
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-950">
                Recent leads
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Latest commercial opportunities.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {topRecentLeads.length > 0 ? (
              topRecentLeads.map((lead) => (
                <div
                  key={lead.id}
                  className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-950">{lead.title}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {lead.company?.name ?? 'No company'} ·{' '}
                        {lead.contact
                          ? `${lead.contact.firstName} ${lead.contact.lastName}`
                          : 'No contact'}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Badge className={getLeadStatusClasses(lead.status)}>
                        {formatEnumLabel(lead.status)}
                      </Badge>
                      <Badge className={getPriorityClasses(lead.priority)}>
                        {formatEnumLabel(lead.priority)}
                      </Badge>
                    </div>
                  </div>

                  {lead.nextStep ? (
                    <p className="mt-3 text-sm text-slate-600">
                      Next step: {lead.nextStep}
                    </p>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">No recent leads yet.</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-base font-semibold text-slate-950">
              Recent activity
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Latest CRM timeline events.
            </p>
          </div>

          <div className="mt-5 space-y-4">
            {data.recentActivity.recentActivity.length > 0 ? (
              data.recentActivity.recentActivity.map((event) => (
                <ActivityItem key={event.id} event={event} />
              ))
            ) : (
              <p className="text-sm text-slate-500">No recent activity yet.</p>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-950">
            Pending tasks
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {data.tasks.pendingTasks.length} shown
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-950">
            Overdue tasks
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {data.tasks.overdueTasks.length} shown
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-950">
            Recently completed
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {data.tasks.recentlyCompletedTasks.length} shown
          </p>
        </div>
      </section>
    </div>
  );
}