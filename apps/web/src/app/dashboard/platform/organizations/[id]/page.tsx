'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import { useAuth } from '@/hooks/useAuth';
import {
  ApiClientError,
  getPlatformOrganization,
  updatePlatformOrganization,
  updatePlatformOrganizationStatus,
} from '@/lib/api-client';
import { formatDateTime, formatEnumLabel } from '@/lib/formatters';
import type {
  OrganizationAccountType,
  OrganizationStatus,
  PlatformOrganizationDetail,
} from '@/types/platform';

const statusOptions: OrganizationStatus[] = [
  'TRIAL',
  'ACTIVE',
  'SUSPENDED',
  'CANCELLED',
];

const accountTypeOptions: OrganizationAccountType[] = ['INDIVIDUAL', 'COMPANY'];

function canViewPlatform(role?: string) {
  return role === 'SUPER_ADMIN';
}

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

export default function PlatformOrganizationDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { token, user } = useAuth();

  const [organization, setOrganization] =
    useState<PlatformOrganizationDetail | null>(null);
  const [form, setForm] = useState({
    name: '',
    industry: '',
    plan: '',
    accountType: 'INDIVIDUAL' as OrganizationAccountType,
    billingEmail: '',
    supportEmail: '',
    timezone: '',
    locale: '',
    maxUsers: 1,
    maxActiveLeads: 100,
    aiMonthlyCreditsLimit: 0,
    aiDefaultUserMonthlyCreditsLimit: 0,
    aiCreditsBalance: 0,
  });
  const [statusForm, setStatusForm] = useState({
    status: 'TRIAL' as OrganizationStatus,
    statusReason: '',
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const canSeePlatform = useMemo(() => canViewPlatform(user?.role), [user?.role]);

  const loadOrganization = useCallback(async () => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    if (!canSeePlatform) {
      setIsLoading(false);
      setErrorMessage('You do not have permission to view Platform Admin.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await getPlatformOrganization(token, params.id);

      setOrganization(response);
      setForm({
        name: response.name,
        industry: response.industry ?? '',
        plan: response.plan,
        accountType: response.accountType,
        billingEmail: response.billingEmail ?? '',
        supportEmail: response.supportEmail ?? '',
        timezone: response.timezone,
        locale: response.locale,
        maxUsers: response.maxUsers,
        maxActiveLeads: response.maxActiveLeads,
        aiMonthlyCreditsLimit: response.aiMonthlyCreditsLimit,
        aiDefaultUserMonthlyCreditsLimit:
          response.aiDefaultUserMonthlyCreditsLimit,
        aiCreditsBalance: response.aiCreditsBalance,
      });
      setStatusForm({
        status: response.status,
        statusReason: response.statusReason ?? '',
      });
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Could not load platform organization.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [canSeePlatform, params.id, token]);

  useEffect(() => {
    loadOrganization();
  }, [loadOrganization]);

  async function handleSaveOrganization(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await updatePlatformOrganization(token, params.id, {
        ...form,
        industry: form.industry || undefined,
        billingEmail: form.billingEmail || undefined,
        supportEmail: form.supportEmail || undefined,
      });

      setOrganization(response);
      setSuccessMessage('Organization updated.');
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Could not update organization.');
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveStatus(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await updatePlatformOrganizationStatus(token, params.id, {
        status: statusForm.status,
        statusReason: statusForm.statusReason || undefined,
      });

      setOrganization(response);
      setSuccessMessage('Organization status updated.');
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Could not update organization status.');
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={organization?.name ?? 'Platform organization'}
        description="Global organization detail, account status, limits, credits, users, and invitations."
        actions={
          <Link
            href="/dashboard/platform/organizations"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Back to organizations
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
              description={`${formatNumber(
                organization._count.aiCreditTransactions ?? 0,
              )} credit transaction(s)`}
            />
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <form
              onSubmit={handleSaveOrganization}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <h3 className="text-lg font-semibold text-slate-950">
                Account settings
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
                    Plan
                  </span>
                  <input
                    value={form.plan}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        plan: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">
                    Account type
                  </span>
                  <select
                    value={form.accountType}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        accountType: event.target.value as OrganizationAccountType,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  >
                    {accountTypeOptions.map((option) => (
                      <option key={option} value={option}>
                        {formatEnumLabel(option)}
                      </option>
                    ))}
                  </select>
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

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">
                    Max users
                  </span>
                  <input
                    type="number"
                    value={form.maxUsers}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        maxUsers: Number(event.target.value),
                      }))
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">
                    Max active leads
                  </span>
                  <input
                    type="number"
                    value={form.maxActiveLeads}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        maxActiveLeads: Number(event.target.value),
                      }))
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">
                    AI monthly credits limit
                  </span>
                  <input
                    type="number"
                    value={form.aiMonthlyCreditsLimit}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        aiMonthlyCreditsLimit: Number(event.target.value),
                      }))
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">
                    Default user AI credits limit
                  </span>
                  <input
                    type="number"
                    value={form.aiDefaultUserMonthlyCreditsLimit}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        aiDefaultUserMonthlyCreditsLimit: Number(
                          event.target.value,
                        ),
                      }))
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </label>

                <label className="space-y-2 md:col-span-2">
                  <span className="text-sm font-medium text-slate-700">
                    AI credits balance
                  </span>
                  <input
                    type="number"
                    value={form.aiCreditsBalance}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        aiCreditsBalance: Number(event.target.value),
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
                {isSaving ? 'Saving...' : 'Save account settings'}
              </button>
            </form>

            <form
              onSubmit={handleSaveStatus}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <h3 className="text-lg font-semibold text-slate-950">
                Status management
              </h3>

              <div className="mt-5 space-y-4">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">
                    Status
                  </span>
                  <select
                    value={statusForm.status}
                    onChange={(event) =>
                      setStatusForm((current) => ({
                        ...current,
                        status: event.target.value as OrganizationStatus,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  >
                    {statusOptions.map((option) => (
                      <option key={option} value={option}>
                        {formatEnumLabel(option)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">
                    Status reason
                  </span>
                  <textarea
                    value={statusForm.statusReason}
                    onChange={(event) =>
                      setStatusForm((current) => ({
                        ...current,
                        statusReason: event.target.value,
                      }))
                    }
                    rows={4}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </label>

                <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                  <p>Activated at: {organization.activatedAt ?? 'Not set'}</p>
                  <p>Suspended at: {organization.suspendedAt ?? 'Not set'}</p>
                  <p>Cancelled at: {organization.cancelledAt ?? 'Not set'}</p>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="mt-5 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save status'}
              </button>
            </form>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-950">Users</h3>

              <div className="mt-4 space-y-3">
                {organization.users.length > 0 ? (
                  organization.users.map((orgUser) => (
                    <div
                      key={orgUser.id}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="flex justify-between gap-4">
                        <div>
                          <p className="font-medium text-slate-950">
                            {orgUser.name}
                          </p>
                          <p className="text-sm text-slate-500">
                            {orgUser.email}
                          </p>
                        </div>

                        <Badge className="bg-slate-100 text-slate-700 ring-slate-200">
                          {formatEnumLabel(orgUser.role)}
                        </Badge>
                      </div>

                      <p className="mt-2 text-sm text-slate-500">
                        Active: {orgUser.isActive ? 'Yes' : 'No'} · Created{' '}
                        {formatDateTime(orgUser.createdAt)}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">No users found.</p>
                )}
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-950">
                Invitations
              </h3>

              <div className="mt-4 space-y-3">
                {organization.invitations.length > 0 ? (
                  organization.invitations.map((invitation) => (
                    <div
                      key={invitation.id}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="flex justify-between gap-4">
                        <div>
                          <p className="font-medium text-slate-950">
                            {invitation.email}
                          </p>
                          <p className="text-sm text-slate-500">
                            Role: {formatEnumLabel(invitation.role)}
                          </p>
                        </div>

                        <Badge className="bg-slate-100 text-slate-700 ring-slate-200">
                          {formatEnumLabel(invitation.status)}
                        </Badge>
                      </div>

                      <p className="mt-2 text-sm text-slate-500">
                        Expires {formatDateTime(invitation.expiresAt)}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">
                    No invitations found.
                  </p>
                )}
              </div>
            </article>
          </section>
        </>
      ) : null}
    </div>
  );
}