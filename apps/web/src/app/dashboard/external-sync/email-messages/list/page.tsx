'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import { GmailImportPanel } from '../components/GmailImportPanel';
import { useAuth } from '@/hooks/useAuth';
import {
  getAiStatusLabel,
  type Translate,
} from '@/i18n/ai-display';
import { useI18n } from '@/i18n/useI18n';
import {
  analyzeExternalEmailMessage,
  ApiClientError,
  dismissExternalEmailMessage,
  generateExternalEmailReplyDraft,
  getAiSuggestions,
  getExternalEmailMessages,
  restoreExternalEmailMessage,
  syncExternalEmailMessages,
} from '@/lib/api-client';
import { formatDateTime, formatEnumLabel } from '@/lib/formatters';
import { canUpdateCrm } from '@/lib/permissions';
import type { AiSuggestion, AiSuggestionStatus } from '@/types/ai-suggestions';
import type { ExternalEmailMessage } from '@/types/external-sync';

type EmailActionName = 'analyze' | 'reply-draft';
type EmailMessagesView = 'active' | 'dismissed';

type EmailActionState = {
  loadingAction: EmailActionName | null;
  errorMessage: string | null;
  analyzeSuggestionId?: string;
  replyDraftSuggestionId?: string;
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

function formatSender(email: ExternalEmailMessage, t: Translate) {
  if (email.fromName && email.fromEmail) {
    return `${email.fromName} <${email.fromEmail}>`;
  }

  return email.fromEmail ?? email.fromName ?? t('common.emptyStates.unknownSender');
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

export default function ExternalEmailMessagesPage() {
  const { token, user } = useAuth();
  const { t } = useI18n();

  const [emails, setEmails] = useState<ExternalEmailMessage[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEmails, setTotalEmails] = useState(0);
  const [searchDraft, setSearchDraft] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncErrorMessage, setSyncErrorMessage] = useState<string | null>(null);
  const [emailView, setEmailView] = useState<EmailMessagesView>('active');
  const [isImportPanelOpen, setIsImportPanelOpen] = useState(false);
  const [emailManagementMessage, setEmailManagementMessage] = useState<
    string | null
  >(null);
  const [emailManagementErrorMessage, setEmailManagementErrorMessage] =
    useState<string | null>(null);
  const [emailManagementActionId, setEmailManagementActionId] = useState<
    string | null
  >(null);
  const [emailActionStates, setEmailActionStates] = useState<
    Record<string, EmailActionState>
  >({});
  const [analysisSuggestionsByEmailId, setAnalysisSuggestionsByEmailId] =
    useState<Record<string, AiSuggestion>>({});
  const [replyDraftSuggestionsByEmailId, setReplyDraftSuggestionsByEmailId] =
    useState<Record<string, AiSuggestion>>({});

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

  const loadEmails = useCallback(async () => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await getExternalEmailMessages(token, {
        page,
        pageSize: PAGE_SIZE,
        view: emailView,
        q: searchQuery || undefined,
      });
      const responseTotalPages =
        response.meta.totalPages ?? response.meta.pageCount ?? 1;

      setEmails(response.data);
      setTotalEmails(response.meta.total);
      setTotalPages(Math.max(responseTotalPages, 1));
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage(t('externalSync.errors.loadEmailsFailed'));
      }
    } finally {
      setIsLoading(false);
    }
  }, [emailView, page, searchQuery, t, token]);

  useEffect(() => {
    loadEmails();
  }, [loadEmails]);

  useEffect(() => {
    loadExistingEmailSuggestions().catch(() => {
      // Existing suggestion links are helpful but should not block email listing.
    });
  }, [loadExistingEmailSuggestions]);

  const hasSearch = useMemo(() => Boolean(searchQuery), [searchQuery]);

  function updateEmailActionState(
    emailId: string,
    updater: (current: EmailActionState) => EmailActionState,
  ) {
    setEmailActionStates((currentStates) => ({
      ...currentStates,
      [emailId]: updater(getEmailActionState(currentStates, emailId)),
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
      setPage(1);
      await loadEmails();
      await loadExistingEmailSuggestions();
    } catch (error) {
      setSyncErrorMessage(getFriendlySyncError(error, t));
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleDismissEmail(emailId: string) {
    if (!token || !canRunWriteActions) {
      return;
    }

    setEmailManagementActionId(emailId);
    setEmailManagementMessage(null);
    setEmailManagementErrorMessage(null);

    try {
      await dismissExternalEmailMessage(token, emailId);
      setEmails((currentEmails) =>
        currentEmails.filter((email) => email.id !== emailId),
      );
      setTotalEmails((currentTotal) => Math.max(currentTotal - 1, 0));
      setEmailManagementMessage(t('syncedEmails.messages.dismissed'));
    } catch (error) {
      setEmailManagementErrorMessage(getFriendlySyncError(error, t));
    } finally {
      setEmailManagementActionId(null);
    }
  }

  async function handleRestoreEmail(emailId: string) {
    if (!token || !canRunWriteActions) {
      return;
    }

    setEmailManagementActionId(emailId);
    setEmailManagementMessage(null);
    setEmailManagementErrorMessage(null);

    try {
      await restoreExternalEmailMessage(token, emailId);
      setEmails((currentEmails) =>
        currentEmails.filter((email) => email.id !== emailId),
      );
      setTotalEmails((currentTotal) => Math.max(currentTotal - 1, 0));
      setEmailManagementMessage(t('syncedEmails.messages.restored'));
    } catch (error) {
      setEmailManagementErrorMessage(getFriendlySyncError(error, t));
    } finally {
      setEmailManagementActionId(null);
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

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={t('syncedEmails.eyebrow')}
        title={t('syncedEmails.title')}
        description={t('syncedEmails.subtitle')}
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setIsImportPanelOpen((current) => !current)}
              disabled={!canRunWriteActions}
              className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {t('syncedEmails.import.searchGmail')}
            </button>
            <Link
              href="/dashboard/external-sync/email-messages/board"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              {t('common.actions.boardView')}
            </Link>
            <button
              type="button"
              onClick={handleSyncGmail}
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

      {isImportPanelOpen ? (
        <GmailImportPanel
          token={token}
          canRunWriteActions={canRunWriteActions}
          onImported={loadEmails}
          onClose={() => setIsImportPanelOpen(false)}
        />
      ) : null}

      <section className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        {(['active', 'dismissed'] as EmailMessagesView[]).map((view) => (
          <button
            key={view}
            type="button"
            onClick={() => {
              setEmailView(view);
              setPage(1);
            }}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              emailView === view
                ? 'bg-slate-950 text-white shadow-sm'
                : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {view === 'active'
              ? t('syncedEmails.view.active')
              : t('syncedEmails.view.dismissed')}
          </button>
        ))}
      </section>

      {syncMessage ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
          {syncMessage}
        </div>
      ) : null}

      {emailManagementMessage ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
          {emailManagementMessage}
        </div>
      ) : null}

      {emailManagementErrorMessage ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800">
          {emailManagementErrorMessage}
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

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <form
          onSubmit={handleSearchSubmit}
          className="flex flex-col gap-3 md:flex-row md:items-end"
        >
          <label className="flex-1 space-y-2">
            <span className="text-sm font-medium text-slate-700">
              {t('syncedEmails.list.searchLabel')}
            </span>
            <input
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder={t('syncedEmails.list.searchPlaceholder')}
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

      {!isLoading && !errorMessage && emails.length === 0 ? (
        <EmptyState
          title={
            emailView === 'dismissed'
              ? t('syncedEmails.emptyStates.noDismissed')
              : t('syncedEmails.emptyStates.noneFound')
          }
          description={
            emailView === 'dismissed'
              ? t('syncedEmails.emptyStates.dismissedDescription')
              : t('syncedEmails.emptyStates.listDescription')
          }
        />
      ) : null}

      {!isLoading && !errorMessage && emails.length > 0 ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>
              {t('common.pagination.showingPage')} {page}{' '}
              {t('common.pagination.of')} {totalPages}
            </span>
            <span>
              {totalEmails} {t('syncedEmails.list.total')}
            </span>
          </div>

          {emails.map((email) => {
            const actionState = getEmailActionState(
              emailActionStates,
              email.id,
            );
            const isAnalyzeLoading = actionState.loadingAction === 'analyze';
            const isReplyDraftLoading =
              actionState.loadingAction === 'reply-draft';
            const isAnyActionLoading = actionState.loadingAction !== null;
            const analysisSuggestion =
              analysisSuggestionsByEmailId[email.id] ??
              (actionState.analyzeSuggestionId
                ? { id: actionState.analyzeSuggestionId, status: 'PENDING_REVIEW' }
                : null);
            const replyDraftSuggestion =
              replyDraftSuggestionsByEmailId[email.id] ??
              (actionState.replyDraftSuggestionId
                ? {
                    id: actionState.replyDraftSuggestionId,
                    status: 'PENDING_REVIEW',
                  }
                : null);

            return (
              <article
                key={email.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
                  <div className="min-w-0 flex-1 space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="bg-blue-50 text-blue-700 ring-blue-200">
                        {formatEnumLabel(email.provider)}
                      </Badge>

                      {email.connectedAccount ? (
                        <Badge className="bg-slate-100 text-slate-700 ring-slate-200">
                          {email.connectedAccount.displayName ||
                            email.connectedAccount.email}
                        </Badge>
                      ) : null}
                    </div>

                    <div>
                      <h2 className="break-words text-lg font-semibold text-slate-950">
                        {email.subject ?? t('common.emptyStates.noSubject')}
                      </h2>
                      <p className="mt-1 break-words text-sm text-slate-600">
                        {t('externalSync.labels.from')}: {formatSender(email, t)}
                      </p>
                    </div>

                    <p className="line-clamp-3 max-w-4xl text-sm leading-6 text-slate-600">
                      {email.snippet ?? t('common.emptyStates.noSnippet')}
                    </p>

                    <div className="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
                      <div>
                        <p className="font-medium text-slate-950">
                          {t('externalSync.labels.internalDate')}
                        </p>
                        <p className="mt-1 text-slate-600">
                          {email.internalDate
                            ? formatDateTime(email.internalDate)
                            : t('common.emptyStates.notSet')}
                        </p>
                      </div>

                      <div>
                        <p className="font-medium text-slate-950">
                          {t('externalSync.labels.syncedAt')}
                        </p>
                        <p className="mt-1 text-slate-600">
                          {formatDateTime(email.syncedAt)}
                        </p>
                      </div>

                      {emailView === 'dismissed' ? (
                        <div>
                          <p className="font-medium text-slate-950">
                            {t('syncedEmails.view.dismissedAt')}
                          </p>
                          <p className="mt-1 text-slate-600">
                            {email.dismissedAt
                              ? formatDateTime(email.dismissedAt)
                              : t('common.emptyStates.notSet')}
                          </p>
                        </div>
                      ) : null}

                      <div>
                        <p className="font-medium text-slate-950">
                          {t('externalSync.labels.messageId')}
                        </p>
                        <p className="mt-1 break-all text-slate-500">
                          {email.externalMessageId}
                        </p>
                      </div>

                      <div>
                        <p className="font-medium text-slate-950">
                          {t('externalSync.labels.threadId')}
                        </p>
                        <p className="mt-1 break-all text-slate-500">
                          {email.externalThreadId ??
                            t('syncedEmails.messages.notThreaded')}
                        </p>
                      </div>
                    </div>

                    {actionState.errorMessage ? (
                      <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-800">
                        {actionState.errorMessage}
                      </div>
                    ) : null}

                    {analysisSuggestion || replyDraftSuggestion ? (
                      <div className="flex flex-wrap gap-2">
                        {analysisSuggestion ? (
                          <Link
                            href={`/dashboard/ai-suggestions/${analysisSuggestion.id}`}
                            className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 transition hover:bg-emerald-100"
                          >
                            {t('externalSync.actions.viewAnalysis')}
                          </Link>
                        ) : null}

                        {analysisSuggestion ? (
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
                        ) : null}

                        {replyDraftSuggestion ? (
                          <Link
                            href={`/dashboard/ai-suggestions/${replyDraftSuggestion.id}`}
                            className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 transition hover:bg-emerald-100"
                          >
                            {t('externalSync.actions.viewReplyDraft')}
                          </Link>
                        ) : null}

                        {replyDraftSuggestion ? (
                          <Badge
                            className={getStatusClasses(
                              replyDraftSuggestion.status as AiSuggestionStatus,
                            )}
                          >
                            {t('externalSync.labels.replyDraft')}:{' '}
                            {getAiStatusLabel(
                              replyDraftSuggestion.status as AiSuggestionStatus,
                              t,
                            )}
                          </Badge>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row xl:flex-col">
                    {emailView === 'dismissed' ? (
                      <button
                        type="button"
                        onClick={() => handleRestoreEmail(email.id)}
                        disabled={
                          !canRunWriteActions ||
                          emailManagementActionId === email.id
                        }
                        className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {emailManagementActionId === email.id
                          ? t('syncedEmails.actions.restoring')
                          : t('syncedEmails.actions.restore')}
                      </button>
                    ) : null}

                    {emailView === 'active' ? (
                      <button
                        type="button"
                        onClick={() => handleDismissEmail(email.id)}
                        disabled={
                          !canRunWriteActions ||
                          emailManagementActionId === email.id
                        }
                        className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {emailManagementActionId === email.id
                          ? t('syncedEmails.actions.dismissing')
                          : t('syncedEmails.actions.dismiss')}
                      </button>
                    ) : null}

                    {emailView === 'active' ? (
                      <>
                    {analysisSuggestion ? (
                      <Link
                        href={`/dashboard/ai-suggestions/${analysisSuggestion.id}`}
                        className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        {t('externalSync.actions.viewAnalysis')}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleEmailAiAction(email.id, 'analyze')}
                        disabled={!canRunWriteActions || isAnyActionLoading}
                        className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isAnalyzeLoading
                          ? t('externalSync.actions.analyzing')
                          : t('externalSync.actions.analyzeEmail')}
                      </button>
                    )}

                    {replyDraftSuggestion ? (
                      <Link
                        href={`/dashboard/ai-suggestions/${replyDraftSuggestion.id}`}
                        className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
                      >
                        {t('externalSync.actions.viewReplyDraft')}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          handleEmailAiAction(email.id, 'reply-draft')
                        }
                        disabled={!canRunWriteActions || isAnyActionLoading}
                        className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isReplyDraftLoading
                          ? t('externalSync.actions.generating')
                          : t('externalSync.actions.generateReplyDraft')}
                      </button>
                    )}
                      </>
                    ) : null}
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
