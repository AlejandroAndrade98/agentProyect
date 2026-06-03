'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { PageHeader } from '@/components/ui/PageHeader';
import { useAuth } from '@/hooks/useAuth';
import {
  getConnectedAccountCapabilityLabel,
  getConnectedAccountProviderLabel,
  getConnectedAccountStatusLabel,
  getSyncStatusLabel,
} from '@/i18n/ai-display';
import { useI18n } from '@/i18n/useI18n';
import {
  ApiClientError,
  createDevConnectedAccount,
  disconnectConnectedAccount,
  getConnectedAccounts,
  requestConnectedAccountDisconnect,
} from '@/lib/api-client';
import {
  canConnectConnectedAccount,
  canManageConnectedAccounts,
  canRequestConnectedAccountDisconnect,
} from '@/lib/permissions';
import type {
  ConnectedAccount,
  ConnectedAccountCapability,
  ConnectedAccountProvider,
} from '@/types/connected-accounts';
import { startGoogleOAuth } from '@/lib/api-client';


const providerOptions: ConnectedAccountProvider[] = ['GOOGLE', 'MICROSOFT'];
const capabilityOptions: ConnectedAccountCapability[] = ['EMAIL', 'CALENDAR'];
const canUseDevConnectedAccountForm =
  process.env.NODE_ENV === 'development' ||
  process.env.NEXT_PUBLIC_ENABLE_DEV_CONNECTED_ACCOUNTS === 'true';

