'use client';

import { Badge } from '@/components/ui/Badge';
import { useI18n } from '@/i18n/useI18n';
import { formatDateTime } from '@/lib/formatters';
import type { AiSuggestion } from '@/types/ai-suggestions';

import { InfoTile } from './DetailPrimitives';

export function AiSuggestionHero({
  suggestion,
  statusClassName,
  statusLabel,
  typeLabel,
  confidenceLabel,
  outputLanguageLabel,
  recommendedActionLabel,
}: {
  suggestion: AiSuggestion;
  statusClassName: string;
  statusLabel: string;
  typeLabel: string;
  confidenceLabel: string;
  outputLanguageLabel: string;
  recommendedActionLabel: string;
}) {
  const { t } = useI18n();

  return (
    <article className="overflow-hidden rounded-3xl border border-indigo-100 bg-white shadow-sm">
      <div className="border-b border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-blue-50 px-6 py-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-3 flex flex-wrap gap-2">
              <Badge className={statusClassName}>{statusLabel}</Badge>

              <Badge className="bg-indigo-50 text-indigo-700 ring-indigo-200">
                {typeLabel}
              </Badge>

              <Badge className="bg-slate-100 text-slate-700 ring-slate-200">
                {t('aiSuggestions.labels.confidence')}: {confidenceLabel}
              </Badge>
            </div>

            <h1 className="max-w-4xl text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">
              {suggestion.title ?? t('aiSuggestions.labels.untitled')}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              {t('aiSuggestions.detail.decisionHeroDescription')}
            </p>
          </div>

          <div className="grid min-w-full gap-3 text-sm sm:grid-cols-2 lg:min-w-[420px]">
            <InfoTile
              label={t('aiSuggestions.detail.created')}
              value={formatDateTime(suggestion.createdAt)}
            />
            <InfoTile
              label={t('aiSuggestions.detail.reviewed')}
              value={formatDateTime(suggestion.reviewedAt)}
            />
            <InfoTile
              label={t('aiSuggestions.detail.mainRecommendedAction')}
              value={recommendedActionLabel}
            />
            <InfoTile
              label={t('aiSuggestions.detail.outputLanguage')}
              value={outputLanguageLabel}
            />
          </div>
        </div>
      </div>
    </article>
  );
}
