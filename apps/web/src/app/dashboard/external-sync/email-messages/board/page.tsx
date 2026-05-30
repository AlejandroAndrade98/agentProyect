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
  getAiStatusLabel,
  getAppliedActionLabel,
  type Translate,
} from '@/i18n/ai-display';
import { useI18n } from '@/i18n/useI18n';
import {
  analyzeExternalEmailMessage,
  ApiClientError,
  generateExternalEmailReplyDraft,
  getAiSuggestions,
  getExternalEmailMessages,
  syncExternalEmailMessages,
} from '@/lib/api-client';
import { formatDateTime, truncateText } from '@/lib/formatters';
import { canUpdateCrm } from '@/lib/permissions';
import type { AiSuggestion, AiSuggestionStatus } from '@/types/ai-suggestions';
import type { ExternalEmailMessage } from '@/types/external-sync';

type EmailActionName = 'analyze' | 'reply-draft';
type EmailColumnKey =
  | 'new'
  | 'needs-review'
  | 'ready'
  | 'completed'
  | 'closed';

type EmailActionState = {
  loadingAction: EmailActionName | null;
  errorMessage: string | null;
  analyzeSuggestionId?: string;
  replyDraftSuggestionId?: string;
};

type ClassifiedEmail = {
  email: ExternalEmailMessage;
  analysisSuggestion?: AiSuggestion;
  replyDraftSuggestion?: AiSuggestion;
  column: EmailColumnKey;
};

const EMAILS_PAGE_SIZE = 100;
const SUGGESTIONS_PAGE_SIZE = 100;
const BOARD_PAGE_SIZE = 5;

const columnConfig: Record<
  EmailColumnKey,
  {
    titleKey: string;
    descriptionKey: string;
    emptyMessageKey: string;
    headingClassName: string;
  }
> = {
  new: {
    titleKey: 'externalSync.board.newSynced',
    descriptionKey: 'syncedEmails.columns.newDescription',
    emptyMessageKey: 'syncedEmails.columns.noNew',
    headingClassName: 'text-slate-700',
  },
  'needs-review': {
    titleKey: 'externalSync.board.needsReview',
    descriptionKey: 'syncedEmails.columns.needsReviewDescription',
    emptyMessageKey: 'syncedEmails.columns.noNeedsReview',
    headingClassName: 'text-amber-700',
  },
  ready: {
    titleKey: 'externalSync.board.readyForAction',
    descriptionKey: 'syncedEmails.columns.readyDescription',
    emptyMessageKey: 'syncedEmails.columns.noReady',
    headingClassName: 'text-emerald-700',
  },
  completed: {
    titleKey: 'externalSync.board.completed',
    descriptionKey: 'syncedEmails.columns.completedDescription',
    emptyMessageKey: 'syncedEmails.columns.noCompleted',
    headingClassName: 'text-blue-700',
  },
  closed: {
    titleKey: 'externalSync.board.rejectedClosed',
    descriptionKey: 'syncedEmails.columns.closedDescription',
    emptyMessageKey: 'syncedEmails.columns.noClosed',
    headingClassName: 'text-rose-700',
  },
};

const columnKeys: EmailColumnKey[] = [
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
  }, {} as Record<EmailColumnKey, number>);
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

function formatSender(email: ExternalEmailMessage, t: Translate) {
  if (email.fromName && email.fromEmail) {
    return `${email.fromName} <${email.fromEmail}>`;
  }

  return email.fromEmail ?? email.fromName ?? t('common.emptyStates.unknownSender');
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

    const action = (appliedAction as Record<string, unknown>).action;

    return typeof action === 'string' ? action : [];
  });
}

function hasGmailDraftCreated(suggestion: AiSuggestion | undefined) {
  return (
    Boolean(getMetadataString(suggestion?.metadataJson?.gmailDraftId)) ||
    getAppliedActionNames(suggestion).includes(
      'CREATE_GMAIL_DRAFT_FROM_EMAIL_REPLY_SUGGESTION',
    )
  );
}

function hasAppliedActions(...suggestions: Array<AiSuggestion | undefined>) {
  return suggestions.some(
    (suggestion) =>
      getAppliedActionNames(suggestion).some((action) =>
        Boolean(getAppliedActionLabel(action, (key) => key)),
      ) || hasGmailDraftCreated(suggestion),
  );
}

function getAppliedLabels(
  t: Translate,
  ...suggestions: Array<AiSuggestion | undefined>
) {
  const labels = new Set<string>();

  suggestions.forEach((suggestion) => {
    getAppliedActionNames(suggestion).forEach((action) => {
      const label = getAppliedActionLabel(action, t);

      if (label) {
        labels.add(label);
      }
    });

    if (hasGmailDraftCreated(suggestion)) {
      labels.add(t('aiSuggestions.completedActions.gmailDraftCreated'));
    }
  });

  return Array.from(labels);
}

