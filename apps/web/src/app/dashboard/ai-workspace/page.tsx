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
import { formatDateTime, formatEnumLabel, truncateText } from '@/lib/formatters';
import { canUpdateCrm } from '@/lib/permissions';
import type {
  AiSuggestion,
  AiSuggestionStatus,
  AiSuggestionType,
} from '@/types/ai-suggestions';
import type {
  ExternalCalendarEvent,
  ExternalEmailMessage,
} from '@/types/external-sync';

type WorkspaceData = {
  needsReview: AiSuggestion[];
  readyForAction: AiSuggestion[];
  completedSuggestions: AiSuggestion[];
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

const typeLabels: Partial<Record<AiSuggestionType, string>> = {
  SUGGEST_NEXT_STEPS: 'Lead next steps',
  ANALYZE_EXTERNAL_EMAIL: 'Email analysis',
  GENERATE_EMAIL_REPLY_DRAFT: 'Email reply draft',
  ANALYZE_EXTERNAL_CALENDAR_EVENT: 'Calendar analysis',
};

const appliedActionLabels: Record<string, string> = {
  UPDATE_LEAD_NEXT_STEP: 'Next step applied',
  CREATE_TASK: 'Task created',
  CREATE_TASK_FROM_EXTERNAL_EMAIL: 'Task created',
  CREATE_TASK_FROM_EXTERNAL_CALENDAR: 'Task created',
  CREATE_TASK_FROM_EXTERNAL_CALENDAR_EVENT: 'Task created',
  CREATE_NOTE: 'Note created',
  CREATE_NOTE_FROM_EXTERNAL_EMAIL: 'Note created',
  CREATE_NOTE_FROM_EXTERNAL_CALENDAR: 'Note created',
  CREATE_NOTE_FROM_EXTERNAL_CALENDAR_EVENT: 'Note created',
  CREATE_LEAD_FROM_EXTERNAL_EMAIL: 'Lead created',
  CREATE_LEAD_FROM_EXTERNAL_CALENDAR: 'Lead created',
  CREATE_LEAD_FROM_EXTERNAL_CALENDAR_EVENT: 'Lead created',
  CREATE_GMAIL_DRAFT_FROM_EMAIL_REPLY_SUGGESTION: 'Gmail draft created',
};

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

    const action = (appliedAction as Record<string, unknown>).action;

    return typeof action === 'string' ? action : [];
  });
}

function hasGmailDraftCreated(suggestion: AiSuggestion) {
  return (
    Boolean(getMetadataString(suggestion.metadataJson?.gmailDraftId)) ||
    getAppliedActionNames(suggestion).includes(
      'CREATE_GMAIL_DRAFT_FROM_EMAIL_REPLY_SUGGESTION',
    )
  );
}

function getAppliedLabels(suggestion: AiSuggestion) {
  const labels = new Set(
    getAppliedActionNames(suggestion)
      .map((action) => appliedActionLabels[action])
      .filter(Boolean),
  );

  if (hasGmailDraftCreated(suggestion)) {
    labels.add('Gmail draft created');
  }

  return Array.from(labels);
}

function hasCompletedAction(suggestion: AiSuggestion) {
  return getAppliedLabels(suggestion).length > 0;
}

function sortSuggestionsByCreatedAt(suggestions: AiSuggestion[]) {
  return [...suggestions].sort(
    (firstSuggestion, secondSuggestion) =>
      new Date(secondSuggestion.createdAt).getTime() -
      new Date(firstSuggestion.createdAt).getTime(),
  );
}

