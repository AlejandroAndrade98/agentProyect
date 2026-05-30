'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/i18n/useI18n';

import { PageHeader } from '@/components/ui/PageHeader';

export default function SettingsPage() {
  const { user } = useAuth();
  const { locale, locales, setLocale, t } = useI18n();

  const canManageUsers =
  user?.role === 'SUPER_ADMIN' ||
  user?.role === 'OWNER' ||
  user?.role === 'ADMIN';

  return (
    <div className="space-y-8">
      <PageHeader
        title={t('settings.title')}
        description={t('settings.subtitle')}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Link
          href="/dashboard/settings/organization"
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-blue-200 hover:bg-blue-50/40"
        >
          <p className="text-sm font-medium text-blue-700">
            {t('settings.cards.workspace')}
          </p>
          <h2 className="mt-2 text-lg font-semibold text-slate-950">
            {t('settings.cards.organization')}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {t('settings.cards.organizationDescription')}
          </p>
        </Link>

      {canManageUsers ? (
        <Link
          href="/dashboard/settings/users"
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-blue-200 hover:bg-blue-50/40"
        >
          <p className="text-sm font-medium text-blue-700">
            {t('settings.cards.access')}
          </p>
          <h2 className="mt-2 text-lg font-semibold text-slate-950">
            {t('settings.cards.users')}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {t('settings.cards.usersDescription')}
          </p>
        </Link>
        ) : null}

        <Link
          href="/dashboard/settings/ai-usage"
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-blue-200 hover:bg-blue-50/40"
        >
          <p className="text-sm font-medium text-blue-700">
            {t('settings.cards.aiGovernance')}
          </p>
          <h2 className="mt-2 text-lg font-semibold text-slate-950">
            {t('settings.cards.aiUsage')}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {t('settings.cards.aiUsageDescription')}
          </p>
        </Link>

        <Link
          href="/dashboard/settings/connected-accounts"
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-blue-200 hover:bg-blue-50/40"
        >
          <p className="text-sm font-medium text-blue-700">
            {t('settings.cards.integrations')}
          </p>
          <h2 className="mt-2 text-lg font-semibold text-slate-950">
            {t('settings.cards.connectedAccounts')}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {t('settings.cards.connectedAccountsDescription')}
          </p>
        </Link>

        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6">
          <p className="text-sm font-medium text-slate-500">
            {t('settings.cards.comingSoon')}
          </p>
          <h2 className="mt-2 text-lg font-semibold text-slate-800">
            {t('settings.cards.appearance')}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {t('settings.cards.appearanceDescription')}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-blue-700">
            {t('navigation.language')}
          </p>
          <h2 className="mt-2 text-lg font-semibold text-slate-800">
            {t('settings.cards.language')}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {t('settings.cards.languageDescription')}
          </p>
          <select
            value={locale}
            onChange={(event) =>
              setLocale(event.target.value as typeof locale)
            }
            className="mt-4 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          >
            {locales.map((availableLocale) => (
              <option key={availableLocale} value={availableLocale}>
                {availableLocale.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
