'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import { useAuth } from '@/hooks/useAuth';
import {
  analyzeExternalCalendarEvent,
  ApiClientError,
  getAiSuggestions,
  getExternalCalendarEvents,
  syncExternalCalendarEvents,
} from '@/lib/api-client';
import { formatDateTime, formatEnumLabel } from '@/lib/formatters';
import { canUpdateCrm } from '@/lib/permissions';
import type { AiSuggestion, AiSuggestionStatus } from '@/types/ai-suggestions';
import type { ExternalCalendarEvent } from '@/types/external-sync';

type CalendarActionState = {
  isAnalyzing: boolean;
  errorMessage: string | null;
  analysisSuggestionId?: string;
};

const PAGE_SIZE = 10;
const SUGGESTIONS_PAGE_SIZE = 100;

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

function getCalendarActionState(
  states: Record<string, CalendarActionState>,
  eventId: string,
) {
  return (
    states[eventId] ?? {
      isAnalyzing: false,
      errorMessage: null,
    }
  );
}

function formatOrganizer(event: ExternalCalendarEvent) {
  if (event.organizerName && event.organizerEmail) {
    return `${event.organizerName} <${event.organizerEmail}>`;
  }

  return event.organizerEmail ?? event.organizerName ?? 'Unknown organizer';
}

function getAttendeesCount(attendeesJson: unknown) {
  if (Array.isArray(attendeesJson)) {
    return attendeesJson.length;
  }

  if (
    attendeesJson &&
    typeof attendeesJson === 'object' &&
    'attendees' in attendeesJson &&
    Array.isArray((attendeesJson as { attendees?: unknown }).attendees)
  ) {
    return (attendeesJson as { attendees: unknown[] }).attendees.length;
  }

  return null;
}

function getFriendlyActionError(error: unknown) {
  if (error instanceof ApiClientError) {
    const message = error.message.toLowerCase();

    if (error.status === 409) {
      return 'An AI suggestion already exists for this calendar event. Open it from the existing suggestion link.';
    }

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
      return 'Connect or reconnect Google before syncing calendar events.';
    }
  }

  return 'Could not complete this AI action. Please try again.';
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
      return 'Connect or reconnect Google before syncing calendar events.';
    }

    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Could not sync calendar events. Please try again.';
}

