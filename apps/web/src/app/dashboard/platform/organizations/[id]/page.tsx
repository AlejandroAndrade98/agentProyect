'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import { useAuth } from '@/hooks/useAuth';
import {
  getOrganizationRoleLabel,
  getPlatformAccountTypeLabel,
  getPlatformInvitationStatusLabel,
  getPlatformOrganizationStatusLabel,
} from '@/i18n/ai-display';
import { useI18n } from '@/i18n/useI18n';
import {
  ApiClientError,
  createPlatformOwnerInvitation,
  getPlatformOrganization,
  updatePlatformOrganization,
  updatePlatformOrganizationStatus,
  revokePlatformOwnerInvitation,
} from '@/lib/api-client';
import { formatDateTime } from '@/lib/formatters';
import type {
  OrganizationAccountType,
  OrganizationStatus,
  PlatformOrganizationDetail,
  PlatformOwnerOnboardingInvitation,
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

export default function PlatformOrganizationDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { token, user } = useAuth();
  const { locale, t } = useI18n();
  const dateFormatOptions = {
    locale,
    fallback: t('common.emptyStates.notSet'),
    invalidFallback: t('common.errors.invalidDate'),
  };

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
  
  const [ownerInvitationEmail, setOwnerInvitationEmail] = useState('');
  const [isCreatingOwnerInvitation, setIsCreatingOwnerInvitation] =
    useState(false);
  const [isRevokingOwnerInvitation, setIsRevokingOwnerInvitation] =
  useState(false);
  const [createdOwnerInvitation, setCreatedOwnerInvitation] =
    useState<PlatformOwnerOnboardingInvitation | null>(null);

  const canSeePlatform = useMemo(() => canViewPlatform(user?.role), [user?.role]);

  const activeOwner = useMemo(() => {
  return organization?.users.find(
    (orgUser) => orgUser.role === 'OWNER' && orgUser.isActive,
    );
  }, [organization?.users]);

  const pendingOwnerInvitation = useMemo(() => {
    return organization?.invitations.find(
      (invitation) =>
        invitation.role === 'OWNER' && invitation.status === 'PENDING',
    );
  }, [organization?.invitations]);

  const canCreateOwnerInvitation =
    organization?.status === 'TRIAL' ||
    organization?.status === 'ACTIVE';

  const createdOwnerInvitationUrl = createdOwnerInvitation?.acceptanceToken
    ? `/accept-invitation/${createdOwnerInvitation.acceptanceToken}`
    : null;

  const loadOrganization = useCallback(async () => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    if (!canSeePlatform) {
      setIsLoading(false);
      setErrorMessage(t('platform.permissionDenied'));
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
        setErrorMessage(t('platform.organizationDetail.loadFailed'));
      }
    } finally {
      setIsLoading(false);
    }
  }, [canSeePlatform, params.id, token, t]);

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
      setSuccessMessage(t('platform.organizationDetail.updated'));
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage(t('platform.organizationDetail.updateFailed'));
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
      setSuccessMessage(t('platform.organizationDetail.statusUpdated'));
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage(t('platform.organizationDetail.statusUpdateFailed'));
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreateOwnerInvitation(
  event: React.FormEvent<HTMLFormElement>,
) {
  event.preventDefault();

  if (!token) {
    return;
  }

  setIsCreatingOwnerInvitation(true);
  setErrorMessage(null);
  setSuccessMessage(null);
  setCreatedOwnerInvitation(null);

  try {
    const response = await createPlatformOwnerInvitation(token, params.id, {
      ownerEmail: ownerInvitationEmail.trim().toLowerCase(),
    });

    setCreatedOwnerInvitation(response.ownerInvitation);
    setOwnerInvitationEmail('');
    setSuccessMessage(t('platform.organizationDetail.ownerInvitationCreated'));

    await loadOrganization();
  } catch (error) {
    if (error instanceof ApiClientError) {
      setErrorMessage(error.message);
    } else if (error instanceof Error) {
      setErrorMessage(error.message);
    } else {
      setErrorMessage(t('platform.organizationDetail.ownerInvitationCreateFailed'));
    }
  } finally {
    setIsCreatingOwnerInvitation(false);
  }
}

