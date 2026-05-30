// FILE: apps/web/src/app/dashboard/ai-suggestions/board/page.tsx
'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { useAuth } from '@/hooks/useAuth';
import {
  getAiStatusLabel,
  getAiTypeLabel,
  getAppliedActionLabel,
  type Translate,
} from '@/i18n/ai-display';
import { useI18n } from '@/i18n/useI18n';
import { ApiClientError, getAiSuggestions } from '@/lib/api-client';
import { formatDateTime, formatEnumLabel, truncateText } from '@/lib/formatters';
import type {
  AiSuggestion,
  AiSuggestionStatus,
  AiSuggestionType,
} from '@/types/ai-suggestions';

const BOARD_PAGE_SIZE = 5;
const ACCEPTED_POOL_PAGE_SIZE = 100;

type StatusColumnKey = 'pending' | 'rejected' | 'expired';

type StatusColumnState = {
  items: AiSuggestion[];
  total: number;
  totalPages: number;
  isLoading: boolean;
  errorMessage: string | null;
};

const statusColumnConfig: Record<
  StatusColumnKey,
  {
    titleKey: string;
    descriptionKey: string;
    emptyMessageKey: string;
    status: AiSuggestionStatus;
    headingClassName: string;
  }
> = {
  pending: {
    titleKey: 'aiSuggestions.board.pending',
    descriptionKey: 'aiSuggestions.board.pendingDescription',
    emptyMessageKey: 'aiSuggestions.board.noPending',
    status: 'PENDING_REVIEW',
    headingClassName: 'text-amber-700',
  },
  rejected: {
    titleKey: 'aiSuggestions.board.rejected',
    descriptionKey: 'aiSuggestions.board.rejectedDescription',
    emptyMessageKey: 'aiSuggestions.board.noRejected',
    status: 'REJECTED',
    headingClassName: 'text-rose-700',
  },
  expired: {
    titleKey: 'aiSuggestions.board.expired',
    descriptionKey: 'aiSuggestions.board.expiredDescription',
    emptyMessageKey: 'aiSuggestions.board.noExpired',
    status: 'EXPIRED',
    headingClassName: 'text-slate-700',
  },
};

