'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { AiGuardrailsNotice } from '@/components/AiGuardrailsNotice';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import { useAuth } from '@/hooks/useAuth';
import {
  getAiStatusLabel,
  getAppliedActionLabel,
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
import { formatDateTime, truncateText } from '@/lib/formatters';
import { canUpdateCrm } from '@/lib/permissions';
import type { AiSuggestion, AiSuggestionStatus } from '@/types/ai-suggestions';
import type { ExternalCalendarEvent } from '@/types/external-sync';

type CalendarColumnKey =
  | 'new'
  | 'needs-review'
  | 'ready'
  | 'completed'
  | 'closed';

type CalendarActionState = {
  isAnalyzing: boolean;
  errorMessage: string | null;
  analysisSuggestionId?: string;
};

type ClassifiedCalendarEvent = {
  event: ExternalCalendarEvent;
  analysisSuggestion?: AiSuggestion;
  column: CalendarColumnKey;
};

const EVENTS_PAGE_SIZE = 100;
const SUGGESTIONS_PAGE_SIZE = 100;
const BOARD_PAGE_SIZE = 5;

const columnConfig: Record<
  CalendarColumnKey,
  {
    titleKey: string;
    descriptionKey: string;
    emptyMessageKey: string;
    headingClassName: string;
  }
> = {
  new: {
    titleKey: 'externalSync.board.newSynced',
    descriptionKey: 'syncedCalendar.columns.newDescription',
    emptyMessageKey: 'syncedCalendar.columns.noNew',
    headingClassName: 'text-slate-700',
  },
  'needs-review': {
    titleKey: 'externalSync.board.needsReview',
    descriptionKey: 'syncedCalendar.columns.needsReviewDescription',
    emptyMessageKey: 'syncedCalendar.columns.noNeedsReview',
    headingClassName: 'text-amber-700',
  },
  ready: {
    titleKey: 'externalSync.board.readyForAction',
    descriptionKey: 'syncedCalendar.columns.readyDescription',
    emptyMessageKey: 'syncedCalendar.columns.noReady',
    headingClassName: 'text-emerald-700',
  },
  completed: {
    titleKey: 'externalSync.board.completed',
    descriptionKey: 'syncedCalendar.columns.completedDescription',
    emptyMessageKey: 'syncedCalendar.columns.noCompleted',
    headingClassName: 'text-blue-700',
  },
  closed: {
    titleKey: 'externalSync.board.rejectedClosed',
    descriptionKey: 'syncedCalendar.columns.closedDescription',
    emptyMessageKey: 'syncedCalendar.columns.noClosed',
    headingClassName: 'text-rose-700',
  },
};

const columnKeys: CalendarColumnKey[] = [
  'new',
  'needs-review',
  'ready',
  'completed',
  'closed',
];

function getInitialColumnPages() {
  return columnKeys.reduce((accumulator, key) => {
    accumulator[key] = 1;

    return accumulator;
  }, {} as Record<CalendarColumnKey, number>);
}

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

function getMetadataString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getAppliedActionNames(suggestion: AiSuggestion | undefined) {
  const actions = suggestion?.metadataJson?.appliedActions;

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

function getAppliedLabels(t: Translate, suggestion: AiSuggestion | undefined) {
  const labels = new Set<string>();

  getAppliedActionNames(suggestion).forEach((action) => {
    const label = getAppliedActionLabel(action, t);

    if (label) {
      labels.add(label);
    }
  });

  if (getMetadataString(suggestion?.metadataJson?.taskId)) {
    labels.add(t('aiSuggestions.completedActions.taskCreated'));
  }

  if (getMetadataString(suggestion?.metadataJson?.noteId)) {
    labels.add(t('aiSuggestions.completedActions.noteCreated'));
  }

  if (getMetadataString(suggestion?.metadataJson?.leadId)) {
    labels.add(t('aiSuggestions.completedActions.leadCreated'));
  }

  return Array.from(labels);
}

function hasAppliedActions(suggestion: AiSuggestion | undefined) {
  return (
    getAppliedActionNames(suggestion).some((action) =>
      Boolean(getAppliedActionLabel(action, (key) => key)),
    ) ||
    Boolean(getMetadataString(suggestion?.metadataJson?.taskId)) ||
    Boolean(getMetadataString(suggestion?.metadataJson?.noteId)) ||
    Boolean(getMetadataString(suggestion?.metadataJson?.leadId))
  );
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

function classifyCalendarEvent(
  event: ExternalCalendarEvent,
  analysisSuggestion: AiSuggestion | undefined,
): ClassifiedCalendarEvent {
  const hasCompleted = hasAppliedActions(analysisSuggestion);
  const isAccepted =
    analysisSuggestion &&
    ['ACCEPTED', 'EDITED_AND_ACCEPTED'].includes(analysisSuggestion.status);
  const isPending = analysisSuggestion?.status === 'PENDING_REVIEW';
  const isClosed =
    analysisSuggestion &&
    ['REJECTED', 'EXPIRED'].includes(analysisSuggestion.status);

  let column: CalendarColumnKey = 'new';

  if (hasCompleted) {
    column = 'completed';
  } else if (isAccepted) {
    column = 'ready';
  } else if (isPending) {
    column = 'needs-review';
  } else if (isClosed) {
    column = 'closed';
  }

  return {
    event,
    analysisSuggestion,
    column,
  };
}

function getTotalPages(total: number) {
  return Math.max(1, Math.ceil(total / BOARD_PAGE_SIZE));
}

function paginateItems(items: ClassifiedCalendarEvent[], page: number) {
  const startIndex = (page - 1) * BOARD_PAGE_SIZE;

  return items.slice(startIndex, startIndex + BOARD_PAGE_SIZE);
}

type CalendarEventCardProps = {
  item: ClassifiedCalendarEvent;
  actionState: CalendarActionState;
  canRunWriteActions: boolean;
  onAnalyze: (eventId: string) => void;
};

function CalendarEventCard({
  item,
  actionState,
  canRunWriteActions,
  onAnalyze,
}: CalendarEventCardProps) {
  const { event, analysisSuggestion } = item;
  const { t } = useI18n();
  const attendeesCount = getAttendeesCount(event.attendeesJson);
  const appliedLabels = getAppliedLabels(t, analysisSuggestion);

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="space-y-3">
        <div>
          <h3 className="break-words text-sm font-semibold leading-5 text-slate-950">
            {event.summary ?? t('common.emptyStates.noTitle')}
          </h3>
          <p className="mt-1 break-words text-xs leading-5 text-slate-600">
            {t('externalSync.labels.organizer')}: {formatOrganizer(event, t)}
          </p>
        </div>

        {event.description ? (
          <p className="text-xs leading-5 text-slate-500">
            {truncateText(event.description, 140)}
          </p>
        ) : null}

        <div className="space-y-1 text-xs text-slate-500">
          <p>
            {t('externalSync.labels.start')}:{' '}
            {event.startAt
              ? formatDateTime(event.startAt)
              : t('common.emptyStates.notSet')}
          </p>
          <p>
            {t('externalSync.labels.end')}:{' '}
            {event.endAt
              ? formatDateTime(event.endAt)
              : t('common.emptyStates.notSet')}
          </p>
          <p>
            {t('externalSync.labels.location')}:{' '}
            {event.location ?? t('common.emptyStates.notSet')}
          </p>
          <p>
            {t('externalSync.labels.attendees')}:{' '}
            {attendeesCount ?? t('common.emptyStates.notSet')}
          </p>
          <p>
            {t('externalSync.labels.synced')}: {formatDateTime(event.syncedAt)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {analysisSuggestion ? (
            <Badge className={getStatusClasses(analysisSuggestion.status)}>
              {t('externalSync.labels.analysis')}:{' '}
              {getAiStatusLabel(analysisSuggestion.status, t)}
            </Badge>
          ) : null}

          {appliedLabels.map((label) => (
            <Badge
              key={label}
              className="bg-emerald-50 text-emerald-700 ring-emerald-200"
            >
              {label}
            </Badge>
          ))}
        </div>

        {actionState.errorMessage ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-800">
            {actionState.errorMessage}
          </div>
        ) : null}

        <div className="grid gap-2">
          {analysisSuggestion ? (
            <Link
              href={`/dashboard/ai-suggestions/${analysisSuggestion.id}`}
              className="rounded-xl bg-slate-950 px-3 py-2 text-center text-xs font-medium text-white shadow-sm transition hover:bg-slate-800"
            >
              {t('externalSync.actions.viewAnalysis')}
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => onAnalyze(event.id)}
              disabled={!canRunWriteActions || actionState.isAnalyzing}
              className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {actionState.isAnalyzing
                ? t('externalSync.actions.analyzing')
                : t('externalSync.actions.analyzeEvent')}
            </button>
          )}

          {event.htmlLink ? (
            <a
              href={event.htmlLink}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-center text-xs font-medium text-slate-700 transition hover:bg-slate-50"
            >
              {t('externalSync.actions.openInGoogleCalendar')}
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export default function ExternalCalendarEventsBoardPage() {
  const { token, user } = useAuth();
  const { t } = useI18n();

  const [events, setEvents] = useState<ExternalCalendarEvent[]>([]);
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
  const [columnPages, setColumnPages] = useState<
    Record<CalendarColumnKey, number>
  >(() => getInitialColumnPages());

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

  const loadBoard = useCallback(async () => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [eventsResponse] = await Promise.all([
        getExternalCalendarEvents(token, {
          page: 1,
          pageSize: EVENTS_PAGE_SIZE,
        }),
        loadExistingCalendarSuggestions(),
      ]);

      setEvents(eventsResponse.data);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage(t('externalSync.errors.loadCalendarBoardFailed'));
      }
    } finally {
      setIsLoading(false);
    }
  }, [loadExistingCalendarSuggestions, t, token]);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  function updateEventActionState(
    eventId: string,
    updater: (current: CalendarActionState) => CalendarActionState,
  ) {
    setEventActionStates((currentStates) => ({
      ...currentStates,
      [eventId]: updater(getCalendarActionState(currentStates, eventId)),
    }));
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
      await loadBoard();
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

  const classifiedColumns = useMemo(() => {
    const columns = columnKeys.reduce((accumulator, key) => {
      accumulator[key] = [];

      return accumulator;
    }, {} as Record<CalendarColumnKey, ClassifiedCalendarEvent[]>);

    events.forEach((event) => {
      const item = classifyCalendarEvent(
        event,
        analysisSuggestionsByEventId[event.id],
      );

      columns[item.column].push(item);
    });

    return columns;
  }, [analysisSuggestionsByEventId, events]);

  useEffect(() => {
    setColumnPages((currentPages) => {
      const nextPages = { ...currentPages };

      columnKeys.forEach((key) => {
        nextPages[key] = Math.min(
          nextPages[key],
          getTotalPages(classifiedColumns[key].length),
        );
      });

      return nextPages;
    });
  }, [classifiedColumns]);

  const totalEvents = events.length;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={t('syncedCalendar.eyebrow')}
        title={t('syncedCalendar.boardTitle')}
        description={t('syncedCalendar.boardSubtitle')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/external-sync/calendar-events/list"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              {t('common.actions.listView')}
            </Link>
            <button
              type="button"
              onClick={() => void handleSyncCalendar()}
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

      <AiGuardrailsNotice
        description={t('common.guardrails.syncedCalendarDescription')}
        items={[
          t('externalSync.safety.calendarMetadataOnly'),
          t('externalSync.safety.noEmailSent'),
          t('externalSync.safety.noCrmRecords'),
          t('externalSync.safety.generatedSuggestionsRequireReview'),
          t('externalSync.safety.crmActionsFromDetails'),
        ]}
      />

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

      {isLoading ? <LoadingSkeleton rows={8} /> : null}

      {!isLoading && errorMessage ? <ErrorState message={errorMessage} /> : null}

      {!isLoading && !errorMessage && totalEvents === 0 ? (
        <EmptyState
          title={t('syncedCalendar.emptyStates.noneFound')}
          description={t('syncedCalendar.emptyStates.boardDescription')}
        />
      ) : null}

      {!isLoading && !errorMessage && totalEvents > 0 ? (
        <section className="overflow-x-auto pb-3">
          <div className="grid min-w-[1700px] gap-4 xl:grid-cols-5">
            {columnKeys.map((key) => {
              const items = classifiedColumns[key];
              const page = columnPages[key];
              const totalPages = getTotalPages(items.length);
              const visibleItems = paginateItems(items, page);
              const config = columnConfig[key];

              return (
                <div
                  key={key}
                  className="flex min-h-[700px] flex-col rounded-2xl border border-slate-200 bg-slate-50"
                >
                  <div className="border-b border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2
                          className={`text-sm font-semibold ${config.headingClassName}`}
                        >
                          {t(config.titleKey)}
                        </h2>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {t(config.descriptionKey)}
                        </p>
                      </div>
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200">
                        {items.length}
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 space-y-3 p-3">
                    {visibleItems.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-sm text-slate-500">
                        {t(config.emptyMessageKey)}
                      </div>
                    ) : null}

                    {visibleItems.map((item) => (
                      <CalendarEventCard
                        key={item.event.id}
                        item={item}
                        actionState={getCalendarActionState(
                          eventActionStates,
                          item.event.id,
                        )}
                        canRunWriteActions={canRunWriteActions}
                        onAnalyze={(eventId) =>
                          void handleAnalyzeEvent(eventId)
                        }
                      />
                    ))}
                  </div>

                  <div className="border-t border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        disabled={page <= 1}
                        onClick={() =>
                          setColumnPages((currentPages) => ({
                            ...currentPages,
                            [key]: page - 1,
                          }))
                        }
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {t('common.pagination.previous')}
                      </button>

                      <span className="text-xs text-slate-500">
                        {t('common.pagination.page')} {page}{' '}
                        {t('common.pagination.of')} {totalPages}
                      </span>

                      <button
                        type="button"
                        disabled={page >= totalPages}
                        onClick={() =>
                          setColumnPages((currentPages) => ({
                            ...currentPages,
                            [key]: page + 1,
                          }))
                        }
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {t('common.pagination.next')}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