function formatConnectedDateTime(
  value: string | null,
  locale: string,
  fallback: string,
  invalidFallback: string,
) {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return invalidFallback;
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function getStatusClass(status: ConnectedAccount['status']) {
  switch (status) {
    case 'CONNECTED':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'DISCONNECT_REQUESTED':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'DISCONNECTED':
    case 'REVOKED':
      return 'border-slate-200 bg-slate-100 text-slate-600';
    case 'ERROR':
      return 'border-red-200 bg-red-50 text-red-700';
    case 'PENDING':
    default:
      return 'border-blue-200 bg-blue-50 text-blue-700';
  }
}

function getSyncStatusClass(status: string) {
  switch (status) {
    case 'ACTIVE':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'INITIAL_SYNC_PENDING':
    case 'INITIAL_SYNC_RUNNING':
      return 'border-blue-200 bg-blue-50 text-blue-700';
    case 'PAUSED':
      return 'border-slate-200 bg-slate-100 text-slate-600';
    case 'ERROR':
      return 'border-red-200 bg-red-50 text-red-700';
    case 'NOT_STARTED':
    default:
      return 'border-slate-200 bg-white text-slate-600';
  }
}

function isFinalStatus(status: ConnectedAccount['status']) {
  return status === 'DISCONNECTED' || status === 'REVOKED';
}

function isDisconnectRequested(status: ConnectedAccount['status']) {
  return status === 'DISCONNECT_REQUESTED';
}

export default function ConnectedAccountsSettingsPage() {
  const { user, token } = useAuth();
  const { locale, t } = useI18n();

  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isStartingGoogleOAuth, setIsStartingGoogleOAuth] = useState(false);


  const [provider, setProvider] =
    useState<ConnectedAccountProvider>('GOOGLE');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [capabilities, setCapabilities] = useState<
    ConnectedAccountCapability[]
  >(['EMAIL', 'CALENDAR']);

  const canConnect = canConnectConnectedAccount(user);
  const canManage = canManageConnectedAccounts(user);
  const canRequestDisconnect = canRequestConnectedAccountDisconnect(user);

  const currentUserAccount = useMemo(() => {
    if (!user) {
      return null;
    }

    return accounts.find((account) => account.userId === user.id) ?? null;
  }, [accounts, user]);

  const canShowDevConnectForm =
    canUseDevConnectedAccountForm &&
    Boolean(token) &&
    canConnect &&
    !currentUserAccount;
  const canShowGoogleConnect =
    Boolean(token) && canConnect && !currentUserAccount;
  const canReconnectGoogle =
    Boolean(token) &&
    canConnect &&
    currentUserAccount?.provider === 'GOOGLE' &&
    currentUserAccount.status === 'DISCONNECTED';

  const pendingDisconnectRequests = useMemo(
    () =>
      accounts.filter((account) =>
        isDisconnectRequested(account.status),
      ),
    [accounts],
  );

  const loadAccounts = useCallback(async () => {
    if (!token) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await getConnectedAccounts(token, {
        page: 1,
        pageSize: 50,
      });

      setAccounts(response.data);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, t));
    } finally {
      setIsLoading(false);
    }
  }, [token, t]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
  const params = new URLSearchParams(window.location.search);

  if (params.get('reconnected') === 'google') {
    setSuccessMessage(t('settings.connectedAccounts.googleReconnected'));
  } else if (params.get('connected') === 'google') {
    setSuccessMessage(t('settings.connectedAccounts.googleConnected'));
  }
  }, [t]);

  function toggleCapability(capability: ConnectedAccountCapability) {
    setCapabilities((current) => {
      if (current.includes(capability)) {
        const next = current.filter((item) => item !== capability);
        return next.length > 0 ? next : current;
      }

      return [...current, capability];
    });
  }

  async function handleDevConnect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await createDevConnectedAccount(token, {
        provider,
        email: email.trim(),
        displayName: displayName.trim() || undefined,
        capabilities,
      });

      setSuccessMessage(t('settings.connectedAccounts.devConnected'));
      setEmail('');
      setDisplayName('');
      setCapabilities(['EMAIL', 'CALENDAR']);
      await loadAccounts();
    } catch (error) {
      setErrorMessage(getErrorMessage(error, t));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRequestDisconnect(accountId: string) {
    if (!token) {
      return;
    }

    setActionId(accountId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await requestConnectedAccountDisconnect(token, accountId);
      setSuccessMessage(t('settings.connectedAccounts.disconnectRequested'));
      await loadAccounts();
    } catch (error) {
      setErrorMessage(getErrorMessage(error, t));
    } finally {
      setActionId(null);
    }
  }

  async function handleDisconnect(accountId: string) {
    if (!token) {
      return;
    }

    setActionId(accountId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await disconnectConnectedAccount(token, accountId);
      setSuccessMessage(t('settings.connectedAccounts.disconnectedSuccess'));
      await loadAccounts();
    } catch (error) {
      setErrorMessage(getErrorMessage(error, t));
    } finally {
      setActionId(null);
    }
  }

async function handleStartGoogleOAuth() {
  if (!token) {
    setErrorMessage(t('common.errors.missingAccessToken'));
    return;
  }

  try {
    setIsStartingGoogleOAuth(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const response = await startGoogleOAuth(token, {
      capabilities: ['EMAIL', 'CALENDAR'],
    });

    window.location.assign(response.authorizationUrl);
  } catch (error) {
    setErrorMessage(getErrorMessage(error, t));
  } finally {
    setIsStartingGoogleOAuth(false);
  }
}

  const dateFallback = t('settings.connectedAccounts.notAvailable');
  const invalidDateFallback = t('common.errors.invalidDate');
  const formatAccountDate = (value: string | null) =>
    formatConnectedDateTime(value, locale, dateFallback, invalidDateFallback);

  return (
    <div className="space-y-8">
      <PageHeader
        title={t('settings.connectedAccounts.title')}
        description={t('settings.connectedAccounts.subtitle')}
        actions={
          <Link
            href="/dashboard/settings"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            {t('settings.back')}
          </Link>
        }
      />

      <section className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
        <p className="text-sm font-semibold text-blue-800">
          {t('settings.connectedAccounts.foundationMode')}
        </p>
        <p className="mt-2 text-sm leading-6 text-blue-700">
          {t('settings.connectedAccounts.foundationDescription')}
        </p>
      </section>

      {errorMessage ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      {canShowGoogleConnect ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-blue-700">
                {t('settings.connectedAccounts.realOAuth')}
              </p>
              <h2 className="mt-1 text-lg font-semibold text-slate-900">
                {t('settings.connectedAccounts.connectGoogleAccount')}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                {t('settings.connectedAccounts.connectGoogleDescription')}
              </p>
            </div>

            <button
              type="button"
              onClick={handleStartGoogleOAuth}
              disabled={isStartingGoogleOAuth}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isStartingGoogleOAuth
                ? t('settings.connectedAccounts.startingGoogle')
                : t('settings.connectedAccounts.connectGoogle')}
            </button>
          </div>
        </section>
      ) : null}

      {canShowDevConnectForm ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <p className="text-sm font-medium text-blue-700">
              {t('settings.connectedAccounts.developmentConnection')}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">
              {t('settings.connectedAccounts.connectSimulated')}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {t('settings.connectedAccounts.simulatedDescription')}
            </p>
            <p className="mt-2 text-sm leading-6 text-blue-700">
              {t('settings.connectedAccounts.foundationDescription')}
            </p>
          </div>

          <form
            onSubmit={handleDevConnect}
            className="mt-6 grid gap-4 md:grid-cols-2"
          >
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">
                {t('common.labels.provider')}
              </span>
              <select
                value={provider}
                onChange={(event) =>
                  setProvider(event.target.value as ConnectedAccountProvider)
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              >
                {providerOptions.map((option) => (
                  <option key={option} value={option}>
                    {getConnectedAccountProviderLabel(option, t)}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">
                {t('common.labels.email')}
              </span>
              <input
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="user@example.com"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">
                {t('settings.connectedAccounts.displayName')}
              </span>
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder={t('settings.connectedAccounts.displayNamePlaceholder')}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </label>

            <div className="space-y-3 md:col-span-2">
              <p className="text-sm font-medium text-slate-700">
                {t('settings.connectedAccounts.capabilities')}
              </p>

              <div className="flex flex-wrap gap-3">
                {capabilityOptions.map((capability) => (
                  <label
                    key={capability}
                    className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
                  >
                    <input
                      type="checkbox"
                      checked={capabilities.includes(capability)}
                      onChange={() => toggleCapability(capability)}
                    />
                    {getConnectedAccountCapabilityLabel(capability, t)}
                  </label>
                ))}
              </div>
            </div>

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting
                  ? t('common.actions.creating')
                  : t('settings.connectedAccounts.createDevConnection')}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {currentUserAccount && !canReconnectGoogle ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-semibold text-amber-800">
            {t('settings.connectedAccounts.oneAccountTitle')}
          </p>
          <p className="mt-2 text-sm leading-6 text-amber-700">
            {t('settings.connectedAccounts.oneAccountDescription')}
          </p>
        </section>
      ) : null}

      {canManage && pendingDisconnectRequests.length > 0 ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-amber-800">
                {t(
                  'settings.connectedAccounts.pendingDisconnectRequests',
                )}
              </p>
              <p className="mt-2 text-sm leading-6 text-amber-700">
                {t(
                  'settings.connectedAccounts.pendingDisconnectRequestsDescription',
                )}
              </p>
            </div>

            <span className="w-fit rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-700">
              {pendingDisconnectRequests.length}
            </span>
          </div>
        </section>
      ) : null}

      {canReconnectGoogle ? (
        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-blue-700">
                {t('settings.connectedAccounts.statuses.disconnected')}
              </p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950">
                {t('settings.connectedAccounts.reconnectGoogle')}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-800">
                {t('settings.connectedAccounts.reconnectGoogleDescription')}
              </p>
            </div>

            <button
              type="button"
              onClick={handleStartGoogleOAuth}
              disabled={isStartingGoogleOAuth}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isStartingGoogleOAuth
                ? t('settings.connectedAccounts.startingGoogle')
                : t('settings.connectedAccounts.reconnectGoogle')}
            </button>
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              {t('settings.connectedAccounts.accounts')}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {t('settings.connectedAccounts.accountsDescription')}
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadAccounts()}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            {t('common.actions.refresh')}
          </button>
        </div>

        {isLoading ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
            {t('settings.connectedAccounts.loading')}
          </div>
        ) : accounts.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <h3 className="text-base font-semibold text-slate-900">
              {t('settings.connectedAccounts.none')}
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              {t('settings.connectedAccounts.noneDescription')}
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {accounts.map((account) => {
              const isOwnAccount = account.userId === user?.id;
              const isPendingDisconnect = isDisconnectRequested(account.status);
              const canRequestOwnDisconnect =
                canRequestDisconnect &&
                !canManage &&
                isOwnAccount &&
                !isFinalStatus(account.status) &&
                !isPendingDisconnect;
              const canDisconnectOwnAccount =
                canManage &&
                isOwnAccount &&
                !isFinalStatus(account.status);
              const canApprovePendingDisconnect =
                canManage &&
                !isOwnAccount &&
                isPendingDisconnect &&
                !isFinalStatus(account.status);
              const canAdminDisconnectOtherAccount =
                canManage &&
                !isOwnAccount &&
                !isPendingDisconnect &&
                !isFinalStatus(account.status);

              return (
                <article
                  key={account.id}
                  className="rounded-2xl border border-slate-200 p-5"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-slate-950">
                          {account.displayName || account.email}
                        </h3>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClass(
                            account.status,
                          )}`}
                        >
                          {getConnectedAccountStatusLabel(account.status, t)}
                        </span>
                      </div>

                      <p className="mt-1 text-sm text-slate-500">
                        {account.email}
                      </p>

                      {isPendingDisconnect ? (
                        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                          <p className="text-sm font-semibold text-amber-800">
                            {t(
                              'settings.connectedAccounts.disconnectPendingTitle',
                            )}
                          </p>
                          <p className="mt-1 text-sm leading-6 text-amber-700">
                            {t(
                              'settings.connectedAccounts.disconnectPendingDescription',
                            )}
                          </p>
                        </div>
                      ) : null}

                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                          {getConnectedAccountProviderLabel(
                            account.provider,
                            t,
                          )}
                        </span>

                        {account.capabilities.map((capability) => (
                          <span
                            key={capability}
                            className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700"
                          >
                            {getConnectedAccountCapabilityLabel(capability, t)}
                          </span>
                        ))}
                      </div>

                      <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                        <div>
                          <dt className="font-medium text-slate-700">
                            {t('settings.connectedAccounts.user')}
                          </dt>
                          <dd className="mt-1 text-slate-500">
                            {account.user.name} | {account.user.email}
                          </dd>
                        </div>

                        <div>
                          <dt className="font-medium text-slate-700">
                            {t('settings.connectedAccounts.connectedAt')}
                          </dt>
                          <dd className="mt-1 text-slate-500">
                            {formatAccountDate(account.connectedAt)}
                          </dd>
                        </div>

                        <div>
                          <dt className="font-medium text-slate-700">
                            {t('settings.connectedAccounts.requestedAt')}
                          </dt>
                          <dd className="mt-1 text-slate-500">
                            {formatAccountDate(account.disconnectRequestedAt)}
                          </dd>
                        </div>

                        {isPendingDisconnect ? (
                          <div>
                            <dt className="font-medium text-slate-700">
                              {t('settings.connectedAccounts.requestedBy')}
                            </dt>
                            <dd className="mt-1 text-slate-500">
                              {account.user.name || account.user.email}
                            </dd>
                          </div>
                        ) : null}

                        <div>
                          <dt className="font-medium text-slate-700">
                            {t('settings.connectedAccounts.disconnectedAt')}
                          </dt>
                          <dd className="mt-1 text-slate-500">
                            {formatAccountDate(account.disconnectedAt)}
                          </dd>
                        </div>
                      </dl>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {canRequestOwnDisconnect ? (
                        <button
                          type="button"
                          onClick={() =>
                            void handleRequestDisconnect(account.id)
                          }
                          disabled={actionId === account.id}
                          className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {t('settings.connectedAccounts.requestDisconnect')}
                        </button>
                      ) : null}

                      {canDisconnectOwnAccount ? (
                        <button
                          type="button"
                          onClick={() => void handleDisconnect(account.id)}
                          disabled={actionId === account.id}
                          className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {t('settings.connectedAccounts.disconnectAccount')}
                        </button>
                      ) : null}

                      {canApprovePendingDisconnect ? (
                        <button
                          type="button"
                          onClick={() => void handleDisconnect(account.id)}
                          disabled={actionId === account.id}
                          className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {t('settings.connectedAccounts.approveDisconnect')}
                        </button>
                      ) : null}

                      {canAdminDisconnectOtherAccount ? (
                        <button
                          type="button"
                          onClick={() => void handleDisconnect(account.id)}
                          disabled={actionId === account.id}
                          className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {t('settings.connectedAccounts.adminDisconnect')}
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-5 border-t border-slate-100 pt-5">
                    <h4 className="text-sm font-semibold text-slate-800">
                      {t('settings.connectedAccounts.syncStates')}
                    </h4>

                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      {account.syncStates.map((syncState) => (
                        <div
                          key={syncState.id}
                          className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-slate-900">
                              {getConnectedAccountCapabilityLabel(
                                syncState.capability,
                                t,
                              )}
                            </p>

                            <span
                              className={`rounded-full border px-3 py-1 text-xs font-semibold ${getSyncStatusClass(
                                syncState.status,
                              )}`}
                            >
                              {getSyncStatusLabel(syncState.status, t)}
                            </span>
                          </div>

                          <dl className="mt-3 space-y-2 text-xs text-slate-500">
                            <div>
                              <dt className="font-medium text-slate-700">
                                {t('settings.connectedAccounts.syncFrom')}
                              </dt>
                              <dd>{formatAccountDate(syncState.syncFrom)}</dd>
                            </div>

                            <div>
                              <dt className="font-medium text-slate-700">
                                {t(
                                  'settings.connectedAccounts.lastSuccessfulSync',
                                )}
                              </dt>
                              <dd>
                                {formatAccountDate(
                                  syncState.lastSuccessfulSyncAt,
                                )}
                              </dd>
                            </div>
                          </dl>
                        </div>
                      ))}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function getErrorMessage(error: unknown, t: (key: string) => string) {
  if (error instanceof ApiClientError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return t('common.errors.unexpected');
}
