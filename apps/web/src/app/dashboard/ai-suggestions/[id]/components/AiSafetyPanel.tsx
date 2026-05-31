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
    <article className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
            {t('aiSuggestions.detail.safety')}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-blue-950">
            {t('aiSuggestions.detail.humanControlled')}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-900">
            {t('aiSuggestions.detail.safetyDescription')}
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[420px]">
          {items.map((item) => (
            <div
              key={item}
              className="rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm font-medium text-blue-900"
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}
