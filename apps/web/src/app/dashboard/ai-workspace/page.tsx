'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import { useAuth } from '@/hooks/useAuth';
import {
  ApiClientError,
  getAiSuggestions,
  getExternalCalendarEvents,
  getExternalEmailMessages,
  syncExternalCalendarEvents,
  syncExternalEmailMessages,
} from '@/lib/api-client';
import { formatDateTime, formatEnumLabel } from '@/lib/formatters';
import { canUpdateCrm } from '@/lib/permissions';
import type {
  AiSuggestion,
  AiSuggestionStatus,
} from '@/types/ai-suggestions';
import type {
  ExternalCalendarEvent,
  ExternalEmailMessage,
} from '@/types/external-sync';

type WorkspaceData = {
  pendingSuggestions: AiSuggestion[];
  counts: {
    pending: number;
    accepted: number;
    rejected: number;
    replyDrafts: number;
    emailAnalysis: number;
    calendarAnalysis: number;
  };
  recentEmails: ExternalEmailMessage[];
  upcomingCalendarEvents: ExternalCalendarEvent[];
};

type WorkspaceErrors = {
  suggestions?: string;
  emails?: string;
  calendar?: string;
};

type SyncAction = 'gmail' | 'calendar';

function getStatusClasses(status: AiSuggestionStatus) {
  const classes: Record<AiSuggestionStatus, string> = {
    PENDING_REVIEW: 'bg-amber-50 text-amber-700 ring-amber-200',
    ACCEPTED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    EDITED_AND_ACCEPTED: 'bg-blue-50 text-blue-700 ring-blue-200',
    REJECTED: 'bg-rose-50 text-rose-700 ring-rose-200',
    EXPIRED: 'bg-slate-100 text-slate-700 ring-slate-200',
  };

  return classes[status];
}

