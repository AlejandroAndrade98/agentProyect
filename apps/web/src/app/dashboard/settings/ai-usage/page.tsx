'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import { useAuth } from '@/hooks/useAuth';
import { getAiUsageStatusLabel } from '@/i18n/ai-display';
import { useI18n } from '@/i18n/useI18n';
import {
  ApiClientError,
  getAiUsageRecords,
  getMyAiUsage,
  getOrganizationAiUsage,
} from '@/lib/api-client';
import { formatDateTime, formatEnumLabel } from '@/lib/formatters';
import type {
  AiUsageRecord,
  AiUsageStatus,
  MyAiUsageResponse,
  OrganizationAiUsageResponse,
} from '@/types/ai-usage';

const statusOptions: Array<AiUsageStatus | ''> = [
  '',
  'SUCCESS',
  'FAILED',
  'BLOCKED',
];

function canViewOrganizationUsage(role?: string) {
  return role === 'SUPER_ADMIN' || role === 'OWNER' || role === 'ADMIN';
}

function formatNumber(value: number, locale = 'en-US') {
  return new Intl.NumberFormat(locale).format(value);
}

function formatUsd(value: number, locale = 'en-US') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 4,
  }).format(value);
}

function getPercent(used: number, limit: number) {
  if (limit <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((used / limit) * 100));
}

function getStatusClasses(status: AiUsageStatus) {
  const classes: Record<AiUsageStatus, string> = {
    SUCCESS: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    FAILED: 'bg-rose-50 text-rose-700 ring-rose-200',
    BLOCKED: 'bg-amber-50 text-amber-700 ring-amber-200',
  };

  return classes[status];
}

