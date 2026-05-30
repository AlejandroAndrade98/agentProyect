'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/hooks/useAuth';
import {
  getPriorityLabel,
  getSyncStatusLabel,
  getTaskStatusLabel,
} from '@/i18n/ai-display';
import { useI18n } from '@/i18n/useI18n';
import {
  ApiClientError,
  getAiSuggestions,
  getDashboardExternalSync,
  getDashboardLeads,
  getDashboardRecentActivity,
  getDashboardSummary,
  getDashboardTasks,
  syncDashboardCalendarEvents,
  syncDashboardGmailMessages,
} from '@/lib/api-client';
import { formatDate, formatDateTime, formatEnumLabel, truncateText } from '@/lib/formatters';
import type { AiSuggestion } from '@/types/ai-suggestions';
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
  DashboardTask,
  DashboardTasksOverview,
  Priority,
} from '@/types/dashboard';

type DashboardAiOverview = {
  pendingReviewCount: number;
  readyForActionCount: number;
};

type DashboardData = {
  summary: DashboardSummary;
  leads: DashboardLeadsOverview;
  tasks: DashboardTasksOverview;
  recentActivity: DashboardRecentActivity;
  externalSync: DashboardExternalSyncOverview;
  ai: DashboardAiOverview;
};

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

function getMeetingCountdown(value: string | null, now: Date, t: (key: string) => string) {
  if (!value) {
    return t('dashboard.sections.noUpcomingMeeting');
  }

  const meetingDate = new Date(value);
  const diffMs = meetingDate.getTime() - now.getTime();

  if (Number.isNaN(meetingDate.getTime())) {
    return t('common.emptyStates.notSet');
  }

  if (diffMs <= 0) {
    return t('dashboard.cards.nextMeeting');
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

function getMetadataString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getAppliedActionNames(suggestion: AiSuggestion) {
  const actions = suggestion.metadataJson?.appliedActions;

  if (!Array.isArray(actions)) {
    return [];
  }

  return actions.flatMap((appliedAction) => {
    if (typeof appliedAction === 'string') {
      return appliedAction;
    }

    if (
      !appliedAction ||
      typeof appliedAction !== 'object' ||
      Array.isArray(appliedAction)
    ) {
      return [];
    }

    const action =
      (appliedAction as Record<string, unknown>).action ??
      (appliedAction as Record<string, unknown>).appliedAction ??
      (appliedAction as Record<string, unknown>).type;

    return typeof action === 'string' ? action : [];
  });
}

function hasCompletedAction(suggestion: AiSuggestion) {
  return (
    getAppliedActionNames(suggestion).length > 0 ||
    Boolean(getMetadataString(suggestion.metadataJson?.gmailDraftId)) ||
    Boolean(getMetadataString(suggestion.metadataJson?.taskId)) ||
    Boolean(getMetadataString(suggestion.metadataJson?.noteId)) ||
    Boolean(getMetadataString(suggestion.metadataJson?.leadId))
  );
}

function getSyncErrorMessage(error: unknown, t: (key: string) => string) {
  if (error instanceof ApiClientError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return t('dashboard.messages.syncFailed');
}

async function getDashboardAiOverview(token: string): Promise<DashboardAiOverview> {
  const [pending, accepted, editedAndAccepted] = await Promise.all([
    getAiSuggestions(token, {
      page: 1,
      pageSize: 1,
      status: 'PENDING_REVIEW',
      sortBy: 'createdAt',
      sortOrder: 'desc',
    }),
    getAiSuggestions(token, {
      page: 1,
      pageSize: 100,
      status: 'ACCEPTED',
      sortBy: 'createdAt',
      sortOrder: 'desc',
    }),
    getAiSuggestions(token, {
      page: 1,
      pageSize: 100,
      status: 'EDITED_AND_ACCEPTED',
      sortBy: 'createdAt',
      sortOrder: 'desc',
    }),
  ]);

  const readyForActionCount = [...accepted.data, ...editedAndAccepted.data]
    .filter((suggestion) => !hasCompletedAction(suggestion)).length;

  return {
    pendingReviewCount: pending.meta.total,
    readyForActionCount,
  };
}

function ActionCard({
  label,
  value,
  helper,
  href,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  helper: string;
  href: string;
  tone?: 'default' | 'attention';
}) {
  const toneClasses =
    tone === 'attention'
      ? 'border-blue-200 bg-blue-50/70 hover:border-blue-300'
      : 'border-slate-200 bg-white hover:border-slate-300';

  return (
    <Link
      href={href}
      className={`rounded-2xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${toneClasses}`}
    >
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
        {value}
      </p>
      <p className="mt-2 text-sm leading-5 text-slate-600">{helper}</p>
    </Link>
  );
}

function MetricCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: number;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
        {value}
      </p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{helper}</p>
    </div>
  );
}

function WorkspaceCard({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
    >
      <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-5 text-slate-500">{description}</p>
    </Link>
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

function SyncStatusBadge({
  label,
  syncState,
}: {
  label: string;
  syncState: DashboardExternalSyncState | null;
}) {
  const { t } = useI18n();

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <Badge className={getSyncStatusClasses(syncState?.status)}>
        {syncState?.status
          ? getSyncStatusLabel(syncState.status, t)
          : t('common.labels.notSynced')}
      </Badge>
    </div>
  );
}

function NextMeetingSpotlight({
  meeting,
  now,
}: {
  meeting: DashboardExternalCalendarEvent | null;
  now: Date;
}) {
  const { t } = useI18n();

  if (!meeting) {
    return (
      <section className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-blue-700">
              {t('dashboard.sections.nextMeeting')}
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              {t('dashboard.sections.noUpcomingMeeting')}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              {t('dashboard.messages.calendarMetadataSynced')}
            </p>
          </div>

          <Link
            href="/dashboard/external-sync/calendar-events"
            className="inline-flex justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            {t('dashboard.sections.openSyncedCalendar')}
          </Link>
        </div>
      </section>
    );
  }

  const countdown = getMeetingCountdown(meeting.startAt, now, t);

  return (
    <section className="rounded-3xl border border-blue-200 bg-slate-950 p-6 text-white shadow-sm">
      <div className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr_auto] lg:items-center">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-blue-200">
            {t('dashboard.sections.nextMeeting')}
          </p>
          <p className="mt-3 text-5xl font-semibold tracking-tight">
            {countdown}
          </p>
          <p className="mt-2 text-sm text-blue-100">
            {t('dashboard.sections.untilNextMeeting')}
          </p>
        </div>

        <div className="min-w-0">
          <h2 className="break-words text-2xl font-semibold tracking-tight">
            {meeting.summary ?? t('common.emptyStates.noTitle')}
          </h2>
          <div className="mt-4 grid gap-3 text-sm text-slate-200 md:grid-cols-2">
            <p>{formatDateTime(meeting.startAt)}</p>
            <p>{meeting.location || t('common.emptyStates.notSet')}</p>
            <p>
              {t('externalSync.labels.organizer')}:{' '}
              {meeting.organizerName ||
                meeting.organizerEmail ||
                t('common.emptyStates.unknownOrganizer')}
            </p>
            <p>{t('externalSync.labels.synced')}: {formatDateTime(meeting.syncedAt)}</p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {meeting.htmlLink ? (
            <a
              href={meeting.htmlLink}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl bg-white px-4 py-2.5 text-center text-sm font-medium text-slate-950 transition hover:bg-blue-50"
            >
              {t('dashboard.sections.openGoogleCalendar')}
            </a>
          ) : null}

          <Link
            href="/dashboard/external-sync/calendar-events"
            className="rounded-xl border border-white/20 px-4 py-2.5 text-center text-sm font-medium text-white transition hover:bg-white/10"
          >
            {t('dashboard.sections.viewCalendarBoard')}
          </Link>
        </div>
      </div>
    </section>
  );
}

function TaskPreview({ task }: { task: DashboardTask }) {
  const { t } = useI18n();

  return (
    <Link
      href={`/dashboard/tasks/${task.id}`}
      className="block rounded-xl border border-slate-100 bg-slate-50/70 p-3 transition hover:border-slate-200 hover:bg-white"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-950">
            {task.title}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {t('common.labels.due')} {formatDate(task.dueDate)}
          </p>
        </div>
        <Badge className={getPriorityClasses(task.priority)}>
          {getPriorityLabel(task.priority, t)}
        </Badge>
      </div>
    </Link>
  );
}

function ActivityItem({ event }: { event: DashboardActivityEvent }) {
  const { t } = useI18n();

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
        <p className="mt-2 text-xs text-slate-500">
          {t('common.labels.by')} {event.actor.name}
        </p>
      ) : null}
    </div>
  );
}