function getEmailActionState(
  states: Record<string, EmailActionState>,
  emailId: string,
) {
  return (
    states[emailId] ?? {
      loadingAction: null,
      errorMessage: null,
    }
  );
}

function getFriendlyActionError(error: unknown, t: Translate) {
  if (error instanceof ApiClientError) {
    const message = error.message.toLowerCase();

    if (error.status === 409) {
      return t('externalSync.errors.existingEmailSuggestion');
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
      return t('externalSync.errors.connectGoogleEmails');
    }
  }

  return t('externalSync.errors.emailActionFailed');
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
      return t('externalSync.errors.connectGoogleEmails');
    }

    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return t('externalSync.errors.syncEmailsFailed');
}

function classifyEmail(
  email: ExternalEmailMessage,
  analysisSuggestion: AiSuggestion | undefined,
  replyDraftSuggestion: AiSuggestion | undefined,
): ClassifiedEmail {
  const suggestions = [analysisSuggestion, replyDraftSuggestion].filter(
    Boolean,
  ) as AiSuggestion[];
  const hasCompleted = suggestions.some(
    (suggestion) => hasAppliedActions(suggestion),
  );
  const hasAccepted = suggestions.some((suggestion) =>
    ['ACCEPTED', 'EDITED_AND_ACCEPTED'].includes(suggestion.status),
  );
  const hasPending = suggestions.some(
    (suggestion) => suggestion.status === 'PENDING_REVIEW',
  );
  const allClosed =
    suggestions.length > 0 &&
    suggestions.every((suggestion) =>
      ['REJECTED', 'EXPIRED'].includes(suggestion.status),
    );

  let column: EmailColumnKey = 'new';

  if (hasCompleted) {
    column = 'completed';
  } else if (hasAccepted) {
    column = 'ready';
  } else if (hasPending) {
    column = 'needs-review';
  } else if (allClosed) {
    column = 'closed';
  }

  return {
    email,
    analysisSuggestion,
    replyDraftSuggestion,
    column,
  };
}

function getTotalPages(total: number) {
  return Math.max(1, Math.ceil(total / BOARD_PAGE_SIZE));
}

function paginateItems(items: ClassifiedEmail[], page: number) {
  const startIndex = (page - 1) * BOARD_PAGE_SIZE;

  return items.slice(startIndex, startIndex + BOARD_PAGE_SIZE);
}

type EmailCardProps = {
  item: ClassifiedEmail;
  actionState: EmailActionState;
  canRunWriteActions: boolean;
  onAction: (emailId: string, actionName: EmailActionName) => void;
};