function UsageCard({
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

function ProgressCard({
  title,
  used,
  limit,
  remainingLabel,
  limitLabel,
  locale,
}: {
  title: string;
  used: number;
  limit: number;
  remainingLabel: string;
  limitLabel: string;
  locale: string;
}) {
  const percent = getPercent(used, limit);

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">
            {formatNumber(used, locale)}
          </p>
        </div>

        <Badge className="bg-slate-100 text-slate-700 ring-slate-200">
          {percent}%
        </Badge>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-slate-950"
          style={{ width: `${percent}%` }}
        />
      </div>

      <p className="mt-3 text-sm text-slate-500">
        {limitLabel}: {formatNumber(limit, locale)} | {remainingLabel}
      </p>
    </article>
  );
}

export default function AiUsagePage() {
  const { token, user } = useAuth();
  const { locale, t } = useI18n();

  const [myUsage, setMyUsage] = useState<MyAiUsageResponse | null>(null);
  const [organizationUsage, setOrganizationUsage] =
    useState<OrganizationAiUsageResponse | null>(null);
  const [records, setRecords] = useState<AiUsageRecord[]>([]);
  const [status, setStatus] = useState<AiUsageStatus | ''>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const canSeeOrganization = useMemo(
    () => canViewOrganizationUsage(user?.role),
    [user?.role],
  );

  const loadUsage = useCallback(async () => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [myUsageResponse, recordsResponse, organizationUsageResponse] =
        await Promise.all([
          getMyAiUsage(token),
          getAiUsageRecords(token, {
            page,
            pageSize: 10,
            status: status || undefined,
            sortBy: 'createdAt',
            sortOrder: 'desc',
          }),
          canSeeOrganization
            ? getOrganizationAiUsage(token)
            : Promise.resolve(null),
        ]);

      setMyUsage(myUsageResponse);
      setRecords(recordsResponse.data);
      setTotalPages(recordsResponse.meta.totalPages || 1);
      setOrganizationUsage(organizationUsageResponse);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage(t('settings.aiUsage.loadFailed'));
      }
    } finally {
      setIsLoading(false);
    }
  }, [canSeeOrganization, page, status, token, t]);

  useEffect(() => {
    loadUsage();
  }, [loadUsage]);

  const dateFormatOptions = {
    locale,
    fallback: t('common.emptyStates.notSet'),
    invalidFallback: t('common.errors.invalidDate'),
  };

  const periodLabel = myUsage
    ? `${formatDateTime(myUsage.period.startDate, dateFormatOptions)} ${t(
        'settings.aiUsage.to',
      )} ${formatDateTime(
        myUsage.period.endDate,
        dateFormatOptions,
      )}`
    : t('settings.aiUsage.currentMonth');

  return (
    <div className="space-y-8">
      <PageHeader
        title={t('settings.aiUsage.title')}
        description={t('settings.aiUsage.subtitle')}
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

      {!isLoading && !errorMessage && myUsage ? (
        <>
          <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
            <p className="text-sm font-medium text-blue-900">
              {t('settings.aiUsage.currentPeriod')}
            </p>
            <p className="mt-1 text-sm text-blue-800">{periodLabel}</p>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <ProgressCard
              title={t('settings.aiUsage.myCreditsUsed')}
              used={myUsage.user.creditsUsed}
              limit={myUsage.user.monthlyCreditsLimit}
              limitLabel={t('common.labels.limit')}
              locale={locale}
              remainingLabel={`${formatNumber(
                myUsage.user.creditsRemaining,
                locale,
              )} ${t('settings.aiUsage.remaining')}`}
            />

            <UsageCard
              title={t('settings.aiUsage.myRequests')}
              value={formatNumber(myUsage.user.requestsCount, locale)}
              description={`${formatNumber(
                myUsage.user.totalTokens,
                locale,
              )} ${t('settings.aiUsage.totalTokensThisMonth')}`}
            />

            <UsageCard
              title={t('settings.aiUsage.organizationBalance')}
              value={formatNumber(myUsage.organization.creditsBalance, locale)}
              description={t('settings.aiUsage.organizationBalanceDescription')}
            />

            <UsageCard
              title={t('settings.aiUsage.aiStatus')}
              value={
                myUsage.organization.aiEnabled
                  ? t('settings.aiUsage.enabled')
                  : t('settings.aiUsage.disabled')
              }
              description={
                myUsage.user.aiEnabled
                  ? t('settings.aiUsage.userCanRequest')
                  : t('settings.aiUsage.userAiDisabled')
              }
            />
          </section>

          {organizationUsage ? (
            <section className="space-y-4">
              <div>
                <p className="text-sm font-medium text-blue-700">
                  {t('settings.aiUsage.organizationTitle')}
                </p>
                <h2 className="mt-1 text-xl font-semibold text-slate-950">
                  {t('settings.aiUsage.teamConsumption')}
                </h2>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <ProgressCard
                  title={t('settings.aiUsage.organizationMonthlyCredits')}
                  used={organizationUsage.summary.creditsUsed}
                  limit={
                    organizationUsage.organization.aiMonthlyCreditsLimit
                  }
                  limitLabel={t('common.labels.limit')}
                  locale={locale}
                  remainingLabel={`${formatNumber(
                    organizationUsage.organization.creditsRemainingMonthly,
                    locale,
                  )} ${t('settings.aiUsage.monthlyCreditsRemaining')}`}
                />

                <UsageCard
                  title={t('settings.aiUsage.organizationRequests')}
                  value={formatNumber(
                    organizationUsage.summary.requestsCount,
                    locale,
                  )}
                  description={`${formatNumber(
                    organizationUsage.summary.totalTokens,
                    locale,
                  )} ${t('settings.aiUsage.totalTokensThisMonth')}`}
                />

                <UsageCard
                  title={t('settings.aiUsage.estimatedCost')}
                  value={formatUsd(
                    organizationUsage.summary.estimatedCostUsd,
                    locale,
                  )}
                  description={t('settings.aiUsage.estimatedCostDescription')}
                />

                <UsageCard
                  title={t('settings.aiUsage.creditsBalance')}
                  value={formatNumber(
                    organizationUsage.organization.aiCreditsBalance,
                    locale,
                  )}
                  description={t('settings.aiUsage.creditsBalanceDescription')}
                />
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="font-semibold text-slate-950">
                    {t('settings.aiUsage.usageByFeature')}
                  </h3>

                  <div className="mt-4 space-y-3">
                    {organizationUsage.usageByFeature.length > 0 ? (
                      organizationUsage.usageByFeature.map((feature) => (
                        <div
                          key={feature.feature}
                          className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                        >
                          <div className="flex justify-between gap-4">
                            <p className="font-medium text-slate-950">
                              {formatEnumLabel(feature.feature)}
                            </p>
                            <p className="text-sm font-medium text-slate-700">
                              {formatNumber(feature.creditsUsed, locale)}{' '}
                              {t('common.labels.credits')}
                            </p>
                          </div>
                          <p className="mt-1 text-sm text-slate-500">
                            {formatNumber(feature.requestsCount, locale)}{' '}
                            {t('settings.aiUsage.requests')} |{' '}
                            {formatNumber(feature.totalTokens, locale)}{' '}
                            {t('common.labels.tokens')}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">
                        {t('settings.aiUsage.noFeatureUsage')}
                      </p>
                    )}
                  </div>
                </article>

                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="font-semibold text-slate-950">
                    {t('settings.aiUsage.usageByUser')}
                  </h3>

                  <div className="mt-4 space-y-3">
                    {organizationUsage.usageByUser.length > 0 ? (
                      organizationUsage.usageByUser.map((usage) => (
                        <div
                          key={usage.userId ?? 'unknown'}
                          className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                        >
                          <div className="flex justify-between gap-4">
                            <p className="font-medium text-slate-950">
                              {usage.user?.name ??
                                t('settings.aiUsage.unknownUser')}
                            </p>
                            <p className="text-sm font-medium text-slate-700">
                              {formatNumber(usage.creditsUsed, locale)}{' '}
                              {t('common.labels.credits')}
                            </p>
                          </div>
                          <p className="mt-1 text-sm text-slate-500">
                            {usage.user?.email ??
                              t('settings.aiUsage.noEmail')}{' '}
                            | {formatNumber(usage.requestsCount, locale)}{' '}
                            {t('settings.aiUsage.requests')}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">
                        {t('settings.aiUsage.noUserUsage')}
                      </p>
                    )}
                  </div>
                </article>
              </div>
            </section>
          ) : null}

          <section className="space-y-4">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <p className="text-sm font-medium text-blue-700">
                  {t('settings.aiUsage.records')}
                </p>
                <h2 className="mt-1 text-xl font-semibold text-slate-950">
                  {t('settings.aiUsage.history')}
                </h2>
              </div>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  {t('common.labels.status')}
                </span>
                <select
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value as AiUsageStatus | '');
                    setPage(1);
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 md:w-56"
                >
                  {statusOptions.map((option) => (
                    <option key={option || 'all'} value={option}>
                      {option
                        ? getAiUsageStatusLabel(option, t)
                        : t('settings.users.allStatuses')}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {records.length === 0 ? (
              <EmptyState
                title={t('settings.aiUsage.noRecords')}
                description={t('settings.aiUsage.noRecordsDescription')}
              />
            ) : (
              <div className="space-y-3">
                {records.map((record) => (
                  <article
                    key={record.id}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2">
                          <Badge className={getStatusClasses(record.status)}>
                            {getAiUsageStatusLabel(record.status, t)}
                          </Badge>

                          <Badge className="bg-indigo-50 text-indigo-700 ring-indigo-200">
                            {formatEnumLabel(record.feature)}
                          </Badge>
                        </div>

                        <p className="font-semibold text-slate-950">
                          {record.aiSuggestion?.title ??
                            t('settings.aiUsage.record')}
                        </p>

                        <p className="text-sm text-slate-500">
                          {formatDateTime(record.createdAt, dateFormatOptions)}
                        </p>

                        {record.errorMessage ? (
                          <p className="text-sm text-amber-700">
                            {record.errorMessage}
                          </p>
                        ) : null}

                        <p className="text-sm text-slate-500">
                          {t('common.labels.provider')}:{' '}
                          {record.provider ?? t('common.emptyStates.notSet')}{' '}
                          | {t('common.labels.model')}:{' '}
                          {record.model ?? t('common.emptyStates.notSet')}
                        </p>
                      </div>

                      <div className="grid gap-2 text-right text-sm text-slate-600">
                        <span>
                          {t('common.labels.credits')}:{' '}
                          {formatNumber(record.creditsUsed, locale)}
                        </span>
                        <span>
                          {t('common.labels.tokens')}:{' '}
                          {formatNumber(record.totalTokens, locale)}
                        </span>
                        <span>
                          {t('common.labels.cost')}:{' '}
                          {formatUsd(record.estimatedCostUsd, locale)}
                        </span>
                      </div>
                    </div>
                  </article>
                ))}

                <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((currentPage) => currentPage - 1)}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {t('common.pagination.previous')}
                  </button>

                  <span className="text-sm text-slate-500">
                    {t('common.pagination.page')} {page}{' '}
                    {t('common.pagination.of')} {totalPages}
                  </span>

                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((currentPage) => currentPage + 1)}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {t('common.pagination.next')}
                  </button>
                </div>
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
