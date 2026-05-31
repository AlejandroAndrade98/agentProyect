'use client';

import { useI18n } from '@/i18n/useI18n';

import { DecisionMetricCard } from './DetailPrimitives';

export function AiSuggestionSummaryCards({
  suggestedActionLabel,
  importanceLabel,
  confidenceLabel,
  statusLabel,
  isPendingReview,
  outputLanguageLabel,
  completedActionCount,
}: {
  suggestedActionLabel: string;
  importanceLabel: string;
  confidenceLabel: string;
  statusLabel: string;
  isPendingReview: boolean;
  outputLanguageLabel: string;
  completedActionCount: number;
}) {
  const { t } = useI18n();

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
      <DecisionMetricCard
        label={t('aiSuggestions.detail.suggestedAction')}
        value={suggestedActionLabel}
        helper={t('aiSuggestions.detail.suggestedActionHelper')}
        tone="blue"
      />
      <DecisionMetricCard
        label={t('aiSuggestions.detail.importanceOrPriority')}
        value={importanceLabel}
        helper={t('aiSuggestions.detail.importanceOrPriorityHelper')}
      />
      <DecisionMetricCard
        label={t('aiSuggestions.labels.confidence')}
        value={confidenceLabel}
        helper={t('aiSuggestions.detail.confidenceHelper')}
      />
      <DecisionMetricCard
        label={t('aiSuggestions.detail.reviewStatus')}
        value={statusLabel}
        helper={t('aiSuggestions.detail.reviewStatusHelper')}
        tone={isPendingReview ? 'amber' : 'emerald'}
      />
      <DecisionMetricCard
        label={t('aiSuggestions.detail.outputLanguage')}
        value={outputLanguageLabel}
        helper={t('aiSuggestions.detail.outputLanguageHelper')}
      />
      <DecisionMetricCard
        label={t('aiSuggestions.detail.completedActionsSummary')}
        value={String(completedActionCount)}
        helper={t('aiSuggestions.detail.completedActionsSummaryHelper')}
        tone={completedActionCount > 0 ? 'emerald' : 'slate'}
      />
    </section>
  );
}
