'use client';

import { useState } from 'react';

import { useI18n } from '@/i18n/useI18n';

type AiGuardrailsNoticeProps = {
  items: string[];
  summary?: string;
  title?: string;
  description?: string;
};

export function AiGuardrailsNotice({
  items,
  summary,
  title,
  description,
}: AiGuardrailsNoticeProps) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-blue-950">
            {title ?? t('common.guardrails.title')}
          </p>
        </div>

        <button
          type="button"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((current) => !current)}
          className="w-fit rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-800 transition hover:bg-blue-50"
        >
          {isOpen
            ? t('common.guardrails.hideRules')
            : t('common.guardrails.viewRules')}
        </button>
      </div>

      {isOpen ? (
        <div className="mt-4 border-t border-blue-100 pt-4">
          <div className="mb-3 rounded-xl border border-blue-100 bg-white px-3 py-2">
            <p className="text-sm font-semibold text-blue-950">
              {summary ?? t('common.guardrails.summary')}
            </p>
            {description ? (
              <p className="mt-1 text-sm leading-6 text-blue-800">
                {description}
              </p>
            ) : null}
          </div>

          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <div
                key={item}
                className="rounded-xl border border-blue-100 bg-white px-3 py-2 text-sm font-medium text-blue-900"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