function EmailCard({
  item,
  actionState,
  canRunWriteActions,
  onAction,
}: EmailCardProps) {
  const { email, analysisSuggestion, replyDraftSuggestion } = item;
  const { t } = useI18n();
  const isAnalyzeLoading = actionState.loadingAction === 'analyze';
  const isReplyDraftLoading = actionState.loadingAction === 'reply-draft';
  const isAnyActionLoading = actionState.loadingAction !== null;
  const appliedLabels = getAppliedLabels(
    t,
    analysisSuggestion,
    replyDraftSuggestion,
  );

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="space-y-3">
        <div>
          <h3 className="break-words text-sm font-semibold leading-5 text-slate-950">
            {email.subject ?? t('common.emptyStates.noSubject')}
          </h3>
          <p className="mt-1 break-words text-xs leading-5 text-slate-600">
            {formatSender(email, t)}
          </p>
        </div>

        <p className="text-xs leading-5 text-slate-500">
          {truncateText(email.snippet, 140) || t('common.emptyStates.noSnippet')}
        </p>

        <div className="space-y-1 text-xs text-slate-500">
          <p>
            {t('externalSync.labels.internal')}:{' '}
            {email.internalDate
              ? formatDateTime(email.internalDate)
              : t('common.emptyStates.notSet')}
          </p>
          <p>
            {t('externalSync.labels.synced')}: {formatDateTime(email.syncedAt)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {analysisSuggestion ? (
            <Badge className={getStatusClasses(analysisSuggestion.status)}>
              {t('externalSync.labels.analysis')}:{' '}
              {getAiStatusLabel(analysisSuggestion.status, t)}
            </Badge>
          ) : null}

          {replyDraftSuggestion ? (
            <Badge className={getStatusClasses(replyDraftSuggestion.status)}>
              {t('externalSync.labels.replyDraft')}:{' '}
              {getAiStatusLabel(replyDraftSuggestion.status, t)}
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
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-center text-xs font-medium text-slate-700 transition hover:bg-slate-50"
            >
              {t('externalSync.actions.viewAnalysis')}
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => onAction(email.id, 'analyze')}
              disabled={!canRunWriteActions || isAnyActionLoading}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isAnalyzeLoading
                ? t('externalSync.actions.analyzing')
                : t('externalSync.actions.analyzeEmail')}
            </button>
          )}

          {replyDraftSuggestion ? (
            <Link
              href={`/dashboard/ai-suggestions/${replyDraftSuggestion.id}`}
              className="rounded-xl bg-slate-950 px-3 py-2 text-center text-xs font-medium text-white shadow-sm transition hover:bg-slate-800"
            >
              {t('externalSync.actions.viewReplyDraft')}
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => onAction(email.id, 'reply-draft')}
              disabled={!canRunWriteActions || isAnyActionLoading}
              className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isReplyDraftLoading
                ? t('externalSync.actions.generating')
                : t('externalSync.actions.generateReplyDraft')}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export default function ExternalEmailMessagesBoardPage() {
  const { token, user } = useAuth();
  const { t } = useI18n();

  const [emails, setEmails] = useState<ExternalEmailMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncErrorMessage, setSyncErrorMessage] = useState<string | null>(null);
  const [emailActionStates, setEmailActionStates] = useState<
    Record<string, EmailActionState>
  >({});
  const [analysisSuggestionsByEmailId, setAnalysisSuggestionsByEmailId] =
    useState<Record<string, AiSuggestion>>({});
  const [replyDraftSuggestionsByEmailId, setReplyDraftSuggestionsByEmailId] =
    useState<Record<string, AiSuggestion>>({});
  const [columnPages, setColumnPages] = useState<Record<EmailColumnKey, number>>(
    () => getInitialColumnPages(),
  );

  const canRunWriteActions = canUpdateCrm(user);

  const loadExistingEmailSuggestions = useCallback(async () => {
    if (!token) {
      return;
    }

    const [analysisResponse, replyDraftResponse] = await Promise.all([
      getAiSuggestions(token, {
        page: 1,
        pageSize: SUGGESTIONS_PAGE_SIZE,
        type: 'ANALYZE_EXTERNAL_EMAIL',
        entityType: 'EXTERNAL_EMAIL_MESSAGE',
        sortBy: 'createdAt',
        sortOrder: 'desc',
      }),
      getAiSuggestions(token, {
        page: 1,
        pageSize: SUGGESTIONS_PAGE_SIZE,
        type: 'GENERATE_EMAIL_REPLY_DRAFT',
        entityType: 'EXTERNAL_EMAIL_MESSAGE',
        sortBy: 'createdAt',
        sortOrder: 'desc',
      }),
    ]);

    const nextAnalysisSuggestions: Record<string, AiSuggestion> = {};
    const nextReplyDraftSuggestions: Record<string, AiSuggestion> = {};

    analysisResponse.data.forEach((suggestion) => {
      if (suggestion.externalEmailMessageId) {
        nextAnalysisSuggestions[suggestion.externalEmailMessageId] = suggestion;
      }
    });

    replyDraftResponse.data.forEach((suggestion) => {
      if (suggestion.externalEmailMessageId) {
        nextReplyDraftSuggestions[suggestion.externalEmailMessageId] =
          suggestion;
      }
    });

    setAnalysisSuggestionsByEmailId(nextAnalysisSuggestions);
    setReplyDraftSuggestionsByEmailId(nextReplyDraftSuggestions);

    return {
      analysisSuggestionsByEmailId: nextAnalysisSuggestions,
      replyDraftSuggestionsByEmailId: nextReplyDraftSuggestions,
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
      const [emailsResponse] = await Promise.all([
        getExternalEmailMessages(token, {
          page: 1,
          pageSize: EMAILS_PAGE_SIZE,
        }),
        loadExistingEmailSuggestions(),
      ]);

      setEmails(emailsResponse.data);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage(t('externalSync.errors.loadEmailBoardFailed'));
      }
    } finally {
      setIsLoading(false);
    }
  }, [loadExistingEmailSuggestions, t, token]);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  function updateEmailActionState(
    emailId: string,
    updater: (current: EmailActionState) => EmailActionState,
  ) {
    setEmailActionStates((currentStates) => ({
      ...currentStates,
      [emailId]: updater(getEmailActionState(currentStates, emailId)),
    }));
  }

  async function handleSyncGmail() {
    if (!token || !canRunWriteActions) {
      return;
    }

    setIsSyncing(true);
    setSyncMessage(null);
    setSyncErrorMessage(null);

    try {
      const result = await syncExternalEmailMessages(token);
      const fetched = result.messagesFetched ?? 0;
      const stored = result.messagesStored ?? 0;

      setSyncMessage(
        `${t('syncedEmails.messages.syncCompleted')} ${t(
          'syncedEmails.messages.fetched',
        )} ${fetched} ${t('syncedEmails.messages.messages')} ${t(
          'syncedEmails.messages.stored',
        )} ${stored} ${t('syncedEmails.messages.messages')}`,
      );
      await loadBoard();
    } catch (error) {
      setSyncErrorMessage(getFriendlySyncError(error, t));
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleEmailAiAction(
    emailId: string,
    actionName: EmailActionName,
  ) {
    if (!token || !canRunWriteActions) {
      return;
    }

    updateEmailActionState(emailId, (current) => ({
      ...current,
      loadingAction: actionName,
      errorMessage: null,
    }));

    try {
      const suggestion =
        actionName === 'analyze'
          ? await analyzeExternalEmailMessage(token, emailId)
          : await generateExternalEmailReplyDraft(token, emailId);

      if (actionName === 'analyze') {
        setAnalysisSuggestionsByEmailId((current) => ({
          ...current,
          [emailId]: suggestion,
        }));
      } else {
        setReplyDraftSuggestionsByEmailId((current) => ({
          ...current,
          [emailId]: suggestion,
        }));
      }

      updateEmailActionState(emailId, (current) => ({
        ...current,
        loadingAction: null,
        errorMessage: null,
        ...(actionName === 'analyze'
          ? { analyzeSuggestionId: suggestion.id }
          : { replyDraftSuggestionId: suggestion.id }),
      }));
    } catch (error) {
      let refreshedSuggestions:
        | Awaited<ReturnType<typeof loadExistingEmailSuggestions>>
        | undefined;

      if (error instanceof ApiClientError && error.status === 409) {
        refreshedSuggestions = await loadExistingEmailSuggestions();
      }

      const existingSuggestion =
        actionName === 'analyze'
          ? refreshedSuggestions?.analysisSuggestionsByEmailId[emailId]
          : refreshedSuggestions?.replyDraftSuggestionsByEmailId[emailId];

      updateEmailActionState(emailId, (current) => ({
        ...current,
        loadingAction: null,
        errorMessage: getFriendlyActionError(error, t),
        ...(existingSuggestion && actionName === 'analyze'
          ? { analyzeSuggestionId: existingSuggestion.id }
          : {}),
        ...(existingSuggestion && actionName === 'reply-draft'
          ? { replyDraftSuggestionId: existingSuggestion.id }
          : {}),
      }));
    }
  }

  const classifiedColumns = useMemo(() => {
    const columns = columnKeys.reduce((accumulator, key) => {
      accumulator[key] = [];

      return accumulator;
    }, {} as Record<EmailColumnKey, ClassifiedEmail[]>);

    emails.forEach((email) => {
      const item = classifyEmail(
        email,
        analysisSuggestionsByEmailId[email.id],
        replyDraftSuggestionsByEmailId[email.id],
      );

      columns[item.column].push(item);
    });

    return columns;
  }, [analysisSuggestionsByEmailId, emails, replyDraftSuggestionsByEmailId]);

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

  const totalEmails = emails.length;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={t('syncedEmails.eyebrow')}
        title={t('syncedEmails.boardTitle')}
        description={t('syncedEmails.boardSubtitle')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/external-sync/email-messages/list"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              {t('common.actions.listView')}
            </Link>
            <button
              type="button"
              onClick={() => void handleSyncGmail()}
              disabled={isSyncing || !canRunWriteActions}
              className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSyncing
                ? t('externalSync.actions.syncingGmail')
                : t('externalSync.actions.syncGmail')}
            </button>
          </div>
        }
      />

      <section className="grid gap-3 md:grid-cols-5">
        {[
          t('externalSync.safety.emailMetadataOnly'),
          t('externalSync.safety.noEmailSent'),
          t('externalSync.safety.noGmailDraft'),
          t('externalSync.safety.noCrmRecords'),
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
          {t('syncedEmails.messages.readOnlyRole')}
        </div>
      ) : null}

      {isLoading ? <LoadingSkeleton rows={8} /> : null}

      {!isLoading && errorMessage ? <ErrorState message={errorMessage} /> : null}

      {!isLoading && !errorMessage && totalEmails === 0 ? (
        <EmptyState
          title={t('syncedEmails.emptyStates.noneFound')}
          description={t('syncedEmails.emptyStates.boardDescription')}
        />
      ) : null}

      {!isLoading && !errorMessage && totalEmails > 0 ? (
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
                      <EmailCard
                        key={item.email.id}
                        item={item}
                        actionState={getEmailActionState(
                          emailActionStates,
                          item.email.id,
                        )}
                        canRunWriteActions={canRunWriteActions}
                        onAction={(emailId, actionName) =>
                          void handleEmailAiAction(emailId, actionName)
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
