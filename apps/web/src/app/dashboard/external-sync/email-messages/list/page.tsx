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
  analyzeExternalEmailMessage,
  ApiClientError,
  generateExternalEmailReplyDraft,
  getAiSuggestions,
  getExternalEmailMessages,
  syncExternalEmailMessages,
} from '@/lib/api-client';
import { formatDateTime, formatEnumLabel } from '@/lib/formatters';
import { canUpdateCrm } from '@/lib/permissions';
import type { AiSuggestion, AiSuggestionStatus } from '@/types/ai-suggestions';
import type { ExternalEmailMessage } from '@/types/external-sync';

type EmailActionName = 'analyze' | 'reply-draft';

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

function formatSender(email: ExternalEmailMessage) {
  if (email.fromName && email.fromEmail) {
    return `${email.fromName} <${email.fromEmail}>`;
  }

  return email.fromEmail ?? email.fromName ?? 'Unknown sender';
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

function getFriendlyActionError(error: unknown) {
  if (error instanceof ApiClientError) {
    const message = error.message.toLowerCase();

    if (error.status === 409) {
      return 'An AI suggestion already exists for this email. Open it from the existing suggestion link.';
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
      return 'Connect or reconnect Google before syncing emails.';
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
      return 'Connect or reconnect Google before syncing emails.';
    }

    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Could not sync Gmail messages. Please try again.';
}

export default function ExternalEmailMessagesPage() {
  const { token, user } = useAuth();

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
        setErrorMessage('Could not load synced emails.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [page, searchQuery, token]);

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
        `Gmail sync completed. Fetched ${fetched} message(s), stored ${stored} message(s).`,
      );
      setPage(1);
      await loadEmails();
      await loadExistingEmailSuggestions();
    } catch (error) {
      setSyncErrorMessage(getFriendlySyncError(error));
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
        errorMessage: getFriendlyActionError(error),
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
        eyebrow="AI Inbox"
        title="Synced Emails"
        description="View synced Gmail metadata and create AI suggestions for human review."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/external-sync/email-messages/board"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Board view
            </Link>
            <button
              type="button"
              onClick={handleSyncGmail}
              disabled={isSyncing || !canRunWriteActions}
              className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSyncing ? 'Syncing Gmail...' : 'Sync Gmail'}
            </button>
          </div>
        }
      />

      <section className="grid gap-3 md:grid-cols-5">
        {[
          'AI uses synced email metadata/snippet only.',
          'No email is sent automatically.',
          'No Gmail draft is created automatically.',
          'No CRM records are created automatically.',
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
          Your role can view synced emails, but CRM write permissions are required
          to sync Gmail or create AI suggestions.
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <form
          onSubmit={handleSearchSubmit}
          className="flex flex-col gap-3 md:flex-row md:items-end"
        >
          <label className="flex-1 space-y-2">
            <span className="text-sm font-medium text-slate-700">
              Search synced emails
            </span>
            <input
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Search subject, sender, or snippet"
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

      {!isLoading && !errorMessage && emails.length === 0 ? (
        <EmptyState
          title="No synced emails found"
          description="Run a manual Gmail sync or adjust your search to review synced email metadata."
        />
      ) : null}

      {!isLoading && !errorMessage && emails.length > 0 ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>
              Showing page {page} of {totalPages}
            </span>
            <span>{totalEmails} synced email(s)</span>
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
                        {email.subject ?? 'No subject'}
                      </h2>
                      <p className="mt-1 break-words text-sm text-slate-600">
                        From: {formatSender(email)}
                      </p>
                    </div>

                    <p className="line-clamp-3 max-w-4xl text-sm leading-6 text-slate-600">
                      {email.snippet ?? 'No snippet available.'}
                    </p>

                    <div className="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
                      <div>
                        <p className="font-medium text-slate-950">
                          Internal date
                        </p>
                        <p className="mt-1 text-slate-600">
                          {email.internalDate
                            ? formatDateTime(email.internalDate)
                            : 'Not set'}
                        </p>
                      </div>

                      <div>
                        <p className="font-medium text-slate-950">Synced at</p>
                        <p className="mt-1 text-slate-600">
                          {formatDateTime(email.syncedAt)}
                        </p>
                      </div>

                      <div>
                        <p className="font-medium text-slate-950">
                          Message ID
                        </p>
                        <p className="mt-1 break-all text-slate-500">
                          {email.externalMessageId}
                        </p>
                      </div>

                      <div>
                        <p className="font-medium text-slate-950">Thread ID</p>
                        <p className="mt-1 break-all text-slate-500">
                          {email.externalThreadId ?? 'Not threaded'}
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
                            View analysis
                          </Link>
                        ) : null}

                        {analysisSuggestion ? (
                          <Badge
                            className={getStatusClasses(
                              analysisSuggestion.status as AiSuggestionStatus,
                            )}
                          >
                            Analysis: {formatEnumLabel(analysisSuggestion.status)}
                          </Badge>
                        ) : null}

                        {replyDraftSuggestion ? (
                          <Link
                            href={`/dashboard/ai-suggestions/${replyDraftSuggestion.id}`}
                            className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 transition hover:bg-emerald-100"
                          >
                            View reply draft
                          </Link>
                        ) : null}

                        {replyDraftSuggestion ? (
                          <Badge
                            className={getStatusClasses(
                              replyDraftSuggestion.status as AiSuggestionStatus,
                            )}
                          >
                            Reply draft:{' '}
                            {formatEnumLabel(replyDraftSuggestion.status)}
                          </Badge>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row xl:flex-col">
                    {analysisSuggestion ? (
                      <Link
                        href={`/dashboard/ai-suggestions/${analysisSuggestion.id}`}
                        className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        View analysis
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleEmailAiAction(email.id, 'analyze')}
                        disabled={!canRunWriteActions || isAnyActionLoading}
                        className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isAnalyzeLoading ? 'Analyzing...' : 'Analyze email'}
                      </button>
                    )}

                    {replyDraftSuggestion ? (
                      <Link
                        href={`/dashboard/ai-suggestions/${replyDraftSuggestion.id}`}
                        className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
                      >
                        View reply draft
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
                          ? 'Generating...'
                          : 'Generate reply draft'}
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