function getTypeLabel(type: AiSuggestionType) {
  return typeLabels[type] ?? formatEnumLabel(type);
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

function SuggestionCard({ suggestion }: { suggestion: AiSuggestion }) {
  const appliedLabels = getAppliedLabels(suggestion);

  return (
    <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap gap-2">
        <Badge className={getStatusClasses(suggestion.status)}>
          {formatEnumLabel(suggestion.status)}
        </Badge>
        <Badge className="bg-indigo-50 text-indigo-700 ring-indigo-200">
          {getTypeLabel(suggestion.type)}
        </Badge>
      </div>

      <h3 className="mt-3 font-semibold text-slate-950">
        {suggestion.title ?? 'Untitled AI suggestion'}
      </h3>
      <p className="mt-1 text-sm text-slate-600">
        {truncateText(getSuggestionContext(suggestion), 120)}
      </p>
      <p className="mt-2 text-xs text-slate-500">
        Confidence: {formatConfidence(suggestion.confidenceScore)}
        {' · '}
        Created: {formatDateTime(suggestion.createdAt)}
      </p>

      {appliedLabels.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {appliedLabels.map((label) => (
            <Badge
              key={label}
              className="bg-emerald-50 text-emerald-700 ring-emerald-200"
            >
              {label}
            </Badge>
          ))}
        </div>
      ) : null}

      <Link
        href={`/dashboard/ai-suggestions/${suggestion.id}`}
        className="mt-3 inline-flex text-sm font-medium text-blue-700 transition hover:text-blue-900"
      >
        View details
      </Link>
    </article>
  );
}