const emptyStatusColumnState: StatusColumnState = {
  items: [],
  total: 0,
  totalPages: 1,
  isLoading: true,
  errorMessage: null,
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

function getConfidenceLabel(suggestion: AiSuggestion, t: Translate) {
  if (suggestion.confidenceScore === null) {
    return t('common.emptyStates.notSet');
  }

  return `${Math.round(suggestion.confidenceScore * 100)}%`;
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

function getAppliedLabels(suggestion: AiSuggestion, t: Translate) {
  const labels = new Set(
    getAppliedActionNames(suggestion)
      .map((action) => getAppliedActionLabel(action, t))
      .filter(Boolean),
  );

  if (hasGmailDraftCreated(suggestion)) {
    labels.add(t('aiSuggestions.completedActions.gmailDraftCreated'));
  }

  return Array.from(labels);
}

function hasCompletedAction(suggestion: AiSuggestion, t: Translate) {
  return getAppliedLabels(suggestion, t).length > 0;
}

function getReplyDraftSubject(suggestion: AiSuggestion, t: Translate) {
  return (
    getMetadataString(suggestion.metadataJson?.suggestedSubject) ??
    suggestion.externalEmailMessage?.subject ??
    t('common.emptyStates.noSubject')
  );
}

function getEmailSender(suggestion: AiSuggestion, t: Translate) {
  const senderName = getMetadataString(
    suggestion.externalEmailMessage?.fromName,
  );
  const senderEmail = getMetadataString(
    suggestion.externalEmailMessage?.fromEmail,
  );

  if (senderName && senderEmail) {
    return `${senderName} <${senderEmail}>`;
  }

  return senderEmail ?? senderName ?? t('common.emptyStates.unknownSender');
}

function getAttendeesCount(value: unknown) {
  if (Array.isArray(value)) {
    return value.length;
  }

  return null;
}

function getSuggestionTitle(suggestion: AiSuggestion, t: Translate) {
  if (suggestion.title) {
    return suggestion.title;
  }

  if (suggestion.type === 'GENERATE_EMAIL_REPLY_DRAFT') {
    return getReplyDraftSubject(suggestion, t);
  }

  if (suggestion.externalEmailMessage?.subject) {
    return suggestion.externalEmailMessage.subject;
  }

  if (suggestion.externalCalendarEvent?.summary) {
    return suggestion.externalCalendarEvent.summary;
  }

  return t('aiSuggestions.labels.untitled');
}

function getSourcePreview(suggestion: AiSuggestion, t: Translate) {
  if (
    suggestion.type === 'ANALYZE_EXTERNAL_EMAIL' ||
    suggestion.type === 'GENERATE_EMAIL_REPLY_DRAFT'
  ) {
    const snippet =
      truncateText(suggestion.externalEmailMessage?.snippet, 120) ||
      truncateText(suggestion.outputText, 120) ||
      t('common.emptyStates.noSnippet');

    return (
      <div className="space-y-1 text-xs leading-5 text-slate-600">
        <p className="font-medium text-slate-800">
          {suggestion.externalEmailMessage?.subject ?? t('common.emptyStates.noSubject')}
        </p>
        <p>{getEmailSender(suggestion, t)}</p>
        {suggestion.type === 'GENERATE_EMAIL_REPLY_DRAFT' ? (
          <p>
            {t('aiSuggestions.labels.suggestedSubject')}:{' '}
            <span className="font-medium text-slate-800">
              {getReplyDraftSubject(suggestion, t)}
            </span>
          </p>
        ) : null}
        <p>{snippet}</p>
      </div>
    );
  }

  if (suggestion.type === 'ANALYZE_EXTERNAL_CALENDAR_EVENT') {
    const event = suggestion.externalCalendarEvent;
    const attendeesCount = getAttendeesCount(event?.attendeesJson);

    return (
      <div className="space-y-1 text-xs leading-5 text-slate-600">
        <p className="font-medium text-slate-800">
          {event?.summary ?? t('common.emptyStates.noTitle')}
        </p>
        <p>{formatDateTime(event?.startAt)}</p>
        <p>
          {event?.organizerName ||
            event?.organizerEmail ||
            t('common.emptyStates.unknownOrganizer')}
        </p>
        <p>
          {t('aiSuggestions.labels.attendees')}:{' '}
          {attendeesCount === null
            ? t('aiSuggestions.labels.notSet')
            : attendeesCount}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1 text-xs leading-5 text-slate-600">
      <p className="font-medium text-slate-800">
        {t('aiSuggestions.labels.leadRecommendation')}
      </p>
      <p>
        {suggestion.leadId
          ? `${t('aiSuggestions.labels.leadRecommendationForLead')} ${suggestion.leadId}`
          : suggestion.entityType && suggestion.entityId
            ? `${formatEnumLabel(suggestion.entityType)} / ${suggestion.entityId}`
            : t('aiSuggestions.labels.sourceUnavailable')}
      </p>
    </div>
  );
}

function getTotalPages(total: number) {
  return Math.max(1, Math.ceil(total / BOARD_PAGE_SIZE));
}

function paginateItems(items: AiSuggestion[], page: number) {
  const startIndex = (page - 1) * BOARD_PAGE_SIZE;

  return items.slice(startIndex, startIndex + BOARD_PAGE_SIZE);
}

function sortSuggestionsByCreatedAt(suggestions: AiSuggestion[]) {
  return [...suggestions].sort(
    (firstSuggestion, secondSuggestion) =>
      new Date(secondSuggestion.createdAt).getTime() -
      new Date(firstSuggestion.createdAt).getTime(),
  );
}

function getSafeErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiClientError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

function SuggestionCard({ suggestion }: { suggestion: AiSuggestion }) {
  const { t } = useI18n();
  const appliedLabels = getAppliedLabels(suggestion, t);

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Badge className={getStatusClasses(suggestion.status)}>
            {getAiStatusLabel(suggestion.status, t)}
          </Badge>
          <Badge className="bg-indigo-50 text-indigo-700 ring-indigo-200">
            {getAiTypeLabel(suggestion.type, t)}
          </Badge>
        </div>

        <div>
          <Link
            href={`/dashboard/ai-suggestions/${suggestion.id}`}
            className="text-sm font-semibold leading-5 text-slate-950 transition hover:text-blue-700"
          >
            {getSuggestionTitle(suggestion, t)}
          </Link>
          <div className="mt-2 space-y-1 text-xs text-slate-500">
            <p>
              {t('aiSuggestions.labels.confidence')}:{' '}
              {getConfidenceLabel(suggestion, t)}
            </p>
            <p>
              {t('aiSuggestions.labels.created')}{' '}
              {formatDateTime(suggestion.createdAt)}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          {getSourcePreview(suggestion, t)}
        </div>

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

        <Link
          href={`/dashboard/ai-suggestions/${suggestion.id}`}
          className="inline-flex text-xs font-medium text-blue-700 transition hover:text-blue-900"
        >
          {t('common.actions.viewDetails')}
        </Link>
      </div>
    </article>
  );
}

type BoardColumnProps = {
  title: string;
  description: string;
  emptyMessage: string;
  headingClassName: string;
  items: AiSuggestion[];
  total: number;
  page: number;
  totalPages: number;
  isLoading: boolean;
  errorMessage: string | null;
  onPrevious: () => void;
  onNext: () => void;
  onRetry: () => void;
};

function BoardColumn({
  title,
  description,
  emptyMessage,
  headingClassName,
  items,
  total,
  page,
  totalPages,
  isLoading,
  errorMessage,
  onPrevious,
  onNext,
  onRetry,
}: BoardColumnProps) {
  const { t } = useI18n();

  return (
    <section className="flex min-h-[660px] flex-col rounded-2xl border border-slate-200 bg-slate-50">
      <div className="border-b border-slate-200 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className={`text-sm font-semibold ${headingClassName}`}>
              {title}
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {description}
            </p>
          </div>
          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200">
            {total}
          </span>
        </div>
      </div>

      <div className="flex-1 space-y-3 p-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-white"
            />
          ))
        ) : null}

        {!isLoading && errorMessage ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            <p>{errorMessage}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-50"
            >
              {t('common.actions.retry')}
            </button>
          </div>
        ) : null}

        {!isLoading && !errorMessage && items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-sm text-slate-500">
            {emptyMessage}
          </div>
        ) : null}

        {!isLoading && !errorMessage
          ? items.map((suggestion) => (
              <SuggestionCard key={suggestion.id} suggestion={suggestion} />
            ))
          : null}
      </div>

      <div className="border-t border-slate-200 p-3">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            disabled={page <= 1 || isLoading}
            onClick={onPrevious}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('common.actions.previous')}
          </button>

          <span className="text-xs text-slate-500">
            {t('aiSuggestions.labels.page')} {page}{' '}
            {t('aiSuggestions.labels.of')} {totalPages}
          </span>

          <button
            type="button"
            disabled={page >= totalPages || isLoading}
            onClick={onNext}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('common.actions.next')}
          </button>
        </div>
      </div>
    </section>
  );
}

