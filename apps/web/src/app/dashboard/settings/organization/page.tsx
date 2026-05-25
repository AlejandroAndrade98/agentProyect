'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import { useAuth } from '@/hooks/useAuth';
import {
  ApiClientError,
  getCurrentOrganization,
  updateCurrentOrganization,
} from '@/lib/api-client';
import { formatDateTime, formatEnumLabel } from '@/lib/formatters';
import type { CurrentOrganizationResponse } from '@/types/organization-settings';
import type { OrganizationStatus } from '@/types/platform';

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
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
        setErrorMessage('Could not load organization settings.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [token]);

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
      setSuccessMessage('Organization settings updated.');
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Could not update organization settings.');
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Organization Settings"
        description="Manage your organization profile and workspace preferences."
        actions={
          <Link
            href="/dashboard/settings"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Back to settings
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
                    {formatEnumLabel(organization.status)}
                  </Badge>

                  <Badge className="bg-slate-100 text-slate-700 ring-slate-200">
                    {formatEnumLabel(organization.accountType)}
                  </Badge>

                  <Badge className="bg-indigo-50 text-indigo-700 ring-indigo-200">
                    {organization.plan}
                  </Badge>
                </div>

                <h2 className="mt-4 text-2xl font-semibold text-slate-950">
                  {organization.name}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  /{organization.slug} · Created{' '}
                  {formatDateTime(organization.createdAt)}
                </p>

                {organization.statusReason ? (
                  <p className="mt-3 text-sm text-slate-600">
                    Status reason: {organization.statusReason}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-1 text-sm text-slate-600 lg:text-right">
                <span>Billing: {organization.billingEmail ?? 'Not set'}</span>
                <span>Support: {organization.supportEmail ?? 'Not set'}</span>
                <span>Timezone: {organization.timezone}</span>
                <span>Locale: {organization.locale}</span>
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Users"
              value={formatNumber(organization._count.users)}
              description={`Max users: ${formatNumber(organization.maxUsers)}`}
            />

            <StatCard
              title="Leads"
              value={formatNumber(organization._count.leads)}
              description={`Max active leads: ${formatNumber(
                organization.maxActiveLeads,
              )}`}
            />

            <StatCard
              title="AI credits balance"
              value={formatNumber(organization.aiCreditsBalance)}
              description={`Monthly limit: ${formatNumber(
                organization.aiMonthlyCreditsLimit,
              )}`}
            />

            <StatCard
              title="AI usage records"
              value={formatNumber(organization._count.aiUsageRecords)}
              description="Tracked AI usage records in this organization."
            />
          </section>

          <form
            onSubmit={handleSave}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <h3 className="text-lg font-semibold text-slate-950">
              Editable organization profile
            </h3>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-slate-700">
                  Name
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
                  Industry
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
                  Billing email
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
                  Support email
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
                  Timezone
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
                  Locale
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
              {isSaving ? 'Saving...' : 'Save organization settings'}
            </button>
          </form>
        </>
      ) : null}
    </div>
  );
}