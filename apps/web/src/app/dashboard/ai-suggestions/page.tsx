// FILE: apps/web/src/app/dashboard/ai-suggestions/page.tsx
'use client';

import Link from 'next/link';
import type { FormEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import { useAuth } from '@/hooks/useAuth';
import { ApiClientError, getAiSuggestions } from '@/lib/api-client';
import { formatDateTime, formatEnumLabel, truncateText } from '@/lib/formatters';
import type {
  AiSuggestion,
  AiSuggestionStatus,
  AiSuggestionType,
} from '@/types/ai-suggestions';

const statusOptions: Array<AiSuggestionStatus | ''> = [
  '',
  'PENDING_REVIEW',
  'ACCEPTED',
  'EDITED_AND_ACCEPTED',
  'REJECTED',
  'EXPIRED',
];

const typeOptions: Array<AiSuggestionType | ''> = [
  '',
  'SUGGEST_NEXT_STEPS',
  'GENERATE_EMAIL_REPLY_DRAFT',
  'ANALYZE_EXTERNAL_EMAIL',
  'ANALYZE_EXTERNAL_CALENDAR_EVENT',
];

const statusLabels: Record<AiSuggestionStatus, string> = {
  PENDING_REVIEW: 'Pending review',
  ACCEPTED: 'Accepted',
  EDITED_AND_ACCEPTED: 'Edited and accepted',
  REJECTED: 'Rejected',
  EXPIRED: 'Expired',
};

const typeLabels: Partial<Record<AiSuggestionType, string>> = {
  SUGGEST_NEXT_STEPS: 'Lead next steps',
  ANALYZE_EXTERNAL_EMAIL: 'Email analysis',
  GENERATE_EMAIL_REPLY_DRAFT: 'Email reply draft',
  ANALYZE_EXTERNAL_CALENDAR_EVENT: 'Calendar analysis',
  ANALYZE_MESSAGE: 'Message analysis',
  GENERATE_REPLY: 'Reply generation',
  EXTRACT_IMPORTANT_DATA: 'Data extraction',
  SUMMARIZE_LEAD: 'Lead summary',
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

function getStatusLabel(status: AiSuggestionStatus) {
  return statusLabels[status] ?? formatEnumLabel(status);
}

function getTypeLabel(type: AiSuggestionType) {
  return typeLabels[type] ?? formatEnumLabel(type);
}

function getConfidenceLabel(suggestion: AiSuggestion) {
  if (suggestion.confidenceScore === null) {
    return 'Not set';
  }

  return `${Math.round(suggestion.confidenceScore * 100)}%`;
}

function getSuggestionContextLabel(suggestion: AiSuggestion) {
  if (suggestion.type === 'ANALYZE_EXTERNAL_EMAIL') {
    return 'Synced email metadata';
  }

  if (suggestion.type === 'GENERATE_EMAIL_REPLY_DRAFT') {
    return 'Reply draft review';
  }

  if (suggestion.type === 'ANALYZE_EXTERNAL_CALENDAR_EVENT') {
    return 'Synced calendar metadata';
  }

  if (suggestion.leadId) {
    return 'Lead recommendation';
  }

  return 'AI suggestion';
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

function hasAppliedAction(suggestion: AiSuggestion, action: string) {
  return getAppliedActionNames(suggestion).includes(action);
}

function hasGmailDraftCreated(suggestion: AiSuggestion) {
  return (
    Boolean(getMetadataString(suggestion.metadataJson?.gmailDraftId)) ||
    hasAppliedAction(
      suggestion,
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

function getReplyDraftSubject(suggestion: AiSuggestion) {
  return (
    getMetadataString(suggestion.metadataJson?.suggestedSubject) ??
    suggestion.externalEmailMessage?.subject ??
    'No subject'
  );
}

function getEmailSender(suggestion: AiSuggestion) {
  const senderName = getMetadataString(
    suggestion.externalEmailMessage?.fromName,
  );
  const senderEmail = getMetadataString(
    suggestion.externalEmailMessage?.fromEmail,
  );

  if (senderName && senderEmail) {
    return `${senderName} <${senderEmail}>`;
  }

  return senderEmail ?? senderName ?? 'Unknown sender';
}

function getAttendeesCount(value: unknown) {
  if (Array.isArray(value)) {
    return value.length;
  }

  return null;
}

function getSuggestionTitle(suggestion: AiSuggestion) {
  if (suggestion.title) {
    return suggestion.title;
  }

  if (suggestion.type === 'GENERATE_EMAIL_REPLY_DRAFT') {
    return getReplyDraftSubject(suggestion);
  }

  if (suggestion.externalEmailMessage?.subject) {
    return suggestion.externalEmailMessage.subject;
  }

  if (suggestion.externalCalendarEvent?.summary) {
    return suggestion.externalCalendarEvent.summary;
  }

  return 'Untitled AI suggestion';
}

function renderSourcePreview(suggestion: AiSuggestion) {
  if (
    suggestion.type === 'ANALYZE_EXTERNAL_EMAIL' ||
    suggestion.type === 'GENERATE_EMAIL_REPLY_DRAFT'
  ) {
    const email = suggestion.externalEmailMessage;
    const subject = email?.subject ?? 'No subject';
    const snippet =
      truncateText(email?.snippet, 180) ||
      truncateText(suggestion.outputText, 180) ||
      'No snippet available.';

    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Original email
            </p>
            <p className="mt-1 font-medium text-slate-950">{subject}</p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Sender
            </p>
            <p className="mt-1 break-words text-sm text-slate-700">
              {getEmailSender(suggestion)}
            </p>
          </div>
        </div>

        {suggestion.type === 'GENERATE_EMAIL_REPLY_DRAFT' ? (
          <div className="mt-4 rounded-lg border border-blue-100 bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
              Suggested subject
            </p>
            <p className="mt-1 text-sm font-medium text-slate-950">
              {getReplyDraftSubject(suggestion)}
            </p>
          </div>
        ) : null}

        <p className="mt-4 text-sm leading-6 text-slate-600">{snippet}</p>
      </div>
    );
  }

  if (suggestion.type === 'ANALYZE_EXTERNAL_CALENDAR_EVENT') {
    const event = suggestion.externalCalendarEvent;
    const attendeesCount = getAttendeesCount(event?.attendeesJson);

    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Calendar event
            </p>
            <p className="mt-1 font-medium text-slate-950">
              {event?.summary ?? 'No title'}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Organizer
            </p>
            <p className="mt-1 break-words text-sm text-slate-700">
              {event?.organizerName ||
                event?.organizerEmail ||
                'Unknown organizer'}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Starts
            </p>
            <p className="mt-1 text-sm text-slate-700">
              {formatDateTime(event?.startAt)}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Attendees
            </p>
            <p className="mt-1 text-sm text-slate-700">
              {attendeesCount === null ? 'Not set' : attendeesCount}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Source context
      </p>
      <p className="mt-1 text-sm text-slate-700">
        {suggestion.leadId
          ? `Lead recommendation for lead ${suggestion.leadId}`
          : suggestion.entityType && suggestion.entityId
            ? `${formatEnumLabel(suggestion.entityType)} / ${suggestion.entityId}`
            : 'No linked source context available.'}
      </p>
    </div>
  );
}

export default function AiSuggestionsPage() {
  const { token } = useAuth();

  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([]);
  const [status, setStatus] = useState<AiSuggestionStatus | ''>('');
  const [type, setType] = useState<AiSuggestionType | ''>('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalSuggestions, setTotalSuggestions] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadSuggestions = useCallback(async () => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await getAiSuggestions(token, {
        page,
        pageSize: 10,
        search: search || undefined,
        status: status || undefined,
        type: type || undefined,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      setSuggestions(response.data);
      setTotalPages(response.meta.totalPages || 1);
      setTotalSuggestions(response.meta.total || response.data.length);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Could not load AI suggestions.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [page, search, status, token, type]);

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  const hasFilters = useMemo(
    () => Boolean(status || type || search),
    [search, status, type],
  );

  const stats = useMemo(() => {
    const pending = suggestions.filter(
      (suggestion) => suggestion.status === 'PENDING_REVIEW',
    ).length;
    const accepted = suggestions.filter((suggestion) =>
      ['ACCEPTED', 'EDITED_AND_ACCEPTED'].includes(suggestion.status),
    ).length;
    const rejected = suggestions.filter(
      (suggestion) => suggestion.status === 'REJECTED',
    ).length;
    const applied = suggestions.filter(
      (suggestion) => getAppliedLabels(suggestion).length > 0,
    ).length;
    const replyDrafts = suggestions.filter(
      (suggestion) => suggestion.type === 'GENERATE_EMAIL_REPLY_DRAFT',
    ).length;
    const externalSources = suggestions.filter((suggestion) =>
      ['ANALYZE_EXTERNAL_EMAIL', 'ANALYZE_EXTERNAL_CALENDAR_EVENT'].includes(
        suggestion.type,
      ),
    ).length;

    return [
      { label: 'Pending review', value: pending, tone: 'text-amber-700' },
      { label: 'Accepted', value: accepted, tone: 'text-emerald-700' },
      { label: 'Rejected', value: rejected, tone: 'text-rose-700' },
      { label: 'Completed actions', value: applied, tone: 'text-blue-700' },
      { label: 'Reply drafts', value: replyDrafts, tone: 'text-indigo-700' },
      { label: 'External sources', value: externalSources, tone: 'text-slate-700' },
    ];
  }, [suggestions]);

  function clearFilters() {
    setStatus('');
    setType('');
    setSearch('');
    setSearchInput('');
    setPage(1);
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="AI Review"
        title="AI Suggestions"
        description="Review AI-generated recommendations before applying anything. Human approval is required, and this queue never sends email or changes CRM records automatically."
        actions={
          <>
            <Link
              href="/dashboard/ai-workspace"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              AI Workspace
            </Link>
            <Link
              href="/dashboard/external-sync/email-messages"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Synced Emails
            </Link>
            <Link
              href="/dashboard/external-sync/calendar-events"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Synced Calendar
            </Link>
          </>
        }
      />

      <section className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
        <div className="grid gap-3 md:grid-cols-4">
          {[
            'Human review required',
            'No automatic email sending',
            'No automatic CRM changes',
            'Details page handles apply actions',
          ].map((message) => (
            <div
              key={message}
              className="rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm font-medium text-blue-800"
            >
              {message}
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {stats.map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {item.label}
            </p>
            <p className={`mt-2 text-2xl font-semibold ${item.tone}`}>
              {item.value}
            </p>
            <p className="mt-1 text-xs text-slate-500">Current page</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <form
          onSubmit={handleSearchSubmit}
          className="grid gap-4 lg:grid-cols-[1fr_220px_260px_140px]"
        >
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Search</span>
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search title, output, or source context"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Status</span>
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as AiSuggestionStatus | '');
                setPage(1);
              }}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            >
              {statusOptions.map((option) => (
                <option key={option || 'all'} value={option}>
                  {option ? getStatusLabel(option) : 'All statuses'}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Type</span>
            <select
              value={type}
              onChange={(event) => {
                setType(event.target.value as AiSuggestionType | '');
                setPage(1);
              }}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            >
              {typeOptions.map((option) => (
                <option key={option || 'all'} value={option}>
                  {option ? getTypeLabel(option) : 'All types'}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="flex-1 rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
            >
              Search
            </button>
            <button
              type="button"
              onClick={clearFilters}
              disabled={!hasFilters}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clear
            </button>
          </div>
        </form>
      </section>

      {isLoading ? <LoadingSkeleton rows={8} /> : null}

      {!isLoading && errorMessage ? (
        <div className="space-y-3">
          <ErrorState message={errorMessage} />
          <button
            type="button"
            onClick={loadSuggestions}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Retry
          </button>
        </div>
      ) : null}

      {!isLoading && !errorMessage && suggestions.length === 0 ? (
        <div className="space-y-4">
          <EmptyState
            title={
              hasFilters
                ? 'No suggestions match these filters'
                : 'No AI suggestions yet'
            }
            description={
              hasFilters
                ? 'Try clearing filters or searching for a different source context.'
                : 'Generate suggestions from synced emails, synced calendar events, or lead detail pages to start reviewing AI-assisted recommendations.'
            }
          />

          <div className="flex flex-wrap justify-center gap-2">
            {hasFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Clear filters
              </button>
            ) : null}
            <Link
              href="/dashboard/ai-workspace"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Open AI Workspace
            </Link>
            <Link
              href="/dashboard/external-sync/email-messages"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Open Synced Emails
            </Link>
            <Link
              href="/dashboard/external-sync/calendar-events"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Open Synced Calendar
            </Link>
          </div>
        </div>
      ) : null}

      {!isLoading && !errorMessage && suggestions.length > 0 ? (
        <section className="space-y-4">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                Review queue
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Showing {suggestions.length} of {totalSuggestions} suggestions
              </p>
            </div>
          </div>

          {suggestions.map((suggestion) => {
            const appliedLabels = getAppliedLabels(suggestion);
            const isPending = suggestion.status === 'PENDING_REVIEW';

            return (
              <article
                key={suggestion.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:shadow-md"
              >
                <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
                  <div className="min-w-0 flex-1 space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={getStatusClasses(suggestion.status)}>
                        {getStatusLabel(suggestion.status)}
                      </Badge>

                      <Badge className="bg-indigo-50 text-indigo-700 ring-indigo-200">
                        {getTypeLabel(suggestion.type)}
                      </Badge>

                      <Badge className="bg-slate-100 text-slate-700 ring-slate-200">
                        Confidence: {getConfidenceLabel(suggestion)}
                      </Badge>

                      <Badge className="bg-blue-50 text-blue-700 ring-blue-200">
                        {getSuggestionContextLabel(suggestion)}
                      </Badge>

                      {hasGmailDraftCreated(suggestion) ? (
                        <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200">
                          Gmail draft created
                        </Badge>
                      ) : null}
                    </div>

                    <div>
                      <Link
                        href={`/dashboard/ai-suggestions/${suggestion.id}`}
                        className="text-xl font-semibold text-slate-950 transition hover:text-blue-700"
                      >
                        {getSuggestionTitle(suggestion)}
                      </Link>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                        <span>Created {formatDateTime(suggestion.createdAt)}</span>
                        {suggestion.reviewedAt ? (
                          <span>
                            Reviewed {formatDateTime(suggestion.reviewedAt)}
                          </span>
                        ) : null}
                        <span>Provider: {suggestion.provider}</span>
                        {suggestion.metadataJson?.model ? (
                          <span>Model: {suggestion.metadataJson.model}</span>
                        ) : null}
                      </div>
                    </div>

                    {renderSourcePreview(suggestion)}

                    {suggestion.outputText ? (
                      <p className="max-w-4xl text-sm leading-6 text-slate-600">
                        {truncateText(suggestion.outputText, 220)}
                      </p>
                    ) : null}

                    {appliedLabels.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
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
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
                    {suggestion.leadId ? (
                      <Link
                        href={`/dashboard/leads/${suggestion.leadId}`}
                        className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        View lead
                      </Link>
                    ) : null}

                    <Link
                      href={`/dashboard/ai-suggestions/${suggestion.id}`}
                      className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
                    >
                      {isPending ? 'Review' : 'View details'}
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}

          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((currentPage) => currentPage - 1)}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>

            <span className="text-sm text-slate-500">
              Page {page} of {totalPages}
            </span>

            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((currentPage) => currentPage + 1)}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
