'use client';

import { useI18n } from '@/i18n/useI18n';

export function AiSafetyPanel({
  isMetadataOnly,
}: {
  isMetadataOnly: boolean;
}) {
  const { t } = useI18n();
  const items = [
    t('common.safety.humanReviewRequired'),
    t('common.safety.noAutomaticEmailSending'),
    t('common.safety.noAutomaticCrmRecords'),
    t('common.safety.explicitDraftAction'),
    isMetadataOnly ? t('common.safety.metadataOnly') : null,
  ].filter((item): item is string => Boolean(item));

  return (
    <details className="group rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
      <summary className="flex cursor-pointer list-none flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span>
          <span className="text-xs font-semibold uppercase tracking-wide text-blue-700">
            {t('aiSuggestions.detail.safety')}
          </span>
          <span className="mt-1 block text-base font-semibold text-blue-950">
            {t('aiSuggestions.detail.humanControlled')}
          </span>
          <span className="mt-1 block text-sm leading-6 text-blue-900">
            {t('aiSuggestions.detail.noAutomaticChangesApplied')}
          </span>
        </span>
        <span className="inline-flex w-fit rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-800 ring-1 ring-blue-100 transition group-open:bg-blue-100">
          {t('aiSuggestions.detail.viewSafetyDetails')}
        </span>
      </summary>

      <p className="mt-4 max-w-3xl border-t border-blue-100 pt-4 text-sm leading-6 text-blue-900">
        {t('aiSuggestions.detail.safetyDescription')}
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <div
            key={item}
            className="rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm font-medium text-blue-900"
          >
            {item}
          </div>
        ))}
      </div>
    </details>
  );
}
