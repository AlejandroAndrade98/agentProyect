'use client';

import { useEffect, useState } from 'react';

import {
  ApiClientError,
  getDashboardExternalSync,
  getDashboardLeads,
  getDashboardRecentActivity,
  getDashboardSummary,
  getDashboardTasks,
} from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import type {
  ActivityEventType,
  DashboardActivityEvent,
  DashboardExternalCalendarEvent,
  DashboardExternalEmailMessage,
  DashboardExternalSyncOverview,
  DashboardExternalSyncState,
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
  externalSync: DashboardExternalSyncOverview;
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

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Invalid date';
  }

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function formatDateTime(value: string | null) {
  if (!value) {
    return 'No date';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Invalid date';
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function getMeetingCountdown(value: string | null, now: Date) {
  if (!value) {
    return 'No upcoming meeting';
  }

  const meetingDate = new Date(value);
  const diffMs = meetingDate.getTime() - now.getTime();

  if (Number.isNaN(meetingDate.getTime())) {
    return 'Invalid meeting date';
  }

  if (diffMs <= 0) {
    return 'Starting now';
  }

  const totalMinutes = Math.ceil(diffMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

function getSyncStatusClasses(status: string | null | undefined) {
  if (status === 'ACTIVE') {
    return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  }

  if (status === 'ERROR') {
    return 'bg-red-50 text-red-700 ring-red-200';
  }

  if (status === 'INITIAL_SYNC_RUNNING') {
    return 'bg-blue-50 text-blue-700 ring-blue-200';
  }

  if (status === 'INITIAL_SYNC_PENDING') {
    return 'bg-amber-50 text-amber-700 ring-amber-200';
  }

  return 'bg-slate-100 text-slate-600 ring-slate-200';
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

function SyncStatusBadge({
  label,
  syncState,
}: {
  label: string;
  syncState: DashboardExternalSyncState | null;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <Badge className={getSyncStatusClasses(syncState?.status)}>
        {syncState?.status ? formatEnumLabel(syncState.status) : 'Not synced'}
      </Badge>
    </div>
  );
}

function NextMeetingCard({
  meeting,
  now,
}: {
  meeting: DashboardExternalCalendarEvent | null;
  now: Date;
}) {
  if (!meeting) {
    return (
      <div className="relative overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-slate-50 p-6 shadow-sm">
        <div className="absolute right-6 top-6 h-24 w-24 rounded-full bg-blue-100/60 blur-2xl" />

        <p className="text-sm font-medium uppercase tracking-wide text-blue-700">
          Next meeting
        </p>

        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
          No upcoming meetings
        </h2>

        <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
          Great time to follow up on recent emails, review your open leads, or
          prepare your next outreach.
        </p>
      </div>
    );
  }

  const countdown = getMeetingCountdown(meeting.startAt, now);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-5 text-white shadow-sm">
      <div className="absolute right-6 top-6 h-28 w-28 rounded-full bg-blue-400/20 blur-2xl" />

      <div className="relative">
        <p className="text-sm font-medium uppercase tracking-wide text-blue-200">
          Next meeting in
        </p>

        <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-5xl font-semibold tracking-tight">
              {countdown}
            </p>

            <h2 className="mt-4 text-xl font-semibold">
              {meeting.summary ?? 'Untitled meeting'}
            </h2>
          </div>

          <Badge className="bg-white/10 text-white ring-white/20">
            Calendar
          </Badge>
        </div>

        <div className="mt-5 grid gap-3 text-sm text-blue-100 md:grid-cols-2">
          <p>{formatDateTime(meeting.startAt)}</p>
          <p>{meeting.location || 'No location set'}</p>
        </div>

        {meeting.htmlLink ? (
          <a
            href={meeting.htmlLink}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-950 hover:bg-blue-50"
          >
            Open in Google Calendar
          </a>
        ) : null}
      </div>
    </div>
  );
}

function RecentEmailItem({
  email,
}: {
  email: DashboardExternalEmailMessage;
}) {
  return (
    <div className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="line-clamp-1 text-sm font-medium text-slate-950">
            {email.subject || 'No subject'}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            {email.fromName || email.fromEmail || 'Unknown sender'}
          </p>
        </div>

        <span className="shrink-0 text-xs text-slate-400">
          {formatDate(email.internalDate)}
        </span>
      </div>

      {email.snippet ? (
        <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">
          {email.snippet}
        </p>
      ) : null}
    </div>
  );
}

function ExternalSyncOverviewSection({
  externalSync,
  now,
}: {
  externalSync: DashboardExternalSyncOverview;
  now: Date;
}) {
  return (
    <section className="grid gap-4 xl:grid-cols-[0.75fr_1.25fr]">
      <div className="grid gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-950">
                Sync status
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Gmail and Calendar connection health.
              </p>
            </div>

            {externalSync.connectedAccount ? (
              <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200">
                Connected
              </Badge>
            ) : (
              <Badge className="bg-slate-100 text-slate-600 ring-slate-200">
                Not connected
              </Badge>
            )}
          </div>

          <div className="mt-4 space-y-2">
            <SyncStatusBadge
              label="Gmail"
              syncState={externalSync.syncStates.email}
            />

            <SyncStatusBadge
              label="Calendar"
              syncState={externalSync.syncStates.calendar}
            />
          </div>
        </div>

        <NextMeetingCard meeting={externalSync.nextMeeting} now={now} />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-base font-semibold text-slate-950">
            Recent synced emails
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Latest Gmail metadata synced to the CRM.
          </p>
        </div>

        <div className="mt-5 space-y-4">
          {externalSync.recentEmailMessages.length > 0 ? (
            externalSync.recentEmailMessages.map((email) => (
              <RecentEmailItem key={email.id} email={email} />
            ))
          ) : (
            <p className="text-sm text-slate-500">
              No synced emails yet. Run Gmail sync to see recent messages.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

export function DashboardOverview() {
  const { token } = useAuth();

  const [data, setData] = useState<DashboardData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(new Date());
    }, 60000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

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
        const [summary, leads, tasks, recentActivity, externalSync] =
          await Promise.all([
            getDashboardSummary(token),
            getDashboardLeads(token),
            getDashboardTasks(token),
            getDashboardRecentActivity(token, {
              limit: 8,
            }),
            getDashboardExternalSync(token),
          ]);

        if (!isMounted) {
          return;
        }

        setData({
          summary,
          leads,
          tasks,
          recentActivity,
          externalSync,
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

      <ExternalSyncOverviewSection externalSync={data.externalSync} now={now} />

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