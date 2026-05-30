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
  getAiStatusLabel,
  type Translate,
} from '@/i18n/ai-display';
import { useI18n } from '@/i18n/useI18n';
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

function formatOrganizer(event: ExternalCalendarEvent, t: Translate) {
  if (event.organizerName && event.organizerEmail) {
    return `${event.organizerName} <${event.organizerEmail}>`;
  }

  return (
    event.organizerEmail ??
    event.organizerName ??
    t('common.emptyStates.unknownOrganizer')
  );
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

function getFriendlyActionError(error: unknown, t: Translate) {
  if (error instanceof ApiClientError) {
    const message = error.message.toLowerCase();

    if (error.status === 409) {
      return t('externalSync.errors.existingCalendarSuggestion');
    }

    if (
      message.includes('scope') ||
      message.includes('permission') ||
      message.includes('permissions')
    ) {
      return t('externalSync.errors.googlePermissions');
    }

    if (
      message.includes('connected account') ||
      message.includes('connect') ||
      message.includes('reconnect') ||
      message.includes('google')
    ) {
      return t('externalSync.errors.connectGoogleCalendar');
    }
  }

  return t('externalSync.errors.calendarActionFailed');
}

function getFriendlySyncError(error: unknown, t: Translate) {
  if (error instanceof ApiClientError) {
    const message = error.message.toLowerCase();

    if (
      message.includes('scope') ||
      message.includes('permission') ||
      message.includes('permissions')
    ) {
      return t('externalSync.errors.googlePermissions');
    }

    if (
      message.includes('connected account') ||
      message.includes('connect') ||
      message.includes('reconnect') ||
      message.includes('google')
    ) {
      return t('externalSync.errors.connectGoogleCalendar');
    }

    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return t('externalSync.errors.syncCalendarFailed');
}

export default function ExternalCalendarEventsPage() {
  const { token, user } = useAuth();
  const { t } = useI18n();

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
        setErrorMessage(t('externalSync.errors.loadCalendarFailed'));
      }
    } finally {
      setIsLoading(false);
    }
  }, [page, searchQuery, t, token]);

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
        `${t('syncedCalendar.messages.syncCompleted')} ${t(
          'syncedCalendar.messages.fetched',
        )} ${fetched} ${t('syncedCalendar.messages.events')} ${t(
          'syncedCalendar.messages.stored',
        )} ${stored} ${t('syncedCalendar.messages.events')}`,
      );
      setPage(1);
      await loadEvents();
      await loadExistingCalendarSuggestions();
    } catch (error) {
      setSyncErrorMessage(getFriendlySyncError(error, t));
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
        errorMessage: getFriendlyActionError(error, t),
        ...(existingSuggestion
          ? { analysisSuggestionId: existingSuggestion.id }
          : {}),
      }));
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={t('syncedCalendar.eyebrow')}
        title={t('syncedCalendar.title')}
        description={t('syncedCalendar.subtitle')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/external-sync/calendar-events/board"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              {t('common.actions.boardView')}
            </Link>
            <button
              type="button"
              onClick={handleSyncCalendar}
              disabled={isSyncing || !canRunWriteActions}
              className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSyncing
                ? t('externalSync.actions.syncingCalendar')
                : t('externalSync.actions.syncCalendar')}
            </button>
          </div>
        }
      />

      <section className="grid gap-3 md:grid-cols-5">
        {[
          t('externalSync.safety.calendarMetadataOnly'),
          t('externalSync.safety.noEmailsSent'),
          t('externalSync.safety.noCrmRecords'),
          t('externalSync.safety.noTasksOrNotes'),
          t('externalSync.safety.generatedSuggestionsHumanReview'),
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
          {t('syncedCalendar.messages.readOnlyRole')}
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <form
          onSubmit={handleSearchSubmit}
          className="flex flex-col gap-3 md:flex-row md:items-end"
        >
          <label className="flex-1 space-y-2">
            <span className="text-sm font-medium text-slate-700">
              {t('syncedCalendar.list.searchLabel')}
            </span>
            <input
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder={t('syncedCalendar.list.searchPlaceholder')}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
          </label>

          <button
            type="submit"
            className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
          >
            {t('common.actions.search')}
          </button>

          <button
            type="button"
            onClick={clearSearch}
            disabled={!hasSearch && !searchDraft}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('common.actions.clear')}
          </button>
        </form>
      </section>

      {isLoading ? <LoadingSkeleton rows={8} /> : null}

      {!isLoading && errorMessage ? <ErrorState message={errorMessage} /> : null}

      {!isLoading && !errorMessage && events.length === 0 ? (
        <EmptyState
          title={t('syncedCalendar.emptyStates.noneFound')}
          description={t('syncedCalendar.emptyStates.listDescription')}
        />
      ) : null}

      {!isLoading && !errorMessage && events.length > 0 ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>
              {t('common.pagination.showingPage')} {page}{' '}
              {t('common.pagination.of')} {totalPages}
            </span>
            <span>
              {totalEvents} {t('syncedCalendar.list.total')}
            </span>
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
                        {event.summary ?? t('common.emptyStates.noTitle')}
                      </h2>
                      <p className="mt-1 break-words text-sm text-slate-600">
                        {t('externalSync.labels.organizer')}:{' '}
                        {formatOrganizer(event, t)}
                      </p>
                    </div>

                    {event.description ? (
                      <p className="line-clamp-3 max-w-4xl text-sm leading-6 text-slate-600">
                        {event.description}
                      </p>
                    ) : null}

                    <div className="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
                      <div>
                        <p className="font-medium text-slate-950">
                          {t('externalSync.labels.start')}
                        </p>
                        <p className="mt-1 text-slate-600">
                          {event.startAt
                            ? formatDateTime(event.startAt)
                            : t('common.emptyStates.notSet')}
                        </p>
                      </div>

                      <div>
                        <p className="font-medium text-slate-950">
                          {t('externalSync.labels.end')}
                        </p>
                        <p className="mt-1 text-slate-600">
                          {event.endAt
                            ? formatDateTime(event.endAt)
                            : t('common.emptyStates.notSet')}
                        </p>
                      </div>

                      <div>
                        <p className="font-medium text-slate-950">
                          {t('externalSync.labels.location')}
                        </p>
                        <p className="mt-1 break-words text-slate-600">
                          {event.location ?? t('common.emptyStates.notSet')}
                        </p>
                      </div>

                      <div>
                        <p className="font-medium text-slate-950">
                          {t('externalSync.labels.attendees')}
                        </p>
                        <p className="mt-1 text-slate-600">
                          {attendeesCount ?? t('common.emptyStates.notSet')}
                        </p>
                      </div>

                      <div>
                        <p className="font-medium text-slate-950">
                          {t('externalSync.labels.syncedAt')}
                        </p>
                        <p className="mt-1 text-slate-600">
                          {formatDateTime(event.syncedAt)}
                        </p>
                      </div>

                      <div>
                        <p className="font-medium text-slate-950">
                          {t('externalSync.labels.calendarId')}
                        </p>
                        <p className="mt-1 break-all text-slate-500">
                          {event.externalCalendarId}
                        </p>
                      </div>

                      <div>
                        <p className="font-medium text-slate-950">
                          {t('externalSync.labels.eventId')}
                        </p>
                        <p className="mt-1 break-all text-slate-500">
                          {event.externalEventId}
                        </p>
                      </div>

                      <div>
                        <p className="font-medium text-slate-950">
                          {t('externalSync.labels.icalUid')}
                        </p>
                        <p className="mt-1 break-all text-slate-500">
                          {event.iCalUid ?? t('common.emptyStates.notSet')}
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
                        {t('externalSync.actions.openCalendarEvent')}
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
                          {t('externalSync.actions.viewAnalysis')}
                        </Link>

                        <Badge
                          className={getStatusClasses(
                            analysisSuggestion.status as AiSuggestionStatus,
                          )}
                        >
                          {t('externalSync.labels.analysis')}:{' '}
                          {getAiStatusLabel(
                            analysisSuggestion.status as AiSuggestionStatus,
                            t,
                          )}
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
                        {t('externalSync.actions.viewAnalysis')}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAnalyzeEvent(event.id)}
                        disabled={!canRunWriteActions || actionState.isAnalyzing}
                        className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {actionState.isAnalyzing
                          ? t('externalSync.actions.analyzing')
                          : t('externalSync.actions.analyzeEvent')}
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
              {t('common.pagination.previous')}
            </button>

            <span className="text-sm text-slate-500">
              {t('common.pagination.page')} {page}{' '}
              {t('common.pagination.of')} {totalPages}
            </span>

            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((currentPage) => currentPage + 1)}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('common.pagination.next')}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