function RecentEmailItem({ email }: { email: DashboardExternalEmailMessage }) {
  const { t } = useI18n();

  return (
    <Link
      href="/dashboard/external-sync/email-messages"
      className="block rounded-xl border border-slate-100 bg-slate-50/70 p-3 transition hover:border-slate-200 hover:bg-white"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-950">
            {email.subject || t('common.emptyStates.noSubject')}
          </p>
          <p className="mt-1 truncate text-xs text-slate-500">
            {email.fromName || email.fromEmail || t('common.emptyStates.unknownSender')}
          </p>
        </div>
        <span className="shrink-0 text-xs text-slate-400">
          {formatDate(email.internalDate)}
        </span>
      </div>

      {email.snippet ? (
        <p className="mt-2 text-xs leading-5 text-slate-500">
          {truncateText(email.snippet, 120)}
        </p>
      ) : null}
    </Link>
  );
}

function UpcomingCalendarItem({
  event,
}: {
  event: DashboardExternalCalendarEvent;
}) {
  const { t } = useI18n();

  return (
    <Link
      href="/dashboard/external-sync/calendar-events"
      className="block rounded-xl border border-slate-100 bg-slate-50/70 p-3 transition hover:border-slate-200 hover:bg-white"
    >
      <p className="truncate text-sm font-medium text-slate-950">
        {event.summary || t('common.emptyStates.noTitle')}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        {formatDateTime(event.startAt)}
      </p>
      {event.location ? (
        <p className="mt-1 truncate text-xs text-slate-500">{event.location}</p>
      ) : null}
    </Link>
  );
}

