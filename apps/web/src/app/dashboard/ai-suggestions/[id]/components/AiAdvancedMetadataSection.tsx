'use client';

import { useI18n } from '@/i18n/useI18n';
import { formatDateTime } from '@/lib/formatters';
import type { AiSuggestion } from '@/types/ai-suggestions';

export function AiAdvancedMetadataSection({
  suggestion,
  outputLanguageLabel,
}: {
  suggestion: AiSuggestion;
  outputLanguageLabel: string;
}) {
  const { t } = useI18n();

  return (
    <aside className="space-y-4">
      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-950">
          {t('aiSuggestions.detail.advancedMetadata')}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          {t('aiSuggestions.detail.advancedMetadataDescription')}
        </p>

        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="text-slate-500">
              {t('aiSuggestions.detail.created')}
            </dt>
            <dd className="font-medium text-slate-800">
              {formatDateTime(suggestion.createdAt)}
            </dd>
          </div>

          <div>
            <dt className="text-slate-500">
              {t('aiSuggestions.detail.expires')}
            </dt>
            <dd className="font-medium text-slate-800">
              {formatDateTime(suggestion.expiresAt)}
            </dd>
          </div>

          <div>
            <dt className="text-slate-500">
              {t('aiSuggestions.detail.reviewedAt')}
            </dt>
            <dd className="font-medium text-slate-800">
              {formatDateTime(suggestion.reviewedAt)}
            </dd>
          </div>

          <div>
            <dt className="text-slate-500">
              {t('aiSuggestions.detail.reviewedBy')}
            </dt>
            <dd className="font-medium text-slate-800">
              {suggestion.reviewedBy?.name ??
                t('aiSuggestions.detail.notReviewed')}
            </dd>
          </div>

          <div>
            <dt className="text-slate-500">
              {t('aiSuggestions.labels.provider')}
            </dt>
            <dd className="font-medium text-slate-800">
              {suggestion.provider}
            </dd>
          </div>

          <div>
            <dt className="text-slate-500">
              {t('aiSuggestions.labels.model')}
            </dt>
            <dd className="font-medium text-slate-800">
              {suggestion.metadataJson?.model ?? t('common.emptyStates.notSet')}
            </dd>
          </div>

          <div>
            <dt className="text-slate-500">
              {t('aiSuggestions.detail.outputLanguage')}
            </dt>
            <dd className="font-medium text-slate-800">
              {outputLanguageLabel}
            </dd>
          </div>

          <div>
            <dt className="text-slate-500">
              {t('aiSuggestions.detail.tokens')}
            </dt>
            <dd className="font-medium text-slate-800">
              {t('common.labels.input')} {suggestion.tokensInput ?? 0} -{' '}
              {t('common.labels.output')} {suggestion.tokensOutput ?? 0}
            </dd>
          </div>

          <div>
            <dt className="text-slate-500">
              {t('aiSuggestions.detail.cost')}
            </dt>
            <dd className="font-medium text-slate-800">
              ${suggestion.estimatedCostUsd ?? 0}
            </dd>
          </div>
        </dl>
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-950">
          {t('aiSuggestions.detail.safetyFlags')}
        </h2>

        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="text-slate-500">
              {t('aiSuggestions.detail.humanApprovalRequired')}
            </dt>
            <dd className="font-medium text-slate-800">
              {String(suggestion.metadataJson?.humanApprovalRequired ?? true)}
            </dd>
          </div>

          <div>
            <dt className="text-slate-500">
              {t('aiSuggestions.detail.canApplyAutomatically')}
            </dt>
            <dd className="font-medium text-slate-800">
              {String(suggestion.metadataJson?.canApplyAutomatically ?? false)}
            </dd>
          </div>

          <div>
            <dt className="text-slate-500">
              {t('aiSuggestions.detail.canSendEmailAutomatically')}
            </dt>
            <dd className="font-medium text-slate-800">
              {String(
                suggestion.metadataJson?.canSendEmailAutomatically ?? false,
              )}
            </dd>
          </div>
        </dl>
      </article>
    </aside>
  );
}