export default function ExternalCalendarEventsPage() {
  const { token, user } = useAuth();

  const [events, setEvents] = useState<ExternalCalendarEvent[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEvents, setTotalEvents] = useState(0);
  const [searchDraft, setSearchDraft] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncErrorMessage, setSyncErrorMessage] = useState<string | null>(null);
  const [eventActionStates, setEventActionStates] = useState<
    Record<string, CalendarActionState>
  >({});
  const [analysisSuggestionsByEventId, setAnalysisSuggestionsByEventId] =
    useState<Record<string, AiSuggestion>>({});

  const canRunWriteActions = canUpdateCrm(user);

  const loadExistingCalendarSuggestions = useCallback(async () => {
    if (!token) {
      return;
    }

    const response = await getAiSuggestions(token, {
      page: 1,
      pageSize: SUGGESTIONS_PAGE_SIZE,
      type: 'ANALYZE_EXTERNAL_CALENDAR_EVENT',
      entityType: 'EXTERNAL_CALENDAR_EVENT',
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    const nextAnalysisSuggestions: Record<string, AiSuggestion> = {};

    response.data.forEach((suggestion) => {
      if (suggestion.externalCalendarEventId) {
        nextAnalysisSuggestions[suggestion.externalCalendarEventId] =
          suggestion;
      }
    });

    setAnalysisSuggestionsByEventId(nextAnalysisSuggestions);

    return {
      analysisSuggestionsByEventId: nextAnalysisSuggestions,
    };
  }, [token]);

  const loadEvents = useCallback(async () => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await getExternalCalendarEvents(token, {
        page,
        pageSize: PAGE_SIZE,
        q: searchQuery || undefined,
      });
      const responseTotalPages =
        response.meta.totalPages ?? response.meta.pageCount ?? 1;

      setEvents(response.data);
      setTotalEvents(response.meta.total);
      setTotalPages(Math.max(responseTotalPages, 1));
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Could not load synced calendar events.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [page, searchQuery, token]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    loadExistingCalendarSuggestions().catch(() => {
      // Existing suggestion links should not block calendar event listing.
    });
  }, [loadExistingCalendarSuggestions]);

  const hasSearch = useMemo(() => Boolean(searchQuery), [searchQuery]);

  function updateEventActionState(
    eventId: string,
    updater: (current: CalendarActionState) => CalendarActionState,
  ) {
    setEventActionStates((currentStates) => ({
      ...currentStates,
      [eventId]: updater(getCalendarActionState(currentStates, eventId)),
    }));
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearchQuery(searchDraft.trim());
  }

  function clearSearch() {
    setSearchDraft('');
    setSearchQuery('');
    setPage(1);
  }

  async function handleSyncCalendar() {
    if (!token || !canRunWriteActions) {
      return;
    }

    setIsSyncing(true);
    setSyncMessage(null);
    setSyncErrorMessage(null);

    try {
      const result = await syncExternalCalendarEvents(token);
      const fetched = result.eventsFetched ?? 0;
      const stored = result.eventsStored ?? 0;

      setSyncMessage(
        `Calendar sync completed. Fetched ${fetched} event(s), stored ${stored} event(s).`,
      );
      setPage(1);
      await loadEvents();
      await loadExistingCalendarSuggestions();
    } catch (error) {
      setSyncErrorMessage(getFriendlySyncError(error));
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleAnalyzeEvent(calendarEventId: string) {
    if (!token || !canRunWriteActions) {
      return;
    }

    updateEventActionState(calendarEventId, (current) => ({
      ...current,
      isAnalyzing: true,
      errorMessage: null,
    }));

    try {
      const suggestion = await analyzeExternalCalendarEvent(
        token,
        calendarEventId,
      );

      setAnalysisSuggestionsByEventId((current) => ({
        ...current,
        [calendarEventId]: suggestion,
      }));

      updateEventActionState(calendarEventId, (current) => ({
        ...current,
        isAnalyzing: false,
        errorMessage: null,
        analysisSuggestionId: suggestion.id,
      }));
    } catch (error) {
      let refreshedSuggestions:
        | Awaited<ReturnType<typeof loadExistingCalendarSuggestions>>
        | undefined;

      if (error instanceof ApiClientError && error.status === 409) {
        refreshedSuggestions = await loadExistingCalendarSuggestions();
      }

      const existingSuggestion =
        refreshedSuggestions?.analysisSuggestionsByEventId[calendarEventId];

      updateEventActionState(calendarEventId, (current) => ({
        ...current,
        isAnalyzing: false,
        errorMessage: getFriendlyActionError(error),
        ...(existingSuggestion
          ? { analysisSuggestionId: existingSuggestion.id }
          : {}),
      }));
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="AI Calendar"
        title="Synced Calendar Events"
        description="View synced Google Calendar metadata and create AI calendar analysis suggestions for human review."
        actions={
          <button
            type="button"
            onClick={handleSyncCalendar}
            disabled={isSyncing || !canRunWriteActions}
            className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSyncing ? 'Syncing Calendar...' : 'Sync Calendar'}
          </button>
        }
      />

      <section className="grid gap-3 md:grid-cols-5">
        {[
          'AI uses synced calendar metadata only.',
          'No emails are sent automatically.',
          'No CRM records are created automatically.',
          'No tasks or notes are created automatically.',
          'Generated suggestions must be reviewed by a human.',
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

      {!canRunWriteActions ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Your role can view synced calendar events, but CRM write permissions
          are required to sync Calendar or create AI suggestions.
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <form
          onSubmit={handleSearchSubmit}
          className="flex flex-col gap-3 md:flex-row md:items-end"
        >
          <label className="flex-1 space-y-2">
            <span className="text-sm font-medium text-slate-700">
              Search synced calendar events
            </span>
            <input
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Search summary, location, organizer, or description"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
          </label>

          <button
            type="submit"
            className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
          >
            Search
          </button>

          <button
            type="button"
            onClick={clearSearch}
            disabled={!hasSearch && !searchDraft}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Clear
          </button>
        </form>
      </section>

      {isLoading ? <LoadingSkeleton rows={8} /> : null}

      {!isLoading && errorMessage ? <ErrorState message={errorMessage} /> : null}

      {!isLoading && !errorMessage && events.length === 0 ? (
        <EmptyState
          title="No synced calendar events found"
          description="Run a manual Calendar sync or adjust your search to review synced calendar metadata."
        />
      ) : null}

      {!isLoading && !errorMessage && events.length > 0 ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>
              Showing page {page} of {totalPages}
            </span>
            <span>{totalEvents} synced calendar event(s)</span>
          </div>

          {events.map((event) => {
            const actionState = getCalendarActionState(
              eventActionStates,
              event.id,
            );
            const analysisSuggestion =
              analysisSuggestionsByEventId[event.id] ??
              (actionState.analysisSuggestionId
                ? {
                    id: actionState.analysisSuggestionId,
                    status: 'PENDING_REVIEW' as AiSuggestionStatus,
                  }
                : null);
            const attendeesCount = getAttendeesCount(event.attendeesJson);

            return (
              <article
                key={event.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
                  <div className="min-w-0 flex-1 space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="bg-blue-50 text-blue-700 ring-blue-200">
                        {formatEnumLabel(event.provider)}
                      </Badge>

                      {event.status ? (
                        <Badge className="bg-slate-100 text-slate-700 ring-slate-200">
                          {formatEnumLabel(event.status)}
                        </Badge>
                      ) : null}

                      {event.connectedAccount ? (
                        <Badge className="bg-slate-100 text-slate-700 ring-slate-200">
                          {event.connectedAccount.displayName ||
                            event.connectedAccount.email}
                        </Badge>
                      ) : null}
                    </div>

                    <div>
                      <h2 className="break-words text-lg font-semibold text-slate-950">
                        {event.summary ?? 'No title'}
                      </h2>
                      <p className="mt-1 break-words text-sm text-slate-600">
                        Organizer: {formatOrganizer(event)}
                      </p>
                    </div>

                    {event.description ? (
                      <p className="line-clamp-3 max-w-4xl text-sm leading-6 text-slate-600">
                        {event.description}
                      </p>
                    ) : null}

                    <div className="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
                      <div>
                        <p className="font-medium text-slate-950">Start</p>
                        <p className="mt-1 text-slate-600">
                          {event.startAt ? formatDateTime(event.startAt) : 'Not set'}
                        </p>
                      </div>

                      <div>
                        <p className="font-medium text-slate-950">End</p>
                        <p className="mt-1 text-slate-600">
                          {event.endAt ? formatDateTime(event.endAt) : 'Not set'}
                        </p>
                      </div>

                      <div>
                        <p className="font-medium text-slate-950">Location</p>
                        <p className="mt-1 break-words text-slate-600">
                          {event.location ?? 'Not set'}
                        </p>
                      </div>

                      <div>
                        <p className="font-medium text-slate-950">
                          Attendees
                        </p>
                        <p className="mt-1 text-slate-600">
                          {attendeesCount ?? 'Not set'}
                        </p>
                      </div>

                      <div>
                        <p className="font-medium text-slate-950">
                          Synced at
                        </p>
                        <p className="mt-1 text-slate-600">
                          {formatDateTime(event.syncedAt)}
                        </p>
                      </div>

                      <div>
                        <p className="font-medium text-slate-950">
                          Calendar ID
                        </p>
                        <p className="mt-1 break-all text-slate-500">
                          {event.externalCalendarId}
                        </p>
                      </div>

                      <div>
                        <p className="font-medium text-slate-950">Event ID</p>
                        <p className="mt-1 break-all text-slate-500">
                          {event.externalEventId}
                        </p>
                      </div>

                      <div>
                        <p className="font-medium text-slate-950">iCal UID</p>
                        <p className="mt-1 break-all text-slate-500">
                          {event.iCalUid ?? 'Not set'}
                        </p>
                      </div>
                    </div>

                    {event.htmlLink ? (
                      <a
                        href={event.htmlLink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        Open calendar event
                      </a>
                    ) : null}

                    {actionState.errorMessage ? (
                      <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-800">
                        {actionState.errorMessage}
                      </div>
                    ) : null}

                    {analysisSuggestion ? (
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/dashboard/ai-suggestions/${analysisSuggestion.id}`}
                          className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 transition hover:bg-emerald-100"
                        >
                          View analysis
                        </Link>

                        <Badge
                          className={getStatusClasses(
                            analysisSuggestion.status as AiSuggestionStatus,
                          )}
                        >
                          Analysis: {formatEnumLabel(analysisSuggestion.status)}
                        </Badge>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row xl:flex-col">
                    {analysisSuggestion ? (
                      <Link
                        href={`/dashboard/ai-suggestions/${analysisSuggestion.id}`}
                        className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
                      >
                        View analysis
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAnalyzeEvent(event.id)}
                        disabled={!canRunWriteActions || actionState.isAnalyzing}
                        className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {actionState.isAnalyzing
                          ? 'Analyzing...'
                          : 'Analyze event'}
                      </button>
                    )}
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