export default function AiSuggestionsBoardPage() {
  const { token } = useAuth();
  const { t } = useI18n();

  const [statusPages, setStatusPages] = useState<Record<StatusColumnKey, number>>({
    pending: 1,
    rejected: 1,
    expired: 1,
  });
  const [statusColumns, setStatusColumns] = useState<
    Record<StatusColumnKey, StatusColumnState>
  >({
    pending: emptyStatusColumnState,
    rejected: emptyStatusColumnState,
    expired: emptyStatusColumnState,
  });
  const [acceptedItems, setAcceptedItems] = useState<AiSuggestion[]>([]);
  const [completedItems, setCompletedItems] = useState<AiSuggestion[]>([]);
  const [acceptedPage, setAcceptedPage] = useState(1);
  const [completedPage, setCompletedPage] = useState(1);
  const [isAcceptedLoading, setIsAcceptedLoading] = useState(true);
  const [acceptedErrorMessage, setAcceptedErrorMessage] = useState<string | null>(
    null,
  );

  const loadStatusColumn = useCallback(
    async (key: StatusColumnKey, page: number) => {
      if (!token) {
        setStatusColumns((currentColumns) => ({
          ...currentColumns,
          [key]: {
            ...currentColumns[key],
            isLoading: false,
          },
        }));
        return;
      }

      setStatusColumns((currentColumns) => ({
        ...currentColumns,
        [key]: {
          ...currentColumns[key],
          isLoading: true,
          errorMessage: null,
        },
      }));

      try {
        const response = await getAiSuggestions(token, {
          page,
          pageSize: BOARD_PAGE_SIZE,
          status: statusColumnConfig[key].status,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        });

        setStatusColumns((currentColumns) => ({
          ...currentColumns,
          [key]: {
            items: response.data,
            total: response.meta.total,
            totalPages: response.meta.totalPages || 1,
            isLoading: false,
            errorMessage: null,
          },
        }));
      } catch (error) {
        setStatusColumns((currentColumns) => ({
          ...currentColumns,
          [key]: {
            ...currentColumns[key],
            isLoading: false,
            errorMessage: getSafeErrorMessage(
              error,
              t('aiWorkspace.messages.suggestionsLoadFailed'),
            ),
          },
        }));
      }
    },
    [t, token],
  );

  const loadAcceptedColumns = useCallback(async () => {
    if (!token) {
      setIsAcceptedLoading(false);
      return;
    }

    setIsAcceptedLoading(true);
    setAcceptedErrorMessage(null);

    try {
      const [acceptedResponse, editedResponse] = await Promise.all([
        getAiSuggestions(token, {
          page: 1,
          pageSize: ACCEPTED_POOL_PAGE_SIZE,
          status: 'ACCEPTED',
          sortBy: 'createdAt',
          sortOrder: 'desc',
        }),
        getAiSuggestions(token, {
          page: 1,
          pageSize: ACCEPTED_POOL_PAGE_SIZE,
          status: 'EDITED_AND_ACCEPTED',
          sortBy: 'createdAt',
          sortOrder: 'desc',
        }),
      ]);

      const reviewedSuggestions = sortSuggestionsByCreatedAt([
        ...acceptedResponse.data,
        ...editedResponse.data,
      ]);

      setAcceptedItems(
        reviewedSuggestions.filter(
          (suggestion) => !hasCompletedAction(suggestion, t),
        ),
      );
      setCompletedItems(
        reviewedSuggestions.filter((suggestion) =>
          hasCompletedAction(suggestion, t),
        ),
      );
    } catch (error) {
      setAcceptedErrorMessage(
        getSafeErrorMessage(error, t('aiWorkspace.messages.suggestionsLoadFailed')),
      );
    } finally {
      setIsAcceptedLoading(false);
    }
  }, [t, token]);

  useEffect(() => {
    void loadStatusColumn('pending', statusPages.pending);
  }, [loadStatusColumn, statusPages.pending]);

  useEffect(() => {
    void loadStatusColumn('rejected', statusPages.rejected);
  }, [loadStatusColumn, statusPages.rejected]);

  useEffect(() => {
    void loadStatusColumn('expired', statusPages.expired);
  }, [loadStatusColumn, statusPages.expired]);

  useEffect(() => {
    void loadAcceptedColumns();
  }, [loadAcceptedColumns]);

  const acceptedTotalPages = getTotalPages(acceptedItems.length);
  const completedTotalPages = getTotalPages(completedItems.length);

  useEffect(() => {
    setAcceptedPage((currentPage) =>
      Math.min(currentPage, acceptedTotalPages),
    );
  }, [acceptedTotalPages]);

  useEffect(() => {
    setCompletedPage((currentPage) =>
      Math.min(currentPage, completedTotalPages),
    );
  }, [completedTotalPages]);

  const visibleAcceptedItems = useMemo(
    () => paginateItems(acceptedItems, acceptedPage),
    [acceptedItems, acceptedPage],
  );
  const visibleCompletedItems = useMemo(
    () => paginateItems(completedItems, completedPage),
    [completedItems, completedPage],
  );

  function setStatusColumnPage(key: StatusColumnKey, nextPage: number) {
    setStatusPages((currentPages) => ({
      ...currentPages,
      [key]: nextPage,
    }));
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={t('aiSuggestions.eyebrow')}
        title={t('aiSuggestions.boardTitle')}
        description={t('aiSuggestions.boardSubtitle')}
        actions={
          <>
            <Link
              href="/dashboard/ai-suggestions/list"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              {t('common.actions.listView')}
            </Link>
            <Link
              href="/dashboard/ai-workspace"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              {t('navigation.items.aiWorkspace')}
            </Link>
          </>
        }
      />

      <section className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
        <div className="grid gap-3 md:grid-cols-4">
          {[
            t('common.safety.humanReviewRequired'),
            t('common.safety.noAutomaticEmailSending'),
            t('common.safety.noAutomaticGmailDraft'),
            t('common.safety.noAutomaticCrmRecords'),
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

      <section className="overflow-x-auto pb-3">
        <div className="grid min-w-[1700px] gap-4 xl:grid-cols-5">
          <BoardColumn
            title={t(statusColumnConfig.pending.titleKey)}
            description={t(statusColumnConfig.pending.descriptionKey)}
            emptyMessage={t(statusColumnConfig.pending.emptyMessageKey)}
            headingClassName={statusColumnConfig.pending.headingClassName}
            items={statusColumns.pending.items}
            total={statusColumns.pending.total}
            page={statusPages.pending}
            totalPages={statusColumns.pending.totalPages}
            isLoading={statusColumns.pending.isLoading}
            errorMessage={statusColumns.pending.errorMessage}
            onPrevious={() =>
              setStatusColumnPage('pending', statusPages.pending - 1)
            }
            onNext={() => setStatusColumnPage('pending', statusPages.pending + 1)}
            onRetry={() => void loadStatusColumn('pending', statusPages.pending)}
          />

          <BoardColumn
            title={t('aiSuggestions.board.accepted')}
            description={t('aiSuggestions.board.acceptedDescription')}
            emptyMessage={t('aiSuggestions.board.noAccepted')}
            headingClassName="text-emerald-700"
            items={visibleAcceptedItems}
            total={acceptedItems.length}
            page={acceptedPage}
            totalPages={acceptedTotalPages}
            isLoading={isAcceptedLoading}
            errorMessage={acceptedErrorMessage}
            onPrevious={() => setAcceptedPage((currentPage) => currentPage - 1)}
            onNext={() => setAcceptedPage((currentPage) => currentPage + 1)}
            onRetry={() => void loadAcceptedColumns()}
          />

          <BoardColumn
            title={t('aiSuggestions.board.completed')}
            description={t('aiSuggestions.board.completedDescription')}
            emptyMessage={t('aiSuggestions.board.noCompleted')}
            headingClassName="text-blue-700"
            items={visibleCompletedItems}
            total={completedItems.length}
            page={completedPage}
            totalPages={completedTotalPages}
            isLoading={isAcceptedLoading}
            errorMessage={acceptedErrorMessage}
            onPrevious={() => setCompletedPage((currentPage) => currentPage - 1)}
            onNext={() => setCompletedPage((currentPage) => currentPage + 1)}
            onRetry={() => void loadAcceptedColumns()}
          />

          <BoardColumn
            title={t(statusColumnConfig.rejected.titleKey)}
            description={t(statusColumnConfig.rejected.descriptionKey)}
            emptyMessage={t(statusColumnConfig.rejected.emptyMessageKey)}
            headingClassName={statusColumnConfig.rejected.headingClassName}
            items={statusColumns.rejected.items}
            total={statusColumns.rejected.total}
            page={statusPages.rejected}
            totalPages={statusColumns.rejected.totalPages}
            isLoading={statusColumns.rejected.isLoading}
            errorMessage={statusColumns.rejected.errorMessage}
            onPrevious={() =>
              setStatusColumnPage('rejected', statusPages.rejected - 1)
            }
            onNext={() =>
              setStatusColumnPage('rejected', statusPages.rejected + 1)
            }
            onRetry={() =>
              void loadStatusColumn('rejected', statusPages.rejected)
            }
          />

          <BoardColumn
            title={t(statusColumnConfig.expired.titleKey)}
            description={t(statusColumnConfig.expired.descriptionKey)}
            emptyMessage={t(statusColumnConfig.expired.emptyMessageKey)}
            headingClassName={statusColumnConfig.expired.headingClassName}
            items={statusColumns.expired.items}
            total={statusColumns.expired.total}
            page={statusPages.expired}
            totalPages={statusColumns.expired.totalPages}
            isLoading={statusColumns.expired.isLoading}
            errorMessage={statusColumns.expired.errorMessage}
            onPrevious={() =>
              setStatusColumnPage('expired', statusPages.expired - 1)
            }
            onNext={() => setStatusColumnPage('expired', statusPages.expired + 1)}
            onRetry={() => void loadStatusColumn('expired', statusPages.expired)}
          />
        </div>
      </section>
    </div>
  );
}
