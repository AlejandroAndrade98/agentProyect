'use client';

import Link from 'next/link';

import { useI18n } from '@/i18n/useI18n';

type PublicLegalLinksProps = {
  className?: string;
};

export function PublicLegalLinks({ className = '' }: PublicLegalLinksProps) {
  const { t } = useI18n();

  return (
    <div
      className={`flex flex-wrap items-center justify-center gap-3 text-xs font-medium text-slate-500 ${className}`}
    >
      <Link
        href="/privacy"
        className="underline-offset-4 transition hover:text-slate-900 hover:underline"
      >
        {t('auth.legal.privacyPolicy')}
      </Link>
      <span aria-hidden="true">/</span>
      <Link
        href="/terms"
        className="underline-offset-4 transition hover:text-slate-900 hover:underline"
      >
        {t('auth.legal.termsOfService')}
      </Link>
    </div>
  );
}
