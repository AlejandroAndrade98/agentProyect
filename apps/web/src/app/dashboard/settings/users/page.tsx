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
  getOrganizationUsers,
} from '@/lib/api-client';
import { formatDateTime, formatEnumLabel } from '@/lib/formatters';
import type {
  OrganizationUser,
  OrganizationUserRole,
} from '@/types/organization-settings';

const tenantRoleOptions: Array<OrganizationUserRole | ''> = [
  '',
  'OWNER',
  'ADMIN',
  'SALES',
  'VIEWER',
];

const platformRoleOptions: Array<OrganizationUserRole | ''> = [
  '',
  'SUPER_ADMIN',
  'OWNER',
  'ADMIN',
  'SALES',
  'VIEWER',
];

const activeOptions = [
  {
    label: 'All statuses',
    value: '',
  },
  {
    label: 'Active',
    value: 'true',
  },
  {
    label: 'Inactive',
    value: 'false',
  },
];

function getRoleClasses(role: OrganizationUserRole) {
  const classes: Record<OrganizationUserRole, string> = {
    SUPER_ADMIN: 'bg-purple-50 text-purple-700 ring-purple-200',
    OWNER: 'bg-blue-50 text-blue-700 ring-blue-200',
    ADMIN: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
    SALES: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    VIEWER: 'bg-slate-100 text-slate-700 ring-slate-200',
  };

  return classes[role];
}

export default function OrganizationUsersSettingsPage() {
  const { token, user } = useAuth();

  const [users, setUsers] = useState<OrganizationUser[]>([]);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<OrganizationUserRole | ''>('');
  const [isActive, setIsActive] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const roleOptions = useMemo(
  () => (user?.role === 'SUPER_ADMIN' ? platformRoleOptions : tenantRoleOptions),
  [user?.role],
  );

    useEffect(() => {
    if (user?.role !== 'SUPER_ADMIN' && role === 'SUPER_ADMIN') {
        setRole('');
        setPage(1);
    }
    }, [role, user?.role]);

  const loadUsers = useCallback(async () => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await getOrganizationUsers(token, {
        page,
        pageSize: 10,
        search: search || undefined,
        role: role || undefined,
        isActive: isActive || undefined,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      setUsers(response.data);
      setTotalPages(response.meta.totalPages || 1);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Could not load organization users.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [isActive, page, role, search, token]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Organization Users"
        description="Review users, roles, and access status in your organization."
        actions={
          <Link
            href="/dashboard/settings"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Back to settings
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
              placeholder="Search by name or email"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Role</span>
            <select
              value={role}
              onChange={(event) => {
                setRole(event.target.value as OrganizationUserRole | '');
                setPage(1);
              }}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            >
              {roleOptions.map((option) => (
                <option key={option || 'all'} value={option}>
                  {option ? formatEnumLabel(option) : 'All roles'}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Status</span>
            <select
              value={isActive}
              onChange={(event) => {
                setIsActive(event.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            >
              {activeOptions.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {isLoading ? <LoadingSkeleton rows={8} /> : null}

      {!isLoading && errorMessage ? <ErrorState message={errorMessage} /> : null}

      {!isLoading && !errorMessage ? (
        users.length === 0 ? (
          <EmptyState
            title="No users found"
            description="Try changing your filters or search terms."
          />
        ) : (
          <section className="space-y-3">
            {users.map((orgUser) => (
              <article
                key={orgUser.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <Badge className={getRoleClasses(orgUser.role)}>
                        {formatEnumLabel(orgUser.role)}
                      </Badge>

                      <Badge
                        className={
                          orgUser.isActive
                            ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                            : 'bg-rose-50 text-rose-700 ring-rose-200'
                        }
                      >
                        {orgUser.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>

                    <h2 className="mt-3 text-lg font-semibold text-slate-950">
                      {orgUser.name}
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      {orgUser.email}
                    </p>
                  </div>

                  <div className="grid gap-1 text-sm text-slate-600 lg:text-right">
                    <span>Created: {formatDateTime(orgUser.createdAt)}</span>
                    <span>Updated: {formatDateTime(orgUser.updatedAt)}</span>
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
          </section>
        )
      ) : null}
    </div>
  );
}