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
  getPlatformOrganizations,
} from '@/lib/api-client';
import { formatDateTime, formatEnumLabel } from '@/lib/formatters';
import type {
  OrganizationAccountType,
  OrganizationStatus,
  PlatformOrganizationListItem,
} from '@/types/platform';

const statusOptions: Array<OrganizationStatus | ''> = [
  '',
  'TRIAL',
  'ACTIVE',
  'SUSPENDED',
  'CANCELLED',
];

const accountTypeOptions: Array<OrganizationAccountType | ''> = [
  '',
  'INDIVIDUAL',
  'COMPANY',
];

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

function OrganizationCard({
  organization,
}: {
  organization: PlatformOrganizationListItem;
}) {
  const primaryAdmin = organization.users[0];

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:bg-blue-50/30">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
        <div className="space-y-3">
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

          <div>
            <Link
              href={`/dashboard/platform/organizations/${organization.id}`}
              className="text-lg font-semibold text-slate-950 transition hover:text-blue-700"
            >
              {organization.name}
            </Link>
            <p className="mt-1 text-sm text-slate-500">
              /{organization.slug} · Created {formatDateTime(organization.createdAt)}
            </p>
          </div>

          <p className="text-sm text-slate-600">
            Primary admin:{' '}
          <span className="font-medium text-slate-900">
            {primaryAdmin
              ? `${primaryAdmin.name} (${primaryAdmin.email}) · ${formatEnumLabel(
                  primaryAdmin.role,
                )}`
              : 'No primary admin found'}
          </span>
          </p>
        </div>

        <div className="grid gap-2 text-sm text-slate-600 xl:text-right">
          <span>{formatNumber(organization._count.users)} user(s)</span>
          <span>{formatNumber(organization._count.leads)} lead(s)</span>
          <span>{formatNumber(organization._count.aiUsageRecords)} AI usage record(s)</span>
          <span>{formatNumber(organization.aiCreditsBalance)} credits</span>
        </div>
      </div>
    </article>
  );
}

export default function PlatformOrganizationsPage() {
  const { token, user } = useAuth();

  const [organizations, setOrganizations] = useState<
    PlatformOrganizationListItem[]
  >([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<OrganizationStatus | ''>('');
  const [accountType, setAccountType] = useState<OrganizationAccountType | ''>(
    '',
  );
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const canSeePlatform = useMemo(() => canViewPlatform(user?.role), [user?.role]);

  const loadOrganizations = useCallback(async () => {
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
      const response = await getPlatformOrganizations(token, {
        page,
        pageSize: 10,
        search: search || undefined,
        status: status || undefined,
        accountType: accountType || undefined,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      setOrganizations(response.data);
      setTotalPages(response.meta.totalPages || 1);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Could not load platform organizations.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [accountType, canSeePlatform, page, search, status, token]);

  useEffect(() => {
    loadOrganizations();
  }, [loadOrganizations]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Platform"
        title="Organizations"
        description="Review organizations, account status, usage limits, and platform-level ownership."
        actions={
          <Link
            href="/dashboard/platform/organizations/new"
            className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Create organization
          </Link>
        }
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1fr_220px_220px]">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Search</span>
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search by name, slug, billing or support email"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Status</span>
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as OrganizationStatus | '');
                setPage(1);
              }}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            >
              {statusOptions.map((option) => (
                <option key={option || 'all'} value={option}>
                  {option ? formatEnumLabel(option) : 'All statuses'}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">
              Account type
            </span>
            <select
              value={accountType}
              onChange={(event) => {
                setAccountType(
                  event.target.value as OrganizationAccountType | '',
                );
                setPage(1);
              }}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            >
              {accountTypeOptions.map((option) => (
                <option key={option || 'all'} value={option}>
                  {option ? formatEnumLabel(option) : 'All account types'}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {isLoading ? <LoadingSkeleton rows={8} /> : null}

      {!isLoading && errorMessage ? <ErrorState message={errorMessage} /> : null}

      {!isLoading && !errorMessage ? (
        organizations.length === 0 ? (
          <EmptyState
            title="No organizations found"
            description="Try changing your filters or search terms."
          />
        ) : (
          <section className="space-y-3">
            {organizations.map((organization) => (
              <OrganizationCard
                key={organization.id}
                organization={organization}
              />
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
          </section>
        )
      ) : null}
    </div>
  );
}