'use client';

import { useI18n } from '@/i18n/useI18n';

type LongTextCardProps = {
  title: string;
  content: string | null | undefined;
  emptyText?: string;
};

export function LongTextCard({
  title,
  content,
  emptyText,
}: LongTextCardProps) {
  const { t } = useI18n();
  const hasContent = Boolean(content?.trim());

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {t('shared.crmContext')}
        </p>
        <h2 className="mt-1 text-lg font-semibold text-slate-950">{title}</h2>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
        {hasContent ? (
          <p className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">
            {content}
          </p>
        ) : (
          <p className="text-sm text-slate-500">
            {emptyText ?? t('shared.nothingRecorded')}
          </p>
        )}
      </div>
    </article>
  );
}
