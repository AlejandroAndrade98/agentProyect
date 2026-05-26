'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { PageHeader } from '@/components/ui/PageHeader';
import { useAuth } from '@/hooks/useAuth';
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
} from '@/lib/permissions';
import type {
  ConnectedAccount,
  ConnectedAccountCapability,
  ConnectedAccountProvider,
} from '@/types/connected-accounts';
import { startGoogleOAuth } from '@/lib/api-client';


const providerOptions: ConnectedAccountProvider[] = ['GOOGLE', 'MICROSOFT'];
const capabilityOptions: ConnectedAccountCapability[] = ['EMAIL', 'CALENDAR'];

function formatDateTime(value: string | null) {
  if (!value) {
    return 'Not available';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
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

export default function ConnectedAccountsSettingsPage() {
  const { user, token } = useAuth();

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

  const currentUserAccount = useMemo(() => {
    if (!user) {
      return null;
    }

    return accounts.find((account) => account.userId === user.id) ?? null;
  }, [accounts, user]);

  const canShowDevConnectForm =
    Boolean(token) && canConnect && !currentUserAccount;

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
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

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

      setSuccessMessage('Development connected account created.');
      setEmail('');
      setDisplayName('');
      setCapabilities(['EMAIL', 'CALENDAR']);
      await loadAccounts();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
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
      setSuccessMessage('Disconnect requested.');
      await loadAccounts();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
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
      setSuccessMessage('Connected account disconnected.');
      await loadAccounts();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setActionId(null);
    }
  }

async function handleStartGoogleOAuth() {
  if (!token) {
    setErrorMessage('Missing access token');
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
    setErrorMessage(getErrorMessage(error));
  } finally {
    setIsStartingGoogleOAuth(false);
  }
}

  return (
    <div className="space-y-8">
      <PageHeader
        title="Connected Accounts"
        description="Manage Gmail, Outlook, email, and calendar account connections prepared for future secure sync and AI review workflows."
      />

      <section className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
        <p className="text-sm font-semibold text-blue-800">
          Foundation mode
        </p>
        <p className="mt-2 text-sm leading-6 text-blue-700">
          Real Google OAuth is now available for Gmail and Google Calendar connection.
          Email sync, calendar sync, AI email analysis, and email drafts are
          intentionally not implemented yet.
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

      {canShowDevConnectForm ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-blue-700">
                Real OAuth connection
              </p>
              <h2 className="mt-1 text-lg font-semibold text-slate-900">
                Connect Google account
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Connect Gmail and Google Calendar using the real Google OAuth flow.
                Email sync, calendar sync, AI analysis, and drafts are still pending.
              </p>
            </div>

            <button
              type="button"
              onClick={handleStartGoogleOAuth}
              disabled={isStartingGoogleOAuth}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isStartingGoogleOAuth ? 'Starting Google...' : 'Connect Google'}
            </button>
          </div>
        </section>
      ) : null}

      {canShowDevConnectForm ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <p className="text-sm font-medium text-blue-700">
              Development connection
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">
              Connect a simulated account
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              This creates a local development account only. It does not connect
              to Google or Microsoft yet.
            </p>
            <p className="mt-2 text-sm leading-6 text-blue-700">
              Real Google OAuth is now available for Gmail and Google Calendar connection.
              Email sync, calendar sync, AI email analysis, and email drafts are intentionally
              not implemented yet.
            </p>
          </div>

          <form
            onSubmit={handleDevConnect}
            className="mt-6 grid gap-4 md:grid-cols-2"
          >
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">
                Provider
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
                    {formatEnumLabel(option)}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">
                Email
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
                Display name
              </span>
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Work Gmail"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </label>

            <div className="space-y-3 md:col-span-2">
              <p className="text-sm font-medium text-slate-700">
                Capabilities
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
                    {formatEnumLabel(capability)}
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
                {isSubmitting ? 'Creating...' : 'Create dev connection'}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {currentUserAccount ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-semibold text-amber-800">
            One connected account per user
          </p>
          <p className="mt-2 text-sm leading-6 text-amber-700">
            Your user already has a connected account record. Reconnect and
            account replacement flows are intentionally deferred to a future
            phase.
          </p>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Accounts
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Connected accounts are scoped to your organization and user
              permissions.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadAccounts()}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Refresh
          </button>
        </div>

        {isLoading ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
            Loading connected accounts...
          </div>
        ) : accounts.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <h3 className="text-base font-semibold text-slate-900">
              No connected accounts yet
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              Create a development connection to validate the foundation.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {accounts.map((account) => {
              const canRequestDisconnect =
                canConnect &&
                !isFinalStatus(account.status) &&
                (canManage || account.userId === user?.id);

              const canDisconnect =
                canManage && !isFinalStatus(account.status);

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
                          {formatEnumLabel(account.status)}
                        </span>
                      </div>

                      <p className="mt-1 text-sm text-slate-500">
                        {account.email}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                          {formatEnumLabel(account.provider)}
                        </span>

                        {account.capabilities.map((capability) => (
                          <span
                            key={capability}
                            className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700"
                          >
                            {formatEnumLabel(capability)}
                          </span>
                        ))}
                      </div>

                      <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                        <div>
                          <dt className="font-medium text-slate-700">User</dt>
                          <dd className="mt-1 text-slate-500">
                            {account.user.name} · {account.user.email}
                          </dd>
                        </div>

                        <div>
                          <dt className="font-medium text-slate-700">
                            Connected at
                          </dt>
                          <dd className="mt-1 text-slate-500">
                            {formatDateTime(account.connectedAt)}
                          </dd>
                        </div>

                        <div>
                          <dt className="font-medium text-slate-700">
                            Disconnect requested
                          </dt>
                          <dd className="mt-1 text-slate-500">
                            {formatDateTime(account.disconnectRequestedAt)}
                          </dd>
                        </div>

                        <div>
                          <dt className="font-medium text-slate-700">
                            Disconnected at
                          </dt>
                          <dd className="mt-1 text-slate-500">
                            {formatDateTime(account.disconnectedAt)}
                          </dd>
                        </div>
                      </dl>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {canRequestDisconnect ? (
                        <button
                          type="button"
                          onClick={() =>
                            void handleRequestDisconnect(account.id)
                          }
                          disabled={actionId === account.id}
                          className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Request disconnect
                        </button>
                      ) : null}

                      {canDisconnect ? (
                        <button
                          type="button"
                          onClick={() => void handleDisconnect(account.id)}
                          disabled={actionId === account.id}
                          className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Admin disconnect
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-5 border-t border-slate-100 pt-5">
                    <h4 className="text-sm font-semibold text-slate-800">
                      Sync states
                    </h4>

                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      {account.syncStates.map((syncState) => (
                        <div
                          key={syncState.id}
                          className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-slate-900">
                              {formatEnumLabel(syncState.capability)}
                            </p>

                            <span
                              className={`rounded-full border px-3 py-1 text-xs font-semibold ${getSyncStatusClass(
                                syncState.status,
                              )}`}
                            >
                              {formatEnumLabel(syncState.status)}
                            </span>
                          </div>

                          <dl className="mt-3 space-y-2 text-xs text-slate-500">
                            <div>
                              <dt className="font-medium text-slate-700">
                                Sync from
                              </dt>
                              <dd>{formatDateTime(syncState.syncFrom)}</dd>
                            </div>

                            <div>
                              <dt className="font-medium text-slate-700">
                                Last successful sync
                              </dt>
                              <dd>
                                {formatDateTime(
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

function getErrorMessage(error: unknown) {
  if (error instanceof ApiClientError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Unexpected error';
}