'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import { useAuth } from '@/hooks/useAuth';
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

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
}

function formatUsd(value: number) {
  return new Intl.NumberFormat('en-US', {
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
}: {
  title: string;
  used: number;
  limit: number;
  remainingLabel: string;
}) {
  const percent = getPercent(used, limit);

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">
            {formatNumber(used)}
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
        Limit: {formatNumber(limit)} · {remainingLabel}
      </p>
    </article>
  );
}

export default function AiUsagePage() {
  const { token, user } = useAuth();

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
        setErrorMessage('Could not load AI usage.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [canSeeOrganization, page, status, token]);

  useEffect(() => {
    loadUsage();
  }, [loadUsage]);

  const periodLabel = myUsage
    ? `${formatDateTime(myUsage.period.startDate)} to ${formatDateTime(
        myUsage.period.endDate,
      )}`
    : 'Current month';

  return (
    <div className="space-y-8">
      <PageHeader
        title="AI Usage"
        description="Monitor AI credits, personal limits, organization usage, and usage history."
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

      {!isLoading && !errorMessage && myUsage ? (
        <>
          <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
            <p className="text-sm font-medium text-blue-900">
              Current period
            </p>
            <p className="mt-1 text-sm text-blue-800">{periodLabel}</p>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <ProgressCard
              title="My AI credits used"
              used={myUsage.user.creditsUsed}
              limit={myUsage.user.monthlyCreditsLimit}
              remainingLabel={`${formatNumber(
                myUsage.user.creditsRemaining,
              )} remaining`}
            />

            <UsageCard
              title="My AI requests"
              value={formatNumber(myUsage.user.requestsCount)}
              description={`${formatNumber(
                myUsage.user.totalTokens,
              )} total tokens this month.`}
            />

            <UsageCard
              title="Organization balance"
              value={formatNumber(myUsage.organization.creditsBalance)}
              description="Available AI credits in the organization pool."
            />

            <UsageCard
              title="AI status"
              value={myUsage.organization.aiEnabled ? 'Enabled' : 'Disabled'}
              description={
                myUsage.user.aiEnabled
                  ? 'Your user can request AI suggestions.'
                  : 'AI is disabled for your user.'
              }
            />
          </section>

          {organizationUsage ? (
            <section className="space-y-4">
              <div>
                <p className="text-sm font-medium text-blue-700">
                  Organization AI Usage
                </p>
                <h2 className="mt-1 text-xl font-semibold text-slate-950">
                  Team consumption
                </h2>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <ProgressCard
                  title="Organization monthly credits"
                  used={organizationUsage.summary.creditsUsed}
                  limit={
                    organizationUsage.organization.aiMonthlyCreditsLimit
                  }
                  remainingLabel={`${formatNumber(
                    organizationUsage.organization.creditsRemainingMonthly,
                  )} monthly credits remaining`}
                />

                <UsageCard
                  title="Organization requests"
                  value={formatNumber(
                    organizationUsage.summary.requestsCount,
                  )}
                  description={`${formatNumber(
                    organizationUsage.summary.totalTokens,
                  )} total tokens this month.`}
                />

                <UsageCard
                  title="Estimated AI cost"
                  value={formatUsd(
                    organizationUsage.summary.estimatedCostUsd,
                  )}
                  description="Estimated provider cost for tracked usage."
                />

                <UsageCard
                  title="Credits balance"
                  value={formatNumber(
                    organizationUsage.organization.aiCreditsBalance,
                  )}
                  description="Current available organization credit pool."
                />
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="font-semibold text-slate-950">
                    Usage by feature
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
                              {formatNumber(feature.creditsUsed)} credits
                            </p>
                          </div>
                          <p className="mt-1 text-sm text-slate-500">
                            {formatNumber(feature.requestsCount)} request(s) ·{' '}
                            {formatNumber(feature.totalTokens)} tokens
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">
                        No feature usage this month.
                      </p>
                    )}
                  </div>
                </article>

                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="font-semibold text-slate-950">
                    Usage by user
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
                              {usage.user?.name ?? 'Unknown user'}
                            </p>
                            <p className="text-sm font-medium text-slate-700">
                              {formatNumber(usage.creditsUsed)} credits
                            </p>
                          </div>
                          <p className="mt-1 text-sm text-slate-500">
                            {usage.user?.email ?? 'No email'} ·{' '}
                            {formatNumber(usage.requestsCount)} request(s)
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">
                        No user usage this month.
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
                  Usage Records
                </p>
                <h2 className="mt-1 text-xl font-semibold text-slate-950">
                  AI usage history
                </h2>
              </div>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  Status
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
                      {option ? formatEnumLabel(option) : 'All statuses'}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {records.length === 0 ? (
              <EmptyState
                title="No AI usage records"
                description="Generate AI suggestions to start tracking usage."
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
                            {formatEnumLabel(record.status)}
                          </Badge>

                          <Badge className="bg-indigo-50 text-indigo-700 ring-indigo-200">
                            {formatEnumLabel(record.feature)}
                          </Badge>
                        </div>

                        <p className="font-semibold text-slate-950">
                          {record.aiSuggestion?.title ?? 'AI usage record'}
                        </p>

                        <p className="text-sm text-slate-500">
                          {formatDateTime(record.createdAt)}
                        </p>

                        {record.errorMessage ? (
                          <p className="text-sm text-amber-700">
                            {record.errorMessage}
                          </p>
                        ) : null}

                        <p className="text-sm text-slate-500">
                          Provider: {record.provider ?? 'Not set'} · Model:{' '}
                          {record.model ?? 'Not set'}
                        </p>
                      </div>

                      <div className="grid gap-2 text-right text-sm text-slate-600">
                        <span>
                          Credits: {formatNumber(record.creditsUsed)}
                        </span>
                        <span>
                          Tokens: {formatNumber(record.totalTokens)}
                        </span>
                        <span>Cost: {formatUsd(record.estimatedCostUsd)}</span>
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
                    Previous
                  </button>

                  <span className="text-sm text-slate-500">
                    Page {page} of {totalPages}
                  </span>

                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((currentPage) => currentPage + 1)}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
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