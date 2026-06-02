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
  getInvitationStatusLabel,
  getOrganizationRoleLabel,
} from '@/i18n/ai-display';
import { useI18n } from '@/i18n/useI18n';
import {
  ApiClientError,
  createOrganizationInvitation,
  deactivateOrganizationUser,
  getOrganizationInvitations,
  getOrganizationUsers,
  reactivateOrganizationUser,
  revokeOrganizationInvitation,
} from '@/lib/api-client';
import { formatDateTime } from '@/lib/formatters';
import type {
  EmailDeliveryStatus,
  OrganizationInvitation,
  OrganizationInvitationStatus,
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

const invitationStatusOptions: Array<OrganizationInvitationStatus | ''> = [
  '',
  'PENDING',
  'ACCEPTED',
  'REVOKED',
  'EXPIRED',
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

function getInvitationStatusClasses(status: OrganizationInvitationStatus) {
  const classes: Record<OrganizationInvitationStatus, string> = {
    PENDING: 'bg-blue-50 text-blue-700 ring-blue-200',
    ACCEPTED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    REVOKED: 'bg-rose-50 text-rose-700 ring-rose-200',
    EXPIRED: 'bg-amber-50 text-amber-700 ring-amber-200',
  };

  return classes[status];
}

function getInvitableRoles(currentRole?: string): OrganizationUserRole[] {
  if (currentRole === 'SUPER_ADMIN') {
    return ['OWNER', 'ADMIN', 'SALES', 'VIEWER'];
  }

  if (currentRole === 'OWNER') {
    return ['ADMIN', 'SALES', 'VIEWER'];
  }

  if (currentRole === 'ADMIN') {
    return ['SALES', 'VIEWER'];
  }

  return [];
}

function canManageTargetUser(
  currentUser:
    | {
        id: string;
        role: string;
      }
    | null
    | undefined,
  targetUser: OrganizationUser,
) {
  if (!currentUser) {
    return false;
  }

  if (currentUser.id === targetUser.id) {
    return false;
  }

  if (targetUser.role === 'SUPER_ADMIN' && currentUser.role !== 'SUPER_ADMIN') {
    return false;
  }

  if (currentUser.role === 'SUPER_ADMIN') {
    return true;
  }

  if (currentUser.role === 'OWNER') {
    return targetUser.role !== 'OWNER';
  }

  if (currentUser.role === 'ADMIN') {
    return targetUser.role === 'SALES' || targetUser.role === 'VIEWER';
  }

  return false;
}

function getInvitationCreatedMessage(
  status: EmailDeliveryStatus | undefined,
  t: (key: string) => string,
) {
  if (status === 'sent') {
    return t('common.emailDelivery.invitationSent');
  }

  if (status === 'failed') {
    return t('common.emailDelivery.invitationFailed');
  }

  if (status === 'skipped') {
    return t('common.emailDelivery.invitationSkipped');
  }

  return t('settings.users.invitationCreated');
}

export default function OrganizationUsersSettingsPage() {
  const { token, user } = useAuth();
  const { locale, t } = useI18n();
  const dateFormatOptions = {
    locale,
    fallback: t('common.emptyStates.notSet'),
    invalidFallback: t('common.errors.invalidDate'),
  };
  const activeOptions = [
    {
      label: t('settings.users.allStatuses'),
      value: '',
    },
    {
      label: t('settings.statuses.active'),
      value: 'true',
    },
    {
      label: t('settings.statuses.inactive'),
      value: 'false',
    },
  ];

  const [users, setUsers] = useState<OrganizationUser[]>([]);
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<OrganizationUserRole | ''>('');
  const [isActive, setIsActive] = useState('');
  const [invitationSearch, setInvitationSearch] = useState('');
  const [invitationStatus, setInvitationStatus] = useState<
    OrganizationInvitationStatus | ''
  >('');
  const [invitationForm, setInvitationForm] = useState({
    email: '',
    role: 'SALES' as OrganizationUserRole,
  });
  const [lastAcceptanceToken, setLastAcceptanceToken] = useState<string | null>(
    null,
  );
  const [lastInvitationEmail, setLastInvitationEmail] = useState<string | null>(
    null,
  );
  const [lastInvitationId, setLastInvitationId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [invitationPage, setInvitationPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [invitationTotalPages, setInvitationTotalPages] = useState(1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [invitationErrorMessage, setInvitationErrorMessage] = useState<
    string | null
  >(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingInvitations, setIsLoadingInvitations] = useState(true);
  const [isSubmittingInvitation, setIsSubmittingInvitation] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const roleOptions = useMemo(
    () => (user?.role === 'SUPER_ADMIN' ? platformRoleOptions : tenantRoleOptions),
    [user?.role],
  );

  const invitableRoles = useMemo(
    () => getInvitableRoles(user?.role),
    [user?.role],
  );

  useEffect(() => {
    if (user?.role !== 'SUPER_ADMIN' && role === 'SUPER_ADMIN') {
      setRole('');
      setPage(1);
    }
  }, [role, user?.role]);

  useEffect(() => {
    if (
      invitableRoles.length > 0 &&
      !invitableRoles.includes(invitationForm.role)
    ) {
      setInvitationForm((current) => ({
        ...current,
        role: invitableRoles[0],
      }));
    }
  }, [invitableRoles, invitationForm.role]);

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
        setErrorMessage(t('settings.users.loadUsersFailed'));
      }
    } finally {
      setIsLoading(false);
    }
  }, [isActive, page, role, search, token, t]);

  const loadInvitations = useCallback(async () => {
    if (!token) {
      setIsLoadingInvitations(false);
      return;
    }

    setIsLoadingInvitations(true);
    setInvitationErrorMessage(null);

    try {
      const response = await getOrganizationInvitations(token, {
        page: invitationPage,
        pageSize: 10,
        search: invitationSearch || undefined,
        status: invitationStatus || undefined,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      setInvitations(response.data);
      setInvitationTotalPages(response.meta.totalPages || 1);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setInvitationErrorMessage(error.message);
      } else if (error instanceof Error) {
        setInvitationErrorMessage(error.message);
      } else {
        setInvitationErrorMessage(t('settings.users.loadInvitationsFailed'));
      }
    } finally {
      setIsLoadingInvitations(false);
    }
  }, [invitationPage, invitationSearch, invitationStatus, token, t]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    loadInvitations();
  }, [loadInvitations]);

  async function handleCreateInvitation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      return;
    }

    setIsSubmittingInvitation(true);
    setInvitationErrorMessage(null);
    setSuccessMessage(null);
    setLastAcceptanceToken(null);
    setLastInvitationEmail(null);

    try {
      const response = await createOrganizationInvitation(token, {
        email: invitationForm.email,
        role: invitationForm.role,
      });

      setInvitationForm((current) => ({
        ...current,
        email: '',
      }));
      setLastAcceptanceToken(response.acceptanceToken ?? null);
      setLastInvitationEmail(response.invitation.email);
      setLastInvitationId(response.invitation.id);
      setSuccessMessage(
        getInvitationCreatedMessage(response.emailDeliveryStatus, t),
      );
      setInvitationPage(1);
      await loadInvitations();
    } catch (error) {
      if (error instanceof ApiClientError) {
        setInvitationErrorMessage(error.message);
      } else if (error instanceof Error) {
        setInvitationErrorMessage(error.message);
      } else {
        setInvitationErrorMessage(t('settings.users.createInvitationFailed'));
      }
    } finally {
      setIsSubmittingInvitation(false);
    }
  }

  async function handleRevokeInvitation(invitationId: string) {
    if (!token) {
      return;
    }

    setInvitationErrorMessage(null);
    setSuccessMessage(null);

    try {
      await revokeOrganizationInvitation(token, invitationId);
      setSuccessMessage(t('settings.users.invitationRevoked'));

      if (lastInvitationId === invitationId) {
        setLastAcceptanceToken(null);
        setLastInvitationEmail(null);
        setLastInvitationId(null);
      }

      await loadInvitations();
    } catch (error) {
      if (error instanceof ApiClientError) {
        setInvitationErrorMessage(error.message);
      } else if (error instanceof Error) {
        setInvitationErrorMessage(error.message);
      } else {
        setInvitationErrorMessage(t('settings.users.revokeInvitationFailed'));
      }
    }
  }

async function handleDeactivateUser(userId: string) {
  if (!token) {
    return;
  }

  setUpdatingUserId(userId);
  setErrorMessage(null);
  setSuccessMessage(null);

  try {
    await deactivateOrganizationUser(token, userId);
    setSuccessMessage(t('settings.users.userDeactivated'));
    await loadUsers();
  } catch (error) {
    if (error instanceof ApiClientError) {
      setErrorMessage(error.message);
    } else if (error instanceof Error) {
      setErrorMessage(error.message);
    } else {
      setErrorMessage(t('settings.users.deactivateFailed'));
    }
  } finally {
    setUpdatingUserId(null);
  }
}

async function handleReactivateUser(userId: string) {
  if (!token) {
    return;
  }

  setUpdatingUserId(userId);
  setErrorMessage(null);
  setSuccessMessage(null);

  try {
    await reactivateOrganizationUser(token, userId);
    setSuccessMessage(t('settings.users.userReactivated'));
    await loadUsers();
  } catch (error) {
    if (error instanceof ApiClientError) {
      setErrorMessage(error.message);
    } else if (error instanceof Error) {
      setErrorMessage(error.message);
    } else {
      setErrorMessage(t('settings.users.reactivateFailed'));
    }
  } finally {
    setUpdatingUserId(null);
  }
}

  return (
    <div className="space-y-8">
      <PageHeader
        title={t('settings.users.title')}
        description={t('settings.users.subtitle')}
        actions={
          <Link
            href="/dashboard/settings"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            {t('settings.back')}
          </Link>
        }
      />

      {successMessage ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
          {successMessage}
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">
          {t('settings.users.inviteUser')}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {t('settings.users.inviteDescription')}
        </p>

        {invitableRoles.length === 0 ? (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            {t('settings.users.noInvitePermission')}
          </p>
        ) : (
          <form
            onSubmit={handleCreateInvitation}
            className="mt-5 grid gap-4 lg:grid-cols-[1fr_220px_auto]"
          >
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">
                {t('common.labels.email')}
              </span>
              <input
                type="email"
                value={invitationForm.email}
                onChange={(event) =>
                  setInvitationForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                placeholder="new.user@example.com"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                required
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">
                {t('common.labels.role')}
              </span>
              <select
                value={invitationForm.role}
                onChange={(event) =>
                  setInvitationForm((current) => ({
                    ...current,
                    role: event.target.value as OrganizationUserRole,
                  }))
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              >
                {invitableRoles.map((option) => (
                  <option key={option} value={option}>
                    {getOrganizationRoleLabel(option, t)}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={isSubmittingInvitation}
                className="w-full rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 lg:w-auto"
              >
                {isSubmittingInvitation
                  ? t('settings.users.creatingInvitation')
                  : t('settings.users.createInvitation')}
              </button>
            </div>
          </form>
        )}

        {lastAcceptanceToken ? (
          <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm font-medium text-blue-900">
              {t('settings.users.devTokenFor').replace(
                '{email}',
                lastInvitationEmail ?? '',
              )}
            </p>
            <p className="mt-2 break-all rounded-xl bg-white p-3 font-mono text-xs text-blue-900">
              {lastAcceptanceToken}
            </p>
            <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <p className="text-sm text-blue-800">
                {t('settings.users.tokenEmailLater')}
              </p>

              <button
                type="button"
                onClick={() => {
                  setLastAcceptanceToken(null);
                  setLastInvitationEmail(null);
                  setLastInvitationId(null);
                }}
                className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-50"
              >
                {t('settings.users.hideToken')}
              </button>
            </div>
          </div>
        ) : null}

        {invitationErrorMessage ? (
          <div className="mt-5">
            <ErrorState message={invitationErrorMessage} />
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">
              {t('settings.users.searchInvitations')}
            </span>
            <input
              value={invitationSearch}
              onChange={(event) => {
                setInvitationSearch(event.target.value);
                setInvitationPage(1);
              }}
              placeholder={t('settings.users.searchInvitationsPlaceholder')}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">
              {t('settings.users.invitationStatus')}
            </span>
            <select
              value={invitationStatus}
              onChange={(event) => {
                setInvitationStatus(
                  event.target.value as OrganizationInvitationStatus | '',
                );
                setInvitationPage(1);
              }}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            >
              {invitationStatusOptions.map((option) => (
                <option key={option || 'all'} value={option}>
                  {option
                    ? getInvitationStatusLabel(option, t)
                    : t('settings.users.allStatuses')}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-5">
          {isLoadingInvitations ? <LoadingSkeleton rows={5} /> : null}

          {!isLoadingInvitations && invitations.length === 0 ? (
            <EmptyState
              title={t('settings.users.noInvitations')}
              description={t('settings.users.noInvitationsDescription')}
            />
          ) : null}

          {!isLoadingInvitations && invitations.length > 0 ? (
            <div className="space-y-3">
              {invitations.map((invitation) => (
                <article
                  key={invitation.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
                >
                  <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <Badge
                          className={getInvitationStatusClasses(
                            invitation.status,
                          )}
                        >
                          {getInvitationStatusLabel(invitation.status, t)}
                        </Badge>

                        <Badge className={getRoleClasses(invitation.role)}>
                          {getOrganizationRoleLabel(invitation.role, t)}
                        </Badge>
                      </div>

                      <h3 className="mt-3 text-lg font-semibold text-slate-950">
                        {invitation.email}
                      </h3>

                      <p className="mt-1 text-sm text-slate-500">
                        {t('settings.users.invitedBy')}:{' '}
                        {invitation.invitedBy
                          ? `${invitation.invitedBy.name} (${invitation.invitedBy.email})`
                          : t('settings.users.unknown')}
                      </p>

                      {invitation.acceptedBy ? (
                        <p className="mt-1 text-sm text-slate-500">
                          {t('settings.users.acceptedBy')}:{' '}
                          {invitation.acceptedBy.name} (
                          {invitation.acceptedBy.email})
                        </p>
                      ) : null}
                    </div>

                    <div className="grid gap-2 text-sm text-slate-600 lg:text-right">
                      <span>
                        {t('common.labels.created')}:{' '}
                        {formatDateTime(invitation.createdAt, dateFormatOptions)}
                      </span>
                      <span>
                        {t('settings.users.expires')}:{' '}
                        {formatDateTime(invitation.expiresAt, dateFormatOptions)}
                      </span>
                      {invitation.acceptedAt ? (
                        <span>
                          {t('settings.users.accepted')}:{' '}
                          {formatDateTime(
                            invitation.acceptedAt,
                            dateFormatOptions,
                          )}
                        </span>
                      ) : null}
                      {invitation.revokedAt ? (
                        <span>
                          {t('settings.users.revoked')}:{' '}
                          {formatDateTime(
                            invitation.revokedAt,
                            dateFormatOptions,
                          )}
                        </span>
                      ) : null}

                      {invitation.status === 'PENDING' ? (
                        <button
                          type="button"
                          onClick={() => handleRevokeInvitation(invitation.id)}
                          className="mt-2 rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50"
                        >
                          {t('settings.users.revoke')}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}

              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4">
                <button
                  type="button"
                  disabled={invitationPage <= 1}
                  onClick={() =>
                    setInvitationPage((currentPage) => currentPage - 1)
                  }
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t('common.pagination.previous')}
                </button>

                <span className="text-sm text-slate-500">
                  {t('common.pagination.page')} {invitationPage}{' '}
                  {t('common.pagination.of')} {invitationTotalPages}
                </span>

                <button
                  type="button"
                  disabled={invitationPage >= invitationTotalPages}
                  onClick={() =>
                    setInvitationPage((currentPage) => currentPage + 1)
                  }
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t('common.pagination.next')}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1fr_220px_220px]">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">
              {t('settings.users.searchUsers')}
            </span>
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder={t('settings.users.searchUsersPlaceholder')}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">
              {t('common.labels.role')}
            </span>
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
                  {option
                    ? getOrganizationRoleLabel(option, t)
                    : t('settings.users.allRoles')}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">
              {t('common.labels.status')}
            </span>
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

        <div className="mt-5">
          {isLoading ? <LoadingSkeleton rows={8} /> : null}

          {!isLoading && errorMessage ? (
            <ErrorState message={errorMessage} />
          ) : null}

          {!isLoading && !errorMessage ? (
            users.length === 0 ? (
              <EmptyState
                title={t('settings.users.noUsers')}
                description={t('settings.users.noUsersDescription')}
              />
            ) : (
              <section className="space-y-3">
                {users.map((orgUser) => (
                  <article
                    key={orgUser.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
                  >
                    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <Badge className={getRoleClasses(orgUser.role)}>
                            {getOrganizationRoleLabel(orgUser.role, t)}
                          </Badge>

                          <Badge
                            className={
                              orgUser.isActive
                                ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                                : 'bg-rose-50 text-rose-700 ring-rose-200'
                            }
                          >
                            {orgUser.isActive
                              ? t('settings.statuses.active')
                              : t('settings.statuses.inactive')}
                          </Badge>
                        </div>

                        <h2 className="mt-3 text-lg font-semibold text-slate-950">
                          {orgUser.name}
                        </h2>

                        <p className="mt-1 text-sm text-slate-500">
                          {orgUser.email}
                        </p>
                      </div>

                    <div className="grid gap-2 text-sm text-slate-600 lg:text-right">
                      <span>
                        {t('common.labels.created')}:{' '}
                        {formatDateTime(orgUser.createdAt, dateFormatOptions)}
                      </span>
                      <span>
                        {t('crm.common.updated')}:{' '}
                        {formatDateTime(orgUser.updatedAt, dateFormatOptions)}
                      </span>

                      {canManageTargetUser(user, orgUser) ? (
                        orgUser.isActive ? (
                          <button
                            type="button"
                            disabled={updatingUserId === orgUser.id}
                            onClick={() => handleDeactivateUser(orgUser.id)}
                            className="mt-2 rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {updatingUserId === orgUser.id
                              ? t('common.actions.updating')
                              : t('settings.users.deactivate')}
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={updatingUserId === orgUser.id}
                            onClick={() => handleReactivateUser(orgUser.id)}
                            className="mt-2 rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {updatingUserId === orgUser.id
                              ? t('common.actions.updating')
                              : t('settings.users.reactivate')}
                          </button>
                        )
                      ) : null}
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
              </section>
            )
          ) : null}
        </div>
      </section>
    </div>
  );
}