function SuggestionColumn({
  title,
  description,
  emptyMessage,
  suggestions,
}: {
  title: string;
  description: string;
  emptyMessage: string;
  suggestions: AiSuggestion[];
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200">
          {suggestions.length}
        </span>
      </div>

      {suggestions.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          {emptyMessage}
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        {suggestions.map((suggestion) => (
          <SuggestionCard key={suggestion.id} suggestion={suggestion} />
        ))}
      </div>
    </article>
  );
}

export default function AiWorkspacePage() {
  const { token, user } = useAuth();
  const canRunSync = canUpdateCrm(user);

  const [data, setData] = useState<WorkspaceData>({
    needsReview: [],
    readyForAction: [],
    completedSuggestions: [],
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
      data.needsReview.length > 0 ||
      data.readyForAction.length > 0 ||
      data.completedSuggestions.length > 0 ||
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
      editedAcceptedResult,
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
        pageSize: 12,
        status: 'ACCEPTED',
        sortBy: 'createdAt',
        sortOrder: 'desc',
      }),
      getAiSuggestions(token, {
        page: 1,
        pageSize: 12,
        status: 'EDITED_AND_ACCEPTED',
        sortBy: 'createdAt',
        sortOrder: 'desc',
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

    const reviewedSuggestions = sortSuggestionsByCreatedAt([
      ...(acceptedResult.status === 'fulfilled' ? acceptedResult.value.data : []),
      ...(editedAcceptedResult.status === 'fulfilled'
        ? editedAcceptedResult.value.data
        : []),
    ]);

    setData({
      needsReview:
        pendingResult.status === 'fulfilled' ? pendingResult.value.data : [],
      readyForAction: reviewedSuggestions
        .filter((suggestion) => !hasCompletedAction(suggestion))
        .slice(0, 8),
      completedSuggestions: reviewedSuggestions
        .filter(hasCompletedAction)
        .slice(0, 8),
      counts: {
        pending:
          pendingResult.status === 'fulfilled'
            ? pendingResult.value.meta.total
            : 0,
        accepted:
          (acceptedResult.status === 'fulfilled'
            ? acceptedResult.value.meta.total
            : 0) +
          (editedAcceptedResult.status === 'fulfilled'
            ? editedAcceptedResult.value.meta.total
            : 0),
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
    void loadWorkspace();
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
          `Gmail sync completed. Fetched ${
            result.messagesFetched ?? 0
          } message(s), stored ${result.messagesStored ?? 0} message(s).`,
        );
      } else {
        const result = await syncExternalCalendarEvents(token);
        setSyncMessage(
          `Calendar sync completed. Fetched ${
            result.eventsFetched ?? 0
          } event(s), stored ${result.eventsStored ?? 0} event(s).`,
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
        description="A board-like workspace for AI review, safe sync controls, and synced input context. Cards navigate to detail pages; they do not apply CRM changes or send email."
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
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            {[
              ['Pending review', data.counts.pending],
              ['Accepted', data.counts.accepted],
              ['Rejected', data.counts.rejected],
              ['Reply drafts', data.counts.replyDrafts],
              ['Email analysis', data.counts.emailAnalysis],
              ['Calendar analysis', data.counts.calendarAnalysis],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {label}
                </p>
                <p className="mt-3 text-3xl font-semibold text-slate-950">
                  {value}
                </p>
              </div>
            ))}
          </section>

          {errors.suggestions ? (
            <ErrorState message={errors.suggestions} />
          ) : null}

          <section className="grid gap-4 xl:grid-cols-3">
            <SuggestionColumn
              title="Needs Review"
              description="Pending AI suggestions waiting for a human decision."
              emptyMessage="No pending suggestions."
              suggestions={data.needsReview}
            />
            <SuggestionColumn
              title="Ready for Action"
              description="Accepted suggestions that have no completed action yet."
              emptyMessage="No accepted suggestions waiting for action."
              suggestions={data.readyForAction}
            />
            <SuggestionColumn
              title="Completed"
              description="Suggestions with applied CRM actions or Gmail draft creation."
              emptyMessage="No completed AI actions yet."
              suggestions={data.completedSuggestions}
            />
          </section>

          <section className="grid gap-4 xl:grid-cols-[1fr_2fr]">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  Quick Actions
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Safe navigation and manual sync controls.
                </p>
              </div>

              <div className="mt-4 grid gap-3">
                <Link
                  href="/dashboard/ai-suggestions"
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-800 transition hover:bg-slate-100"
                >
                  Open AI Suggestions Board
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
                  onClick={() => void handleSync('gmail')}
                  disabled={syncingAction !== null || !canRunSync}
                  className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-left text-sm font-medium text-blue-900 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {syncingAction === 'gmail' ? 'Syncing Gmail...' : 'Sync Gmail'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleSync('calendar')}
                  disabled={syncingAction !== null || !canRunSync}
                  className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-left text-sm font-medium text-blue-900 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {syncingAction === 'calendar'
                    ? 'Syncing Calendar...'
                    : 'Sync Calendar'}
                </button>
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  Recent Synced Inputs
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Latest email and calendar metadata available for AI review.
                </p>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold text-slate-950">
                      Synced Emails
                    </h3>
                    <Link
                      href="/dashboard/external-sync/email-messages"
                      className="text-sm font-medium text-blue-700 transition hover:text-blue-900"
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
                    <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">
                      No synced emails yet.
                    </div>
                  ) : null}

                  <div className="mt-4 space-y-3">
                    {data.recentEmails.map((email) => (
                      <div
                        key={email.id}
                        className="rounded-xl border border-slate-200 bg-white p-4"
                      >
                        <h4 className="break-words font-semibold text-slate-950">
                          {email.subject ?? 'No subject'}
                        </h4>
                        <p className="mt-1 break-words text-sm text-slate-600">
                          From: {formatSender(email)}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          {truncateText(email.snippet, 120) ||
                            'No snippet available.'}
                        </p>
                        <p className="mt-2 text-xs text-slate-500">
                          Synced: {formatDateTime(email.syncedAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold text-slate-950">
                      Synced Calendar
                    </h3>
                    <Link
                      href="/dashboard/external-sync/calendar-events"
                      className="text-sm font-medium text-blue-700 transition hover:text-blue-900"
                    >
                      Open
                    </Link>
                  </div>

                  {errors.calendar ? (
                    <div className="mt-4">
                      <ErrorState message={errors.calendar} />
                    </div>
                  ) : null}

                  {!errors.calendar &&
                  data.upcomingCalendarEvents.length === 0 ? (
                    <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">
                      No synced calendar events yet.
                    </div>
                  ) : null}

                  <div className="mt-4 space-y-3">
                    {data.upcomingCalendarEvents.map((event) => (
                      <div
                        key={event.id}
                        className="rounded-xl border border-slate-200 bg-white p-4"
                      >
                        <h4 className="break-words font-semibold text-slate-950">
                          {event.summary ?? 'No title'}
                        </h4>
                        <p className="mt-1 text-sm text-slate-600">
                          {event.startAt
                            ? formatDateTime(event.startAt)
                            : 'Not set'}
                        </p>
                        <p className="mt-2 break-words text-sm text-slate-600">
                          Organizer: {formatOrganizer(event)}
                        </p>
                        <p className="mt-1 break-words text-sm text-slate-600">
                          Location: {event.location ?? 'Not set'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </article>
          </section>
        </>
      ) : null}
    </div>
  );
}
