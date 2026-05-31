'use client';

import type { ReactNode } from 'react';

import { useI18n } from '@/i18n/useI18n';

export function SectionIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-5">
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
        {title}
      </h2>
      {description ? (
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          {description}
        </p>
      ) : null}
    </div>
  );
}

export function InfoTile({
  label,
  value,
  children,
}: {
  label: string;
  value?: string | null;
  children?: ReactNode;
}) {
  const { t } = useI18n();

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      {children ?? (
        <p className="mt-2 break-words text-sm font-medium text-slate-900">
          {value || t('aiSuggestions.labels.notSet')}
        </p>
      )}
    </div>
  );
}

export function DecisionMetricCard({
  label,
  value,
  helper,
  tone = 'slate',
}: {
  label: string;
  value: string;
  helper?: string;
  tone?: 'slate' | 'blue' | 'emerald' | 'amber' | 'rose';
}) {
  const toneClasses = {
    slate: 'border-slate-200 bg-white text-slate-950',
    blue: 'border-blue-200 bg-blue-50 text-blue-950',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-950',
    amber: 'border-amber-200 bg-amber-50 text-amber-950',
    rose: 'border-rose-200 bg-rose-50 text-rose-950',
  };

  return (
    <article className={`rounded-2xl border p-4 shadow-sm ${toneClasses[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
        {label}
      </p>
      <p className="mt-2 break-words text-base font-semibold">{value}</p>
      {helper ? (
        <p className="mt-2 text-xs leading-5 opacity-70">{helper}</p>
      ) : null}
    </article>
  );
}