function ExternalSyncSnapshot({
  externalSync,
  isSyncingEmail,
  isSyncingCalendar,
  syncActionMessage,
  syncActionError,
  onSyncEmail,
  onSyncCalendar,
}: {
  externalSync: DashboardExternalSyncOverview;
  isSyncingEmail: boolean;
  isSyncingCalendar: boolean;
  syncActionMessage: string | null;
  syncActionError: string | null;
  onSyncEmail: () => void;
  onSyncCalendar: () => void;
}) {
  const { t } = useI18n();
  const recentEmails = externalSync.recentEmailMessages.slice(0, 3);
  const upcomingEvents = externalSync.upcomingCalendarEvents.slice(0, 3);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-slate-950">
          {t('dashboard.sections.externalSyncSnapshot')}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {t('dashboard.sections.externalSyncSnapshotDescription')}
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-950">
                {t('dashboard.sections.syncStatus')}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {t('dashboard.messages.manualSyncOnly')}
              </p>
            </div>

            {externalSync.connectedAccount ? (
              <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200">
                {t('common.labels.connected')}
              </Badge>
            ) : (
              <Badge className="bg-slate-100 text-slate-600 ring-slate-200">
                {t('common.labels.notConnected')}
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

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={onSyncEmail}
              disabled={
                isSyncingEmail ||
                isSyncingCalendar ||
                !externalSync.connectedAccount
              }
              className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSyncingEmail
                ? t('externalSync.actions.syncingGmail')
                : t('externalSync.actions.syncGmail')}
            </button>

            <button
              type="button"
              onClick={onSyncCalendar}
              disabled={
                isSyncingEmail ||
                isSyncingCalendar ||
                !externalSync.connectedAccount
              }
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSyncingCalendar
                ? t('externalSync.actions.syncingCalendar')
                : t('externalSync.actions.syncCalendar')}
            </button>
          </div>

          {syncActionMessage ? (
            <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              {syncActionMessage}
            </p>
          ) : null}

          {syncActionError ? (
            <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {syncActionError}
            </p>
          ) : null}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-950">
                {t('dashboard.labels.recentSyncedEmails')}
              </h3>
              <Link
                href="/dashboard/external-sync/email-messages"
                className="text-xs font-medium text-blue-700 hover:text-blue-900"
              >
                {t('dashboard.labels.openInbox')}
              </Link>
            </div>

            <div className="mt-4 space-y-2">
              {recentEmails.length > 0 ? (
                recentEmails.map((email) => (
                  <RecentEmailItem key={email.id} email={email} />
                ))
              ) : (
                <p className="text-sm text-slate-500">
                  {t('dashboard.messages.noSyncedEmails')}
                </p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-950">
                {t('dashboard.labels.upcomingCalendar')}
              </h3>
              <Link
                href="/dashboard/external-sync/calendar-events"
                className="text-xs font-medium text-blue-700 hover:text-blue-900"
              >
                {t('dashboard.labels.openCalendar')}
              </Link>
            </div>

            <div className="mt-4 space-y-2">
              {upcomingEvents.length > 0 ? (
                upcomingEvents.map((event) => (
                  <UpcomingCalendarItem key={event.id} event={event} />
                ))
              ) : (
                <p className="text-sm text-slate-500">
                  {t('dashboard.messages.noUpcomingEvents')}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function DashboardOverview() {
  const { token } = useAuth();
  const { t } = useI18n();

  const [data, setData] = useState<DashboardData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const [isSyncingEmail, setIsSyncingEmail] = useState(false);
  const [isSyncingCalendar, setIsSyncingCalendar] = useState(false);
  const [syncActionMessage, setSyncActionMessage] = useState<string | null>(null);
  const [syncActionError, setSyncActionError] = useState<string | null>(null);

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
        const [summary, leads, tasks, recentActivity, externalSync, ai] =
          await Promise.all([
            getDashboardSummary(token),
            getDashboardLeads(token),
            getDashboardTasks(token),
            getDashboardRecentActivity(token, {
              limit: 6,
            }),
            getDashboardExternalSync(token),
            getDashboardAiOverview(token),
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
          ai,
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
          setErrorMessage(t('dashboard.messages.loadFailed'));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadDashboardData();

    return () => {
      isMounted = false;
    };
  }, [token]);

  async function refreshExternalSyncOverview() {
    if (!token) {
      return;
    }

    const externalSync = await getDashboardExternalSync(token);

    setData((currentData) => {
      if (!currentData) {
        return currentData;
      }

      return {
        ...currentData,
        externalSync,
      };
    });
  }

  async function handleSyncEmailMessages() {
    if (!token) {
      setSyncActionError(t('dashboard.messages.missingAccessToken'));
      return;
    }

    try {
      setIsSyncingEmail(true);
      setSyncActionMessage(null);
      setSyncActionError(null);

      const result = await syncDashboardGmailMessages(token);

      await refreshExternalSyncOverview();

      setSyncActionMessage(
        `${t('dashboard.messages.gmailSyncCompleted')} ${
          result.messagesStored ?? 0
        } ${t('dashboard.messages.messagesStored')}, ${
          result.messagesDeletedAsStale ?? 0
        } ${t('dashboard.messages.staleMessagesRemoved')}`,
      );
    } catch (error) {
      setSyncActionError(getSyncErrorMessage(error, t));
    } finally {
      setIsSyncingEmail(false);
    }
  }

  async function handleSyncCalendarEvents() {
    if (!token) {
      setSyncActionError(t('dashboard.messages.missingAccessToken'));
      return;
    }

    try {
      setIsSyncingCalendar(true);
      setSyncActionMessage(null);
      setSyncActionError(null);

      const result = await syncDashboardCalendarEvents(token);

      await refreshExternalSyncOverview();

      setSyncActionMessage(
        `${t('dashboard.messages.calendarSyncCompleted')} ${
          result.eventsStored ?? 0
        } ${t('dashboard.messages.eventsStored')}, ${
          result.eventsDeletedAsStale ?? 0
        } ${t('dashboard.messages.staleEventsRemoved')}`,
      );
    } catch (error) {
      setSyncActionError(getSyncErrorMessage(error, t));
    } finally {
      setIsSyncingCalendar(false);
    }
  }

  const nextMeetingSummary = useMemo(() => {
    if (!data?.externalSync.nextMeeting) {
      return t('dashboard.cards.noMeetingMetadata');
    }

    return `${getMeetingCountdown(
      data.externalSync.nextMeeting.startAt,
      now,
      t,
    )} - ${data.externalSync.nextMeeting.summary ?? t('common.emptyStates.noTitle')}`;
  }, [data?.externalSync.nextMeeting, now, t]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm"
            />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm" />
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
        {t('dashboard.messages.noDashboardData')}
      </div>
    );
  }

  const todoTasks =
    data.tasks.tasksByStatus.find((item) => item.status === 'TODO')?.count ?? 0;
  const inProgressTasks =
    data.tasks.tasksByStatus.find((item) => item.status === 'IN_PROGRESS')
      ?.count ?? 0;
  const recentCompletedCount = data.tasks.recentlyCompletedTasks.length;

  return (
    <div className="space-y-10">
      <NextMeetingSpotlight meeting={data.externalSync.nextMeeting} now={now} />

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-950">
            {t('dashboard.sections.actionRequired')}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {t('dashboard.sections.actionRequiredDescription')}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ActionCard
            label={t('dashboard.cards.pendingAiReviews')}
            value={data.ai.pendingReviewCount}
            helper={t('dashboard.cards.pendingAiReviewsHelper')}
            href="/dashboard/ai-suggestions"
            tone="attention"
          />
          <ActionCard
            label={t('dashboard.cards.readyForAction')}
            value={data.ai.readyForActionCount}
            helper={t('dashboard.cards.readyForActionHelper')}
            href="/dashboard/ai-workspace"
          />
          <ActionCard
            label={t('dashboard.cards.pendingTasks')}
            value={data.summary.tasks.pending}
            helper={`${todoTasks} ${t('dashboard.cards.pendingTasksHelper')} ${inProgressTasks} ${t('dashboard.cards.inProgress')}.`}
            href="/dashboard/tasks"
          />
          <ActionCard
            label={t('dashboard.cards.nextMeeting')}
            value={
              data.externalSync.nextMeeting
                ? getMeetingCountdown(data.externalSync.nextMeeting.startAt, now, t)
                : t('common.labels.none')
            }
            helper={nextMeetingSummary}
            href="/dashboard/external-sync/calendar-events"
          />
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-950">
            {t('dashboard.sections.crmHealth')}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {t('dashboard.sections.crmHealthDescription')}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label={t('dashboard.cards.openLeads')}
            value={data.summary.leads.open}
            helper={`${data.summary.leads.won} ${t('dashboard.cards.wonAndLost')} ${data.summary.leads.lost} ${t('dashboard.cards.lostOverall')}`}
          />
          <MetricCard
            label={t('dashboard.cards.tasksDueSoon')}
            value={data.tasks.dueSoonTasks.length}
            helper={t('dashboard.cards.tasksDueSoonHelper')}
          />
          <MetricCard
            label={t('dashboard.cards.overdueTasks')}
            value={data.summary.tasks.overdue}
            helper={`${data.tasks.overdueTasks.length} ${t('dashboard.cards.overdueTaskPreviews')}`}
          />
          <MetricCard
            label={t('dashboard.cards.recentlyCompleted')}
            value={recentCompletedCount}
            helper={`${data.summary.tasks.completed} ${t('dashboard.cards.completedTasksOverall')}`}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-950">
                {t('dashboard.labels.leadsByStatus')}
              </h3>
              <Badge className="bg-blue-50 text-blue-700 ring-blue-200">
                {data.summary.leads.total} {t('common.labels.total')}
              </Badge>
            </div>

            <div className="mt-4 space-y-1">
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

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-950">
                {t('dashboard.labels.tasksByStatus')}
              </h3>
              <Badge className="bg-slate-100 text-slate-700 ring-slate-200">
                {t('dashboard.labels.workload')}
              </Badge>
            </div>

            <div className="mt-4 space-y-1">
              {data.tasks.tasksByStatus.map((item) => (
                <CountRow
                  key={item.status}
                  label={getTaskStatusLabel(item.status, t)}
                  count={item.count}
                  badgeClassName={
                    item.count > 0 ? 'bg-slate-700' : 'bg-slate-300'
                  }
                />
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-950">
                {t('dashboard.labels.taskPriorities')}
              </h3>
              <Badge className="bg-amber-50 text-amber-700 ring-amber-200">
                {t('dashboard.labels.focus')}
              </Badge>
            </div>

            <div className="mt-4 space-y-1">
              {data.tasks.tasksByPriority.map((item) => (
                <CountRow
                  key={item.priority}
                  label={getPriorityLabel(item.priority, t)}
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
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-950">
            {t('dashboard.sections.quickWorkspaces')}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {t('dashboard.sections.quickWorkspacesDescription')}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <WorkspaceCard
            title={t('navigation.items.aiWorkspace')}
            description={t('dashboard.workspaces.aiWorkspaceDescription')}
            href="/dashboard/ai-workspace"
          />
          <WorkspaceCard
            title={t('aiSuggestions.boardTitle')}
            description={t('dashboard.workspaces.aiSuggestionsDescription')}
            href="/dashboard/ai-suggestions"
          />
          <WorkspaceCard
            title={t('dashboard.quickLinks.leadPipeline')}
            description={t('dashboard.workspaces.leadPipelineDescription')}
            href="/dashboard/leads"
          />
          <WorkspaceCard
            title={t('dashboard.quickLinks.tasksBoard')}
            description={t('dashboard.workspaces.tasksBoardDescription')}
            href="/dashboard/tasks"
          />
          <WorkspaceCard
            title={t('navigation.items.syncedEmails')}
            description={t('dashboard.workspaces.syncedEmailsDescription')}
            href="/dashboard/external-sync/email-messages"
          />
          <WorkspaceCard
            title={t('navigation.items.syncedCalendar')}
            description={t('dashboard.workspaces.syncedCalendarDescription')}
            href="/dashboard/external-sync/calendar-events"
          />
        </div>
      </section>

      <ExternalSyncSnapshot
        externalSync={data.externalSync}
        isSyncingEmail={isSyncingEmail}
        isSyncingCalendar={isSyncingCalendar}
        syncActionMessage={syncActionMessage}
        syncActionError={syncActionError}
        onSyncEmail={handleSyncEmailMessages}
        onSyncCalendar={handleSyncCalendarEvents}
      />

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-slate-950">
                {t('dashboard.sections.taskFocus')}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {t('dashboard.sections.taskFocusDescription')}
              </p>
            </div>
            <Link
              href="/dashboard/tasks"
              className="text-sm font-medium text-blue-700 hover:text-blue-900"
            >
              {t('dashboard.labels.openBoard')}
            </Link>
          </div>

          <div className="mt-4 space-y-2">
            {data.tasks.pendingTasks.slice(0, 3).length > 0 ? (
              data.tasks.pendingTasks
                .slice(0, 3)
                .map((task) => <TaskPreview key={task.id} task={task} />)
            ) : (
              <p className="text-sm text-slate-500">
                {t('dashboard.messages.noPendingTasks')}
              </p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-950">
              {t('dashboard.sections.recentActivity')}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {t('dashboard.sections.recentActivityDescription')}
            </p>
          </div>

          <div className="mt-5 space-y-4">
            {data.recentActivity.recentActivity.length > 0 ? (
              data.recentActivity.recentActivity.map((event) => (
                <ActivityItem key={event.id} event={event} />
              ))
            ) : (
              <p className="text-sm text-slate-500">
                {t('dashboard.messages.noRecentActivity')}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
        <div className="flex flex-wrap gap-2">
          {[
            t('dashboard.safety.humanReviewRequiredForAi'),
            t('dashboard.safety.noEmailSent'),
            t('dashboard.safety.noDashboardGmailDraft'),
            t('dashboard.safety.noCrmRecords'),
          ].map((message) => (
            <Badge
              key={message}
              className="bg-white text-blue-800 ring-blue-200"
            >
              {message}
            </Badge>
          ))}
        </div>
      </section>
    </div>
  );
}
