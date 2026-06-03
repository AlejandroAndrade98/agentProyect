'use client';

import type { ReactNode } from 'react';

import { Badge } from '@/components/ui/Badge';
import { getPriorityLabel } from '@/i18n/ai-display';
import { useI18n } from '@/i18n/useI18n';
import { formatEnumLabel } from '@/lib/formatters';
import type {
  AiSuggestion,
  ExternalEmailAnalysisOutput,
} from '@/types/ai-suggestions';

import { SectionIntro } from './DetailPrimitives';

function isExternalEmailAnalysisOutput(
  output: AiSuggestion['outputJson'],
): output is ExternalEmailAnalysisOutput {
  return Boolean(
    output &&
      'suggestedReviewAction' in output &&
      'importanceLevel' in output &&
      'detectedSignals' in output,
  );
}

function RecommendationBlock({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <div className="mt-3 text-sm leading-7 text-slate-700">{children}</div>
    </section>
  );
}

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
  const externalEmailOutput =
    suggestion.type === 'ANALYZE_EXTERNAL_EMAIL' &&
    isExternalEmailAnalysisOutput(suggestion.outputJson)
      ? suggestion.outputJson
      : null;

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

      {externalEmailOutput ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                {t('aiSuggestions.detail.suggestedAction')}
              </p>
              <p className="mt-2 text-base font-semibold text-blue-950">
                {formatEnumLabel(externalEmailOutput.suggestedReviewAction)}
              </p>
            </div>

            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                {t('aiSuggestions.detail.importance')}
              </p>
              <p className="mt-2 text-base font-semibold text-amber-950">
                {getPriorityLabel(externalEmailOutput.importanceLevel, t)}
              </p>
            </div>
          </div>

          <RecommendationBlock label={t('aiSuggestions.detail.summary')}>
            <p className="whitespace-pre-line">{externalEmailOutput.summary}</p>
          </RecommendationBlock>

          <RecommendationBlock
            label={t('aiSuggestions.detail.detectedSignals')}
          >
            {externalEmailOutput.detectedSignals.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {externalEmailOutput.detectedSignals.map((signal) => (
                  <Badge
                    key={signal}
                    className="bg-slate-100 text-slate-700 ring-slate-200"
                  >
                    {formatEnumLabel(signal)}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-slate-500">
                {t('aiSuggestions.detail.noSignalsDetected')}
              </p>
            )}
          </RecommendationBlock>

          {externalEmailOutput.suggestedNote ? (
            <RecommendationBlock label={t('aiSuggestions.detail.suggestedNote')}>
              <p className="whitespace-pre-line">
                {externalEmailOutput.suggestedNote}
              </p>
            </RecommendationBlock>
          ) : null}

          {externalEmailOutput.suggestedTasks.length > 0 ? (
            <RecommendationBlock
              label={t('aiSuggestions.detail.suggestedTasks')}
            >
              <div className="space-y-3">
                {externalEmailOutput.suggestedTasks.map((task) => (
                  <div
                    key={`${task.title}-${task.dueInDays}`}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="font-semibold text-slate-950">
                        {task.title}
                      </p>
                      <Badge className="bg-white text-slate-700 ring-slate-200">
                        {getPriorityLabel(task.priority, t)}
                      </Badge>
                    </div>
                    <p className="mt-2 whitespace-pre-line">{task.description}</p>
                    <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                      {t('common.labels.dueIn')} {task.dueInDays}{' '}
                      {t('common.labels.days')}
                    </p>
                  </div>
                ))}
              </div>
            </RecommendationBlock>
          ) : null}

          <RecommendationBlock
            label={t('aiSuggestions.detail.reasoningSummary')}
          >
            <p className="whitespace-pre-line">
              {externalEmailOutput.reasoningSummary ||
                t('aiSuggestions.detail.noReasoning')}
            </p>
          </RecommendationBlock>
        </div>
      ) : (
        <p className="mt-4 whitespace-pre-line rounded-2xl border border-indigo-100 bg-white p-5 text-sm leading-7 text-slate-700 shadow-sm">
          {suggestion.outputText ?? t('aiSuggestions.detail.noOutputText')}
        </p>
      )}
    </article>
  );
}