async function handleRevokeOwnerInvitation(invitationId: string) {
  if (!token) {
    return;
  }

  setIsRevokingOwnerInvitation(true);
  setErrorMessage(null);
  setSuccessMessage(null);
  setCreatedOwnerInvitation(null);

  try {
    const updatedOrganization = await revokePlatformOwnerInvitation(
      token,
      params.id,
      invitationId,
    );

    setOrganization(updatedOrganization);
    setSuccessMessage(t('platform.organizationDetail.ownerInvitationRevoked'));
  } catch (error) {
    if (error instanceof ApiClientError) {
      setErrorMessage(error.message);
    } else if (error instanceof Error) {
      setErrorMessage(error.message);
    } else {
      setErrorMessage(t('platform.organizationDetail.ownerInvitationRevokeFailed'));
    }
  } finally {
    setIsRevokingOwnerInvitation(false);
  }
}

  return (
    <div className="space-y-8">
      <PageHeader
        title={organization?.name ?? t('platform.organizationDetail.fallbackTitle')}
        description={t('platform.organizationDetail.subtitle')}
        actions={
          <Link
            href="/dashboard/platform/organizations"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            {t('platform.organizationDetail.back')}
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
                    {getPlatformOrganizationStatusLabel(
                      organization.status,
                      t,
                    )}
                  </Badge>

                  <Badge className="bg-slate-100 text-slate-700 ring-slate-200">
                    {getPlatformAccountTypeLabel(organization.accountType, t)}
                  </Badge>

                  <Badge className="bg-indigo-50 text-indigo-700 ring-indigo-200">
                    {organization.plan}
                  </Badge>
                </div>

                <h2 className="mt-4 text-2xl font-semibold text-slate-950">
                  {organization.name}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  /{organization.slug} |{' '}
                  {t('platform.organizationDetail.created')}{' '}
                  {formatDateTime(organization.createdAt, dateFormatOptions)}
                </p>

                {organization.statusReason ? (
                  <p className="mt-3 text-sm text-slate-600">
                    {t('platform.organizationDetail.statusReason')}:{' '}
                    {organization.statusReason}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-1 text-sm text-slate-600 lg:text-right">
                <span>
                  {t('platform.organizationDetail.billing')}:{' '}
                  {organization.billingEmail ?? t('common.emptyStates.notSet')}
                </span>
                <span>
                  {t('platform.organizationDetail.support')}:{' '}
                  {organization.supportEmail ?? t('common.emptyStates.notSet')}
                </span>
                <span>
                  {t('platform.organizationDetail.timezone')}:{' '}
                  {organization.timezone}
                </span>
                <span>
                  {t('platform.organizationDetail.locale')}: {organization.locale}
                </span>
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title={t('platform.organizationDetail.users')}
              value={formatNumber(organization._count.users, locale)}
              description={`${t(
                'platform.organizationDetail.maxUsers',
              )}: ${formatNumber(organization.maxUsers, locale)}`}
            />

            <StatCard
              title={t('platform.organizationDetail.leads')}
              value={formatNumber(organization._count.leads, locale)}
              description={`${t(
                'platform.organizationDetail.maxActiveLeads',
              )}: ${formatNumber(
                organization.maxActiveLeads,
                locale,
              )}`}
            />

            <StatCard
              title={t('platform.organizationDetail.aiCreditsBalance')}
              value={formatNumber(organization.aiCreditsBalance, locale)}
              description={`${t(
                'platform.organizationDetail.monthlyLimit',
              )}: ${formatNumber(
                organization.aiMonthlyCreditsLimit,
                locale,
              )}`}
            />

            <StatCard
              title={t('platform.organizationDetail.aiUsageRecords')}
              value={formatNumber(organization._count.aiUsageRecords, locale)}
              description={`${formatNumber(
                organization._count.aiCreditTransactions ?? 0,
                locale,
              )} ${t('platform.organizationDetail.creditTransactions')}`}
            />
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <form
              onSubmit={handleSaveOrganization}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <h3 className="text-lg font-semibold text-slate-950">
                {t('platform.organizationDetail.accountSettings')}
              </h3>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="space-y-2 md:col-span-2">
                  <span className="text-sm font-medium text-slate-700">
                    {t('platform.organizationDetail.name')}
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
                    {t('platform.organizationDetail.industry')}
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
                    {t('platform.organizationDetail.plan')}
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
                    {t('platform.organizations.accountType')}
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
                        {getPlatformAccountTypeLabel(option, t)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">
                    {t('platform.newOrganization.billingEmail')}
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
                    {t('platform.newOrganization.supportEmail')}
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
                    {t('platform.newOrganization.timezone')}
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
                    {t('platform.newOrganization.locale')}
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
                    {t('platform.organizationDetail.maxUsers')}
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
                    {t('platform.organizationDetail.maxActiveLeads')}
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
                    {t('platform.newOrganization.aiMonthlyCreditsLimit')}
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
                    {t('platform.newOrganization.defaultUserAiCreditsLimit')}
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
                    {t('platform.organizationDetail.aiCreditsBalance')}
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
                {isSaving
                  ? t('common.actions.saving')
                  : t('platform.organizationDetail.saveAccountSettings')}
              </button>
            </form>

            <form
              onSubmit={handleSaveStatus}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <h3 className="text-lg font-semibold text-slate-950">
                {t('platform.organizationDetail.statusManagement')}
              </h3>

              <div className="mt-5 space-y-4">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">
                    {t('platform.organizations.status')}
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
                        {getPlatformOrganizationStatusLabel(option, t)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">
                    {t('platform.organizationDetail.statusReason')}
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
                  <p>
                    {t('platform.organizationDetail.trialEndsAt')}:{' '}
                    {formatDateTime(
                      organization.trialEndsAt,
                      dateFormatOptions,
                    )}
                  </p>
                  <p>
                    {t('platform.organizationDetail.activatedAt')}:{' '}
                    {formatDateTime(
                      organization.activatedAt,
                      dateFormatOptions,
                    )}
                  </p>
                  <p>
                    {t('platform.organizationDetail.suspendedAt')}:{' '}
                    {formatDateTime(
                      organization.suspendedAt,
                      dateFormatOptions,
                    )}
                  </p>
                  <p>
                    {t('platform.organizationDetail.cancelledAt')}:{' '}
                    {formatDateTime(
                      organization.cancelledAt,
                      dateFormatOptions,
                    )}
                  </p>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="mt-5 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving
                  ? t('common.actions.saving')
                  : t('platform.organizationDetail.saveStatus')}
              </button>
            </form>
          </section>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
    <div>
      <h3 className="text-lg font-semibold text-slate-950">
        {t('platform.organizationDetail.ownerOnboarding')}
      </h3>
      <p className="mt-1 text-sm text-slate-500">
        {t('platform.organizationDetail.ownerOnboardingDescription')}
      </p>
    </div>

    {activeOwner ? (
      <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200">
        {t('platform.organizationDetail.activeOwnerFound')}
      </Badge>
    ) : pendingOwnerInvitation ? (
      <Badge className="bg-blue-50 text-blue-700 ring-blue-200">
        {t('platform.organizationDetail.ownerInvitationPending')}
      </Badge>
    ) : (
      <Badge className="bg-amber-50 text-amber-700 ring-amber-200">
        {t('platform.organizationDetail.ownerSetupNeeded')}
      </Badge>
    )}
  </div>

  <div className="mt-5 grid gap-4 lg:grid-cols-2">
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-medium text-slate-700">
        {t('platform.organizationDetail.currentOwnerStatus')}
      </p>

      {activeOwner ? (
        <div className="mt-3 text-sm text-slate-600">
          <p className="font-medium text-slate-950">{activeOwner.name}</p>
          <p>{activeOwner.email}</p>
          <p className="mt-2">
            {t('platform.organizationDetail.activeOwnerExists')}
          </p>
        </div>
      ) : pendingOwnerInvitation ? (
        <div className="mt-3 text-sm text-slate-600">
          <p className="font-medium text-slate-950">
            {pendingOwnerInvitation.email}
          </p>

          <p>
            {t('platform.organizationDetail.pendingInvitationExpires').replace(
              '{date}',
              formatDateTime(
                pendingOwnerInvitation.expiresAt,
                dateFormatOptions,
              ),
            )}
          </p>

          <p className="mt-2">
            {t('platform.organizationDetail.pendingInvitationBlocks')}
          </p>

          <button
            type="button"
            disabled={isRevokingOwnerInvitation}
            onClick={() => handleRevokeOwnerInvitation(pendingOwnerInvitation.id)}
            className="mt-4 rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isRevokingOwnerInvitation
              ? t('platform.organizationDetail.revoking')
              : t('platform.organizationDetail.revokeOwnerInvitation')}
          </button>
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-600">
          {t('platform.organizationDetail.noOwnerFound')}
        </p>
      )}
    </div>

    <form
      onSubmit={handleCreateOwnerInvitation}
      className="rounded-xl border border-slate-200 bg-slate-50 p-4"
    >
      <label className="space-y-2">
        <span className="text-sm font-medium text-slate-700">
          {t('platform.organizationDetail.newOwnerEmail')}
        </span>
        <input
          value={ownerInvitationEmail}
          onChange={(event) => setOwnerInvitationEmail(event.target.value)}
          disabled={
            Boolean(activeOwner) ||
            Boolean(pendingOwnerInvitation) ||
            !canCreateOwnerInvitation ||
            isCreatingOwnerInvitation
          }
          required
          type="email"
          placeholder="owner@customer.com"
          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
        />
      </label>

      <button
        type="submit"
        disabled={
          Boolean(activeOwner) ||
          Boolean(pendingOwnerInvitation) ||
          !canCreateOwnerInvitation ||
          isCreatingOwnerInvitation
        }
        className="mt-4 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isCreatingOwnerInvitation
          ? t('common.actions.creating')
          : t('platform.organizationDetail.generateOwnerInvitation')}
      </button>

      {!canCreateOwnerInvitation ? (
        <p className="mt-3 text-sm text-amber-700">
          {t('platform.organizationDetail.ownerInvitationRestricted')}
        </p>
      ) : null}

      {createdOwnerInvitationUrl ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-sm font-medium text-emerald-800">
            {t('platform.newOrganization.developmentInvitationLink')}
          </p>
          <p className="mt-2 break-all rounded-lg bg-white p-2 text-sm text-slate-700">
            {createdOwnerInvitationUrl}
          </p>
          <Link
            href={createdOwnerInvitationUrl}
            className="mt-3 inline-flex rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            {t('platform.newOrganization.openInvitation')}
          </Link>
        </div>
      ) : null}
    </form>
  </div>
</article>

          <section className="grid gap-6 xl:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-950">
                {t('platform.organizationDetail.users')}
              </h3>

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
                          {getOrganizationRoleLabel(orgUser.role, t)}
                        </Badge>
                      </div>

                      <p className="mt-2 text-sm text-slate-500">
                        {t('platform.organizationDetail.active')}:{' '}
                        {orgUser.isActive
                          ? t('common.labels.yes')
                          : t('common.labels.no')}{' '}
                        | {t('platform.organizationDetail.created')}{' '}
                        {formatDateTime(orgUser.createdAt, dateFormatOptions)}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">
                    {t('platform.organizationDetail.noUsers')}
                  </p>
                )}
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-950">
                {t('platform.organizationDetail.invitations')}
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
                            {t('platform.organizationDetail.role')}:{' '}
                            {getOrganizationRoleLabel(invitation.role, t)}
                          </p>
                        </div>

                        <Badge className="bg-slate-100 text-slate-700 ring-slate-200">
                          {getPlatformInvitationStatusLabel(
                            invitation.status,
                            t,
                          )}
                        </Badge>
                      </div>

                      <p className="mt-2 text-sm text-slate-500">
                        {t('platform.organizationDetail.expires')}{' '}
                        {formatDateTime(invitation.expiresAt, dateFormatOptions)}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">
                    {t('platform.organizationDetail.noInvitations')}
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
