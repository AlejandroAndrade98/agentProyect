'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import { useAuth } from '@/hooks/useAuth';
import { ApiClientError, getAiSuggestion } from '@/lib/api-client';
import { formatDateTime, formatEnumLabel } from '@/lib/formatters';
import type { AiSuggestion, AiSuggestionStatus } from '@/types/ai-suggestions';

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

export default function AiSuggestionDetailPage() {
  const params = useParams<{ id: string }>();
  const { token } = useAuth();

  const [suggestion, setSuggestion] = useState<AiSuggestion | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadSuggestion = useCallback(async () => {
    if (!token || !params.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await getAiSuggestion(token, params.id);
      setSuggestion(response);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Could not load AI suggestion.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [params.id, token]);

  useEffect(() => {
    loadSuggestion();
  }, [loadSuggestion]);

  return (
    <div className="space-y-8">
      <PageHeader
        title={suggestion?.title ?? 'AI Suggestion'}
        description="Review the AI-generated recommendation before applying any CRM changes."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/ai-suggestions"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Back to suggestions
            </Link>

            {suggestion?.leadId ? (
              <Link
                href={`/dashboard/leads/${suggestion.leadId}`}
                className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
              >
                View lead
              </Link>
            ) : null}
          </div>
        }
      />

      {isLoading ? <LoadingSkeleton rows={8} /> : null}

      {!isLoading && errorMessage ? <ErrorState message={errorMessage} /> : null}

      {!isLoading && !errorMessage && suggestion ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <section className="space-y-6">
            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex flex-wrap gap-2">
                <Badge className={getStatusClasses(suggestion.status)}>
                  {formatEnumLabel(suggestion.status)}
                </Badge>

                <Badge className="bg-indigo-50 text-indigo-700 ring-indigo-200">
                  {formatEnumLabel(suggestion.type)}
                </Badge>

                <Badge className="bg-slate-100 text-slate-700 ring-slate-200">
                  Confidence: {formatConfidence(suggestion.confidenceScore)}
                </Badge>
              </div>

              <h2 className="text-lg font-semibold text-slate-950">
                Suggested output
              </h2>

              <p className="mt-4 whitespace-pre-line text-sm leading-7 text-slate-700">
                {suggestion.outputText ?? 'No output text available.'}
              </p>
            </article>

            {suggestion.outputJson ? (
              <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-950">
                  Structured recommendation
                </h2>

                <div className="mt-5 space-y-5 text-sm text-slate-700">
                  <div>
                    <p className="font-medium text-slate-950">Summary</p>
                    <p className="mt-1 leading-6">
                      {suggestion.outputJson.summary}
                    </p>
                  </div>

                  <div>
                    <p className="font-medium text-slate-950">
                      Recommended next step
                    </p>
                    <p className="mt-1 leading-6">
                      {suggestion.outputJson.recommendedNextStep}
                    </p>
                  </div>

                  <div>
                    <p className="font-medium text-slate-950">Suggested note</p>
                    <p className="mt-1 leading-6">
                      {suggestion.outputJson.suggestedNote}
                    </p>
                  </div>

                  <div>
                    <p className="font-medium text-slate-950">
                      Suggested tasks
                    </p>

                    <div className="mt-2 space-y-3">
                      {suggestion.outputJson.suggestedTasks.map((task) => (
                        <div
                          key={`${task.title}-${task.dueInDays}`}
                          className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                        >
                          <p className="font-medium text-slate-950">
                            {task.title}
                          </p>
                          <p className="mt-1 leading-6">{task.description}</p>
                          <p className="mt-2 text-xs text-slate-500">
                            Priority: {formatEnumLabel(task.priority)} · Due in{' '}
                            {task.dueInDays} day(s)
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="font-medium text-slate-950">
                      Reasoning summary
                    </p>
                    <p className="mt-1 leading-6">
                      {suggestion.outputJson.reasoningSummary}
                    </p>
                  </div>
                </div>
              </article>
            ) : null}

            <article className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
              <h2 className="text-base font-semibold text-amber-900">
                Human approval required
              </h2>

              <p className="mt-2 text-sm leading-6 text-amber-800">
                This AI suggestion is review-only. It cannot update CRM records,
                create tasks, create notes, or send emails automatically. A human
                must approve any future action before it becomes official.
              </p>
            </article>
          </section>

          <aside className="space-y-4">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-slate-950">Suggestion info</h2>

              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-slate-500">Created</dt>
                  <dd className="font-medium text-slate-800">
                    {formatDateTime(suggestion.createdAt)}
                  </dd>
                </div>

                <div>
                  <dt className="text-slate-500">Expires</dt>
                  <dd className="font-medium text-slate-800">
                    {formatDateTime(suggestion.expiresAt)}
                  </dd>
                </div>

                <div>
                  <dt className="text-slate-500">Provider</dt>
                  <dd className="font-medium text-slate-800">
                    {suggestion.provider}
                  </dd>
                </div>

                <div>
                  <dt className="text-slate-500">Model</dt>
                  <dd className="font-medium text-slate-800">
                    {suggestion.metadataJson?.model ?? 'Not set'}
                  </dd>
                </div>

                <div>
                  <dt className="text-slate-500">Tokens</dt>
                  <dd className="font-medium text-slate-800">
                    Input {suggestion.tokensInput ?? 0} · Output{' '}
                    {suggestion.tokensOutput ?? 0}
                  </dd>
                </div>

                <div>
                  <dt className="text-slate-500">Cost</dt>
                  <dd className="font-medium text-slate-800">
                    ${suggestion.estimatedCostUsd ?? 0}
                  </dd>
                </div>
              </dl>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-slate-950">Safety flags</h2>

              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-slate-500">Human approval required</dt>
                  <dd className="font-medium text-slate-800">
                    {String(
                      suggestion.metadataJson?.humanApprovalRequired ?? true,
                    )}
                  </dd>
                </div>

                <div>
                  <dt className="text-slate-500">Can apply automatically</dt>
                  <dd className="font-medium text-slate-800">
                    {String(
                      suggestion.metadataJson?.canApplyAutomatically ?? false,
                    )}
                  </dd>
                </div>

                <div>
                  <dt className="text-slate-500">Can send email automatically</dt>
                  <dd className="font-medium text-slate-800">
                    {String(
                      suggestion.metadataJson?.canSendEmailAutomatically ??
                        false,
                    )}
                  </dd>
                </div>
              </dl>
            </article>
          </aside>
        </div>
      ) : null}
    </div>
  );
}