'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/hooks/useAuth';
import { getAiStatusLabel, type Translate } from '@/i18n/ai-display';
import { useI18n } from '@/i18n/useI18n';
import {
  ApiClientError,
  generateLeadNextStepsSuggestion,
  getAiSuggestions,
} from '@/lib/api-client';
import { formatDateTime } from '@/lib/formatters';
import { canUpdateCrm } from '@/lib/permissions';
import type {
  AiSuggestion,
  AiSuggestionStatus,
} from '@/types/ai-suggestions';

type LeadAiSuggestionsPanelProps = {
  leadId: string;
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

function formatConfidence(value: number | null, t: Translate) {
  if (value === null) {
    return t('common.emptyStates.notSet');
  }

  return `${Math.round(value * 100)}%`;
}

export function LeadAiSuggestionsPanel({ leadId }: LeadAiSuggestionsPanelProps) {
  const { token, user } = useAuth();
  const { t } = useI18n();

  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadSuggestions = useCallback(async () => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await getAiSuggestions(token, {
        page: 1,
        pageSize: 3,
        leadId,
        type: 'SUGGEST_NEXT_STEPS',
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      setSuggestions(response.data);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage(t('crm.leadAi.loadFailed'));
      }
    } finally {
      setIsLoading(false);
    }
  }, [leadId, token, t]);

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  async function handleGenerateSuggestion() {
    if (!token) {
      return;
    }

    setIsGenerating(true);
    setErrorMessage(null);

    try {
      await generateLeadNextStepsSuggestion(token, leadId);
      await loadSuggestions();
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage(t('crm.leadAi.generateFailed'));
      }
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="text-sm font-medium text-blue-700">
            {t('crm.leadAi.eyebrow')}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">
            {t('crm.leadAi.title')}
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            {t('crm.leadAi.description')}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/dashboard/ai-suggestions?leadId=${leadId}`}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            {t('common.actions.viewAll')}
          </Link>

          {canUpdateCrm(user) ? (
            <button
              type="button"
              onClick={handleGenerateSuggestion}
              disabled={isGenerating}
              className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isGenerating
                ? t('crm.leadAi.generating')
                : t('crm.leadAi.suggestNextSteps')}
            </button>
          ) : null}
        </div>
      </div>

      {errorMessage ? (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      {isLoading ? (
        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          {t('crm.leadAi.loading')}
        </div>
      ) : null}

      {!isLoading && suggestions.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
          {t('crm.leadAi.empty')}
        </div>
      ) : null}

      {!isLoading && suggestions.length > 0 ? (
        <div className="mt-5 space-y-3">
          {suggestions.map((suggestion) => (
            <article
              key={suggestion.id}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4"
            >
              <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <Badge className={getStatusClasses(suggestion.status)}>
                      {getAiStatusLabel(suggestion.status, t)}
                    </Badge>

                    <Badge className="bg-indigo-50 text-indigo-700 ring-indigo-200">
                      {t('common.labels.confidence')}:{' '}
                      {formatConfidence(suggestion.confidenceScore, t)}
                    </Badge>
                  </div>

                  <div>
                    <p className="font-medium text-slate-950">
                      {suggestion.title ?? t('crm.leadAi.suggestion')}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {t('crm.leadAi.created')}{' '}
                      {formatDateTime(suggestion.createdAt)}
                    </p>
                  </div>

                  <p className="line-clamp-3 whitespace-pre-line text-sm leading-6 text-slate-600">
                    {suggestion.outputText ??
                      t('common.emptyStates.noOutputText')}
                  </p>
                </div>

                <Link
                  href={`/dashboard/ai-suggestions/${suggestion.id}`}
                  className="rounded-xl bg-white px-4 py-2 text-center text-sm font-medium text-slate-700 ring-1 ring-inset ring-slate-300 transition hover:bg-slate-100"
                >
                  {t('common.actions.review')}
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