function formatConfidence(value: number | null) {
  if (value === null) {
    return 'Not set';
  }

  return `${Math.round(value * 100)}%`;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiClientError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

function getFriendlySyncError(error: unknown) {
  if (error instanceof ApiClientError) {
    const message = error.message.toLowerCase();

    if (
      message.includes('scope') ||
      message.includes('permission') ||
      message.includes('permissions')
    ) {
      return 'Reconnect Google to grant the required permissions.';
    }

    if (
      message.includes('connected account') ||
      message.includes('connect') ||
      message.includes('reconnect') ||
      message.includes('google')
    ) {
      return 'Connect or reconnect Google before syncing external data.';
    }

    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Could not complete sync. Please try again.';
}

function getSuggestionContext(suggestion: AiSuggestion) {
  if (suggestion.externalEmailMessage) {
    return suggestion.externalEmailMessage.subject ?? 'Synced email';
  }

  if (suggestion.externalCalendarEvent) {
    return suggestion.externalCalendarEvent.summary ?? 'Synced calendar event';
  }

  if (suggestion.leadId) {
    return `Lead ${suggestion.leadId}`;
  }

  if (suggestion.entityType && suggestion.entityId) {
    return `${formatEnumLabel(suggestion.entityType)} ${suggestion.entityId}`;
  }

  return 'AI suggestion';
}

function formatSender(email: ExternalEmailMessage) {
  if (email.fromName && email.fromEmail) {
    return `${email.fromName} <${email.fromEmail}>`;
  }

  return email.fromEmail ?? email.fromName ?? 'Unknown sender';
}

function formatOrganizer(event: ExternalCalendarEvent) {
  if (event.organizerName && event.organizerEmail) {
    return `${event.organizerName} <${event.organizerEmail}>`;
  }

  return event.organizerEmail ?? event.organizerName ?? 'Unknown organizer';
}

function getTotalPages(meta: { totalPages?: number; pageCount?: number }) {
  return meta.totalPages ?? meta.pageCount ?? 1;
}

export default function AiWorkspacePage() {
  const { token, user } = useAuth();
  const canRunSync = canUpdateCrm(user);

  const [data, setData] = useState<WorkspaceData>({
    pendingSuggestions: [],
    counts: {
      pending: 0,
      accepted: 0,
      rejected: 0,
      replyDrafts: 0,
      emailAnalysis: 0,
      calendarAnalysis: 0,
    },
    recentEmails: [],
    upcomingCalendarEvents: [],
  });
  const [errors, setErrors] = useState<WorkspaceErrors>({});
  const [isLoading, setIsLoading] = useState(true);
  const [syncingAction, setSyncingAction] = useState<SyncAction | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncErrorMessage, setSyncErrorMessage] = useState<string | null>(null);

  const hasAnyData = useMemo(
    () =>
      data.pendingSuggestions.length > 0 ||
      data.recentEmails.length > 0 ||
      data.upcomingCalendarEvents.length > 0 ||
      Object.values(data.counts).some((count) => count > 0),
    [data],
  );

  const loadWorkspace = useCallback(async () => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrors({});

    const [
      pendingResult,
      acceptedResult,
      rejectedResult,
      replyDraftResult,
      emailAnalysisResult,
      calendarAnalysisResult,
      emailsResult,
      calendarResult,
    ] = await Promise.allSettled([
      getAiSuggestions(token, {
        page: 1,
        pageSize: 8,
        status: 'PENDING_REVIEW',
        sortBy: 'createdAt',
        sortOrder: 'desc',
      }),
      getAiSuggestions(token, {
        page: 1,
        pageSize: 1,
        status: 'ACCEPTED',
      }),
      getAiSuggestions(token, {
        page: 1,
        pageSize: 1,
        status: 'REJECTED',
      }),
      getAiSuggestions(token, {
        page: 1,
        pageSize: 1,
        type: 'GENERATE_EMAIL_REPLY_DRAFT',
      }),
      getAiSuggestions(token, {
        page: 1,
        pageSize: 1,
        type: 'ANALYZE_EXTERNAL_EMAIL',
      }),
      getAiSuggestions(token, {
        page: 1,
        pageSize: 1,
        type: 'ANALYZE_EXTERNAL_CALENDAR_EVENT',
      }),
      getExternalEmailMessages(token, {
        page: 1,
        pageSize: 5,
      }),
      getExternalCalendarEvents(token, {
        page: 1,
        pageSize: 5,
      }),
    ]);

    const nextErrors: WorkspaceErrors = {};

    if (pendingResult.status === 'rejected') {
      nextErrors.suggestions = getErrorMessage(
        pendingResult.reason,
        'Could not load AI suggestions.',
      );
    }

    if (emailsResult.status === 'rejected') {
      nextErrors.emails = getErrorMessage(
        emailsResult.reason,
        'Could not load synced emails.',
      );
    }

    if (calendarResult.status === 'rejected') {
      nextErrors.calendar = getErrorMessage(
        calendarResult.reason,
        'Could not load synced calendar events.',
      );
    }

    setData({
      pendingSuggestions:
        pendingResult.status === 'fulfilled' ? pendingResult.value.data : [],
      counts: {
        pending:
          pendingResult.status === 'fulfilled'
            ? pendingResult.value.meta.total
            : 0,
        accepted:
          acceptedResult.status === 'fulfilled'
            ? acceptedResult.value.meta.total
            : 0,
        rejected:
          rejectedResult.status === 'fulfilled'
            ? rejectedResult.value.meta.total
            : 0,
        replyDrafts:
          replyDraftResult.status === 'fulfilled'
            ? replyDraftResult.value.meta.total
            : 0,
        emailAnalysis:
          emailAnalysisResult.status === 'fulfilled'
            ? emailAnalysisResult.value.meta.total
            : 0,
        calendarAnalysis:
          calendarAnalysisResult.status === 'fulfilled'
            ? calendarAnalysisResult.value.meta.total
            : 0,
      },
      recentEmails:
        emailsResult.status === 'fulfilled' ? emailsResult.value.data : [],
      upcomingCalendarEvents:
        calendarResult.status === 'fulfilled' ? calendarResult.value.data : [],
    });
    setErrors(nextErrors);
    setIsLoading(false);
  }, [token]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  async function handleSync(action: SyncAction) {
    if (!token || !canRunSync) {
      return;
    }

    setSyncingAction(action);
    setSyncMessage(null);
    setSyncErrorMessage(null);

    try {
      if (action === 'gmail') {
        const result = await syncExternalEmailMessages(token);
        setSyncMessage(
          `Gmail sync completed. Fetched ${result.messagesFetched ?? 0} message(s), stored ${result.messagesStored ?? 0} message(s).`,
        );
      } else {
        const result = await syncExternalCalendarEvents(token);
        setSyncMessage(
          `Calendar sync completed. Fetched ${result.eventsFetched ?? 0} event(s), stored ${result.eventsStored ?? 0} event(s).`,
        );
      }

      await loadWorkspace();
    } catch (error) {
      setSyncErrorMessage(getFriendlySyncError(error));
    } finally {
      setSyncingAction(null);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="AI Workspace"
        title="Unified Review Hub"
        description="Review pending AI work, inspect synced metadata, and jump into the right queue without creating records or sending emails automatically."
      />

      <section className="grid gap-3 md:grid-cols-5">
        {[
          'AI suggestions require human review.',
          'AI uses synced metadata/snippets only where applicable.',
          'No email is sent automatically.',
          'No Gmail draft is created automatically from this workspace.',
          'No CRM records are created automatically.',
        ].map((message) => (
          <div
            key={message}
            className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm font-medium text-blue-900"
          >
            {message}
          </div>
        ))}
      </section>

      {syncMessage ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
          {syncMessage}
        </div>
      ) : null}

      {syncErrorMessage ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800">
          {syncErrorMessage}
        </div>
      ) : null}

      {!canRunSync ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Your role can view the workspace, but CRM write permissions are
          required to run manual sync actions.
        </div>
      ) : null}

      {isLoading ? <LoadingSkeleton rows={10} /> : null}

      {!isLoading && !hasAnyData && !Object.keys(errors).length ? (
        <EmptyState
          title="No AI workspace data yet"
          description="Connect Google, sync email or calendar metadata, then generate AI suggestions for human review."
        />
      ) : null}

      {!isLoading ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[
              ['Pending review', data.counts.pending],
              ['Accepted', data.counts.accepted],
              ['Rejected', data.counts.rejected],
              ['Reply draft suggestions', data.counts.replyDrafts],
              ['External email analysis', data.counts.emailAnalysis],
              ['External calendar analysis', data.counts.calendarAnalysis],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <p className="text-sm font-medium text-slate-500">{label}</p>
                <p className="mt-3 text-3xl font-semibold text-slate-950">
                  {value}
                </p>
              </div>
            ))}
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">
                    Pending AI Suggestions
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Latest items waiting for human review.
                  </p>
                </div>
                <Link
                  href="/dashboard/ai-suggestions"
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  View all
                </Link>
              </div>

              {errors.suggestions ? (
                <div className="mt-4">
                  <ErrorState message={errors.suggestions} />
                </div>
              ) : null}

              {!errors.suggestions && data.pendingSuggestions.length === 0 ? (
                <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  No pending suggestions.
                </div>
              ) : null}

              <div className="mt-4 space-y-3">
                {data.pendingSuggestions.map((suggestion) => (
                  <div
                    key={suggestion.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex flex-wrap gap-2">
                      <Badge className={getStatusClasses(suggestion.status)}>
                        {formatEnumLabel(suggestion.status)}
                      </Badge>
                      <Badge className="bg-indigo-50 text-indigo-700 ring-indigo-200">
                        {formatEnumLabel(suggestion.type)}
                      </Badge>
                    </div>

                    <h3 className="mt-3 font-semibold text-slate-950">
                      {suggestion.title ?? 'Untitled AI suggestion'}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      {getSuggestionContext(suggestion)}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      Confidence: {formatConfidence(suggestion.confidenceScore)}
                      {' · '}
                      Created: {formatDateTime(suggestion.createdAt)}
                    </p>

                    <Link
                      href={`/dashboard/ai-suggestions/${suggestion.id}`}
                      className="mt-3 inline-flex rounded-xl bg-slate-950 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
                    >
                      Review
                    </Link>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">
                    Quick Actions
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Safe navigation and manual sync controls.
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Link
                  href="/dashboard/ai-suggestions"
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-800 transition hover:bg-slate-100"
                >
                  Review AI Suggestions
                </Link>
                <Link
                  href="/dashboard/external-sync/email-messages"
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-800 transition hover:bg-slate-100"
                >
                  Open Synced Emails
                </Link>
                <Link
                  href="/dashboard/external-sync/calendar-events"
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-800 transition hover:bg-slate-100"
                >
                  Open Synced Calendar
                </Link>
                <button
                  type="button"
                  onClick={() => handleSync('gmail')}
                  disabled={syncingAction !== null || !canRunSync}
                  className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-left text-sm font-medium text-blue-900 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {syncingAction === 'gmail' ? 'Syncing Gmail...' : 'Sync Gmail'}
                </button>
                <button
                  type="button"
                  onClick={() => handleSync('calendar')}
                  disabled={syncingAction !== null || !canRunSync}
                  className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-left text-sm font-medium text-blue-900 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {syncingAction === 'calendar'
                    ? 'Syncing Calendar...'
                    : 'Sync Calendar'}
                </button>
              </div>
            </article>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">
                    Recent Synced Emails
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Latest Gmail metadata available for review.
                  </p>
                </div>
                <Link
                  href="/dashboard/external-sync/email-messages"
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Open
                </Link>
              </div>

              {errors.emails ? (
                <div className="mt-4">
                  <ErrorState message={errors.emails} />
                </div>
              ) : null}

              {!errors.emails && data.recentEmails.length === 0 ? (
                <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  No synced emails yet.
                </div>
              ) : null}

              <div className="mt-4 space-y-3">
                {data.recentEmails.map((email) => (
                  <div
                    key={email.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <h3 className="break-words font-semibold text-slate-950">
                      {email.subject ?? 'No subject'}
                    </h3>
                    <p className="mt-1 break-words text-sm text-slate-600">
                      From: {formatSender(email)}
                    </p>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
                      {email.snippet ?? 'No snippet available.'}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      Internal:{' '}
                      {email.internalDate
                        ? formatDateTime(email.internalDate)
                        : 'Not set'}
                      {' · '}
                      Synced: {formatDateTime(email.syncedAt)}
                    </p>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">
                    Upcoming Synced Calendar Events
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Calendar metadata ready for AI-assisted analysis.
                  </p>
                </div>
                <Link
                  href="/dashboard/external-sync/calendar-events"
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Open
                </Link>
              </div>

              {errors.calendar ? (
                <div className="mt-4">
                  <ErrorState message={errors.calendar} />
                </div>
              ) : null}

              {!errors.calendar && data.upcomingCalendarEvents.length === 0 ? (
                <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  No synced calendar events yet.
                </div>
              ) : null}

              <div className="mt-4 space-y-3">
                {data.upcomingCalendarEvents.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <h3 className="break-words font-semibold text-slate-950">
                      {event.summary ?? 'No title'}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      {event.startAt ? formatDateTime(event.startAt) : 'Not set'}
                      {' - '}
                      {event.endAt ? formatDateTime(event.endAt) : 'Not set'}
                    </p>
                    <p className="mt-2 break-words text-sm text-slate-600">
                      Location: {event.location ?? 'Not set'}
                    </p>
                    <p className="mt-1 break-words text-sm text-slate-600">
                      Organizer: {formatOrganizer(event)}
                    </p>
                  </div>
                ))}
              </div>
            </article>
          </section>
        </>
      ) : null}
    </div>
  );
}
