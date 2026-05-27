'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import { useAuth } from '@/hooks/useAuth';
import { ApiClientError, getAiSuggestions } from '@/lib/api-client';
import { formatDateTime, formatEnumLabel } from '@/lib/formatters';
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
  'ANALYZE_EXTERNAL_EMAIL',
  'ANALYZE_EXTERNAL_CALENDAR_EVENT',
];

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

  if (suggestion.type === 'ANALYZE_EXTERNAL_CALENDAR_EVENT') {
    return 'Synced calendar metadata';
  }

  if (suggestion.leadId) {
    return 'Lead recommendation';
  }

  return 'AI suggestion';
}

export default function AiSuggestionsPage() {
  const { token } = useAuth();

  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([]);
  const [status, setStatus] = useState<AiSuggestionStatus | ''>('');
  const [type, setType] = useState<AiSuggestionType | ''>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
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
        status: status || undefined,
        type: type || undefined,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      setSuggestions(response.data);
      setTotalPages(response.meta.totalPages || 1);
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
  }, [page, status, token, type]);

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  const hasFilters = useMemo(() => Boolean(status || type), [status, type]);

  function clearFilters() {
    setStatus('');
    setType('');
    setPage(1);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="AI Suggestions"
        description="Review AI-generated CRM suggestions before any official data is changed."
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
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
                  {option ? formatEnumLabel(option) : 'All statuses'}
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
                  {option ? formatEnumLabel(option) : 'All types'}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end">
            <button
              type="button"
              onClick={clearFilters}
              disabled={!hasFilters}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clear filters
            </button>
          </div>
        </div>
      </section>

      {isLoading ? <LoadingSkeleton rows={8} /> : null}

      {!isLoading && errorMessage ? <ErrorState message={errorMessage} /> : null}

      {!isLoading && !errorMessage && suggestions.length === 0 ? (
        <EmptyState
          title="No AI suggestions found"
          description="Generate suggestions from leads or synced external metadata to start reviewing AI-assisted recommendations."
        />
      ) : null}

      {!isLoading && !errorMessage && suggestions.length > 0 ? (
        <section className="space-y-4">
          {suggestions.map((suggestion) => (
            <article
              key={suggestion.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={getStatusClasses(suggestion.status)}>
                      {formatEnumLabel(suggestion.status)}
                    </Badge>

                    <Badge className="bg-indigo-50 text-indigo-700 ring-indigo-200">
                      {formatEnumLabel(suggestion.type)}
                    </Badge>

                    <Badge className="bg-slate-100 text-slate-700 ring-slate-200">
                      Confidence: {getConfidenceLabel(suggestion)}
                    </Badge>
                    <Badge className="bg-blue-50 text-blue-700 ring-blue-200">
                      {getSuggestionContextLabel(suggestion)}
                    </Badge>
                  </div>

                  <div>
                    <Link
                      href={`/dashboard/ai-suggestions/${suggestion.id}`}
                      className="text-lg font-semibold text-slate-950 transition hover:text-blue-700"
                    >
                      {suggestion.title ?? 'Untitled AI suggestion'}
                    </Link>

                    <p className="mt-1 text-sm text-slate-500">
                      Created: {formatDateTime(suggestion.createdAt)}
                    </p>
                  </div>

                  <p className="line-clamp-3 max-w-4xl whitespace-pre-line text-sm leading-6 text-slate-600">
                    {suggestion.outputText ?? 'No output text available.'}
                  </p>

                  <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                    <span>Provider: {suggestion.provider}</span>

                    {suggestion.entityType && suggestion.entityId ? (
                      <span>
                        Entity: {formatEnumLabel(suggestion.entityType)} / {suggestion.entityId}
                      </span>
                    ) : null}

                    {suggestion.externalEmailMessage ? (
                        <>
                          <div>
                            <p className="font-medium text-slate-950">Subject</p>
                            <p className="mt-1 text-slate-600">
                              {suggestion.externalEmailMessage.subject ?? 'No subject'}
                            </p>
                          </div>

                          <div>
                            <p className="font-medium text-slate-950">From</p>
                            <p className="mt-1 text-slate-600">
                              {suggestion.externalEmailMessage.fromName ||
                                suggestion.externalEmailMessage.fromEmail ||
                                'Unknown sender'}
                            </p>
                            {suggestion.externalEmailMessage.fromEmail ? (
                              <p className="mt-1 break-all text-xs text-slate-500">
                                {suggestion.externalEmailMessage.fromEmail}
                              </p>
                            ) : null}
                          </div>

                          <div className="md:col-span-2">
                            <p className="font-medium text-slate-950">Snippet</p>
                            <p className="mt-1 leading-6 text-slate-600">
                              {suggestion.externalEmailMessage.snippet ?? 'No snippet available'}
                            </p>
                          </div>

                          <div>
                            <p className="font-medium text-slate-950">Internal date</p>
                            <p className="mt-1 text-slate-600">
                              {suggestion.externalEmailMessage.internalDate
                                ? formatDateTime(suggestion.externalEmailMessage.internalDate)
                                : 'Not set'}
                            </p>
                          </div>

                          <div>
                            <p className="font-medium text-slate-950">Synced at</p>
                            <p className="mt-1 text-slate-600">
                              {formatDateTime(suggestion.externalEmailMessage.syncedAt)}
                            </p>
                          </div>
                        </>
                      ) : null}

                    {suggestion.externalEmailMessageId ? (
                      <span>Email message: {suggestion.externalEmailMessageId}</span>
                    ) : null}

                    {suggestion.externalCalendarEventId ? (
                      <span>Calendar event: {suggestion.externalCalendarEventId}</span>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
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
                    Review
                  </Link>
                </div>
              </div>
            </article>
          ))}

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