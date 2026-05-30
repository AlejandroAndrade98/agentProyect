'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import {
  ApiClientError,
  acceptOrganizationInvitation,
  getOrganizationInvitationPreview,
} from '@/lib/api-client';
import { getOrganizationRoleLabel } from '@/i18n/ai-display';
import { useI18n } from '@/i18n/useI18n';
import { formatDateTime } from '@/lib/formatters';
import type {
  AcceptOrganizationInvitationResponse,
  OrganizationInvitationPreview,
} from '@/types/organization-settings';

export default function AcceptInvitationPage({
  params,
}: {
  params: { token: string };
}) {
  const { locale, t } = useI18n();
  const dateFormatOptions = {
    locale,
    fallback: t('common.emptyStates.notSet'),
    invalidFallback: t('common.errors.invalidDate'),
  };
  const [invitation, setInvitation] =
    useState<OrganizationInvitationPreview | null>(null);
  const [acceptedResult, setAcceptedResult] =
    useState<AcceptOrganizationInvitationResponse | null>(null);
  const [form, setForm] = useState({
    name: '',
    password: '',
    confirmPassword: '',
  });
  const [loadErrorMessage, setLoadErrorMessage] = useState<string | null>(null);
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadInvitation = useCallback(async () => {
    setIsLoading(true);
    setLoadErrorMessage(null);

    try {
      const response = await getOrganizationInvitationPreview(params.token);
      setInvitation(response);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setLoadErrorMessage(error.message);
      } else if (error instanceof Error) {
        setLoadErrorMessage(error.message);
      } else {
        setLoadErrorMessage(t('invitations.loadFailed'));
      }
    } finally {
      setIsLoading(false);
    }
  }, [params.token, t]);

  useEffect(() => {
    loadInvitation();
  }, [loadInvitation]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (form.password !== form.confirmPassword) {
    setFormErrorMessage(t('invitations.passwordMismatch'));
    return;
    }

    setIsSubmitting(true);
    setFormErrorMessage(null);

    try {
      const response = await acceptOrganizationInvitation({
        token: params.token,
        name: form.name,
        password: form.password,
      });

      setAcceptedResult(response);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setLoadErrorMessage(error.message);
      } else if (error instanceof Error) {
        setLoadErrorMessage(error.message);
      } else {
        setLoadErrorMessage(t('invitations.acceptFailed'));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-700">
            {t('invitations.product')}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            {t('invitations.title')}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {t('invitations.subtitle')}
          </p>
        </div>

        {isLoading ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">
              {t('invitations.loading')}
            </p>
          </section>
        ) : null}

        {!isLoading && loadErrorMessage ? (
          <section className="rounded-2xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-rose-900">
              {t('invitations.unavailable')}
            </h2>
            <p className="mt-2 text-sm leading-6 text-rose-700">
              {loadErrorMessage}
            </p>

            <Link
              href="/login"
              className="mt-5 inline-flex rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              {t('invitations.goToLogin')}
            </Link>
          </section>
        ) : null}

        {!isLoading && !loadErrorMessage && acceptedResult ? (
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-emerald-950">
              {t('invitations.accepted')}
            </h2>
            <p className="mt-2 text-sm leading-6 text-emerald-800">
              {t('invitations.acceptedDescription').replace(
                '{organization}',
                acceptedResult.organization.name,
              )}
            </p>

            <div className="mt-5 rounded-xl bg-white p-4 text-sm text-slate-700">
              <p>
                {t('invitations.email')}:{' '}
                <span className="font-medium">
                  {acceptedResult.user.email}
                </span>
              </p>
              <p>
                {t('invitations.role')}:{' '}
                <span className="font-medium">
                  {getOrganizationRoleLabel(acceptedResult.user.role, t)}
                </span>
              </p>
            </div>

            <Link
              href="/login"
              className="mt-5 inline-flex rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              {t('invitations.goToLogin')}
            </Link>
          </section>
        ) : null}

        {!isLoading && !loadErrorMessage && invitation && !acceptedResult ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
              <p className="text-sm font-medium text-blue-900">
                {t('invitations.details')}
              </p>

              <div className="mt-3 grid gap-2 text-sm text-blue-900">
                <p>
                  {t('invitations.organization')}:{' '}
                  <span className="font-medium">
                    {invitation.organization.name}
                  </span>
                </p>
                <p>
                  {t('invitations.email')}:{' '}
                  <span className="font-medium">{invitation.email}</span>
                </p>
                <p>
                  {t('invitations.role')}:{' '}
                  <span className="font-medium">
                    {getOrganizationRoleLabel(invitation.role, t)}
                  </span>
                </p>
                <p>
                  {t('invitations.expires')}:{' '}
                  <span className="font-medium">
                    {formatDateTime(invitation.expiresAt, dateFormatOptions)}
                  </span>
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  {t('invitations.fullName')}
                </span>
                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  required
                  minLength={2}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  placeholder={t('invitations.namePlaceholder')}
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  {t('invitations.password')}
                </span>
                <input
                  type="password"
                  value={form.password}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                  required
                  minLength={8}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  placeholder={t('invitations.passwordPlaceholder')}
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  {t('invitations.confirmPassword')}
                </span>
                <input
                  type="password"
                  value={form.confirmPassword}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      confirmPassword: event.target.value,
                    }))
                  }
                  required
                  minLength={8}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  placeholder={t('invitations.confirmPasswordPlaceholder')}
                />
              </label>
              
              {formErrorMessage ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800">
                    {formErrorMessage}
                </div>
                ) : null}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? t('invitations.accepting') : t('invitations.accept')}
              </button>
            </form>
          </section>
        ) : null}
      </div>
    </main>
  );
}
