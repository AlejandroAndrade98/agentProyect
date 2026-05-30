'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import { useAuth } from '@/hooks/useAuth';
import {
  getAccountTypeLabel,
  getOrganizationStatusLabel,
} from '@/i18n/ai-display';
import { useI18n } from '@/i18n/useI18n';
import {
  ApiClientError,
  getCurrentOrganization,
  updateCurrentOrganization,
} from '@/lib/api-client';
import { formatDateTime } from '@/lib/formatters';
import type { CurrentOrganizationResponse } from '@/types/organization-settings';
import type { OrganizationStatus } from '@/types/platform';

function formatNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale).format(value);
}

function getStatusClasses(status: OrganizationStatus) {
  const classes: Record<OrganizationStatus, string> = {
    TRIAL: 'bg-blue-50 text-blue-700 ring-blue-200',
    ACTIVE: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    SUSPENDED: 'bg-amber-50 text-amber-700 ring-amber-200',
    CANCELLED: 'bg-rose-50 text-rose-700 ring-rose-200',
  };

  return classes[status];
}

function StatCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
    </article>
  );
}

export default function OrganizationSettingsPage() {
  const { token } = useAuth();
  const { locale, t } = useI18n();
  const dateFormatOptions = {
    locale,
    fallback: t('common.emptyStates.notSet'),
    invalidFallback: t('common.errors.invalidDate'),
  };

  const [organization, setOrganization] =
    useState<CurrentOrganizationResponse | null>(null);
  const [form, setForm] = useState({
    name: '',
    industry: '',
    billingEmail: '',
    supportEmail: '',
    timezone: '',
    locale: '',
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadOrganization = useCallback(async () => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await getCurrentOrganization(token);

      setOrganization(response);
      setForm({
        name: response.name,
        industry: response.industry ?? '',
        billingEmail: response.billingEmail ?? '',
        supportEmail: response.supportEmail ?? '',
        timezone: response.timezone,
        locale: response.locale,
      });
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage(t('settings.organization.loadFailed'));
      }
    } finally {
      setIsLoading(false);
    }
  }, [token, t]);

  useEffect(() => {
    loadOrganization();
  }, [loadOrganization]);

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await updateCurrentOrganization(token, {
        name: form.name,
        industry: form.industry || undefined,
        billingEmail: form.billingEmail || undefined,
        supportEmail: form.supportEmail || undefined,
        timezone: form.timezone,
        locale: form.locale,
      });

      setOrganization(response);
      setSuccessMessage(t('settings.organization.updated'));
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage(t('settings.organization.updateFailed'));
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={t('settings.organization.title')}
        description={t('settings.organization.subtitle')}
        actions={
          <Link
            href="/dashboard/settings"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            {t('settings.back')}
          </Link>
        }
      />

      {isLoading ? <LoadingSkeleton rows={8} /> : null}

      {!isLoading && errorMessage ? <ErrorState message={errorMessage} /> : null}

      {!isLoading && successMessage ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
          {successMessage}
        </div>
      ) : null}

      {!isLoading && !errorMessage && organization ? (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
              <div>
                <div className="flex flex-wrap gap-2">
                  <Badge className={getStatusClasses(organization.status)}>
                    {getOrganizationStatusLabel(organization.status, t)}
                  </Badge>

                  <Badge className="bg-slate-100 text-slate-700 ring-slate-200">
                    {getAccountTypeLabel(organization.accountType, t)}
                  </Badge>

                  <Badge className="bg-indigo-50 text-indigo-700 ring-indigo-200">
                    {organization.plan}
                  </Badge>
                </div>

                <h2 className="mt-4 text-2xl font-semibold text-slate-950">
                  {organization.name}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  /{organization.slug} | {t('settings.organization.created')}{' '}
                  {formatDateTime(organization.createdAt, dateFormatOptions)}
                </p>

                {organization.statusReason ? (
                  <p className="mt-3 text-sm text-slate-600">
                    {t('settings.organization.statusReason')}:{' '}
                    {organization.statusReason}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-1 text-sm text-slate-600 lg:text-right">
                <span>
                  {t('settings.organization.billing')}:{' '}
                  {organization.billingEmail ?? t('common.emptyStates.notSet')}
                </span>
                <span>
                  {t('settings.organization.support')}:{' '}
                  {organization.supportEmail ?? t('common.emptyStates.notSet')}
                </span>
                <span>
                  {t('settings.organization.timezone')}: {organization.timezone}
                </span>
                <span>
                  {t('settings.organization.locale')}: {organization.locale}
                </span>
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title={t('settings.organization.users')}
              value={formatNumber(organization._count.users, locale)}
              description={`${t('settings.organization.maxUsers')}: ${formatNumber(
                organization.maxUsers,
                locale,
              )}`}
            />

            <StatCard
              title={t('settings.organization.leads')}
              value={formatNumber(organization._count.leads, locale)}
              description={`${t('settings.organization.maxActiveLeads')}: ${formatNumber(
                organization.maxActiveLeads,
                locale,
              )}`}
            />

            <StatCard
              title={t('settings.organization.aiCreditsBalance')}
              value={formatNumber(organization.aiCreditsBalance, locale)}
              description={`${t('settings.organization.monthlyLimit')}: ${formatNumber(
                organization.aiMonthlyCreditsLimit,
                locale,
              )}`}
            />

            <StatCard
              title={t('settings.organization.aiUsageRecords')}
              value={formatNumber(organization._count.aiUsageRecords, locale)}
              description={t('settings.organization.trackedRecordsDescription')}
            />
          </section>

          <form
            onSubmit={handleSave}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <h3 className="text-lg font-semibold text-slate-950">
              {t('settings.organization.editableProfile')}
            </h3>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-slate-700">
                  {t('settings.organization.name')}
                </span>
                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  {t('settings.organization.industry')}
                </span>
                <input
                  value={form.industry}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      industry: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  {t('settings.organization.billingEmail')}
                </span>
                <input
                  value={form.billingEmail}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      billingEmail: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  {t('settings.organization.supportEmail')}
                </span>
                <input
                  value={form.supportEmail}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      supportEmail: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  {t('settings.organization.timezone')}
                </span>
                <input
                  value={form.timezone}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      timezone: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  {t('settings.organization.locale')}
                </span>
                <input
                  value={form.locale}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      locale: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="mt-5 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving
                ? t('settings.organization.saving')
                : t('settings.organization.save')}
            </button>
          </form>
        </>
      ) : null}
    </div>
  );
}
