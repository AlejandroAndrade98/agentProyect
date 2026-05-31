'use client';

import { Badge } from '@/components/ui/Badge';
import { useI18n } from '@/i18n/useI18n';
import type { AiSuggestion } from '@/types/ai-suggestions';

import { SectionIntro } from './DetailPrimitives';

export function AiRecommendationSection({
  suggestion,
  statusClassName,
  statusLabel,
  typeLabel,
  confidenceLabel,
}: {
  suggestion: AiSuggestion;
  statusClassName: string;
  statusLabel: string;
  typeLabel: string;
  confidenceLabel: string;
}) {
  const { t } = useI18n();

  return (
    <article className="rounded-3xl border border-indigo-100 bg-gradient-to-br from-white to-indigo-50/40 p-6 shadow-sm">
      <div className="mb-5 flex flex-wrap gap-2">
        <Badge className={statusClassName}>{statusLabel}</Badge>

        <Badge className="bg-indigo-50 text-indigo-700 ring-indigo-200">
          {typeLabel}
        </Badge>

        <Badge className="bg-slate-100 text-slate-700 ring-slate-200">
          {t('aiSuggestions.labels.confidence')}: {confidenceLabel}
        </Badge>
      </div>

      <SectionIntro
        eyebrow={t('aiSuggestions.detail.aiOutput')}
        title={t('aiSuggestions.detail.aiRecommendation')}
        description={t('aiSuggestions.detail.aiRecommendationDescription')}
      />

      <p className="mt-4 whitespace-pre-line rounded-2xl border border-indigo-100 bg-white p-5 text-sm leading-7 text-slate-700 shadow-sm">
        {suggestion.outputText ?? t('aiSuggestions.detail.noOutputText')}
      </p>
    </article>
  );
}
