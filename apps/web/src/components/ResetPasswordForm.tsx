'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FormEvent, useMemo, useState } from 'react';

import { PublicLegalLinks } from '@/components/PublicLegalLinks';
import { useI18n } from '@/i18n/useI18n';
import { resetPassword } from '@/lib/api/auth';
import { ApiClientError } from '@/lib/api/core';

export function ResetPasswordForm() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get('token') ?? '', [searchParams]);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    token ? null : t('auth.recovery.missingToken'),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    if (!token) {
      setErrorMessage(t('auth.recovery.missingToken'));
      return;
    }

    if (newPassword.length < 8) {
      setErrorMessage(t('auth.recovery.passwordRequirements'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage(t('auth.recovery.passwordsDoNotMatch'));
      return;
    }

    setIsSubmitting(true);

    try {
      await resetPassword({ token, newPassword });
      setNewPassword('');
      setConfirmPassword('');
      setSuccessMessage(t('auth.recovery.success'));
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 400) {
        setErrorMessage(t('auth.recovery.invalidOrExpired'));
      } else {
        setErrorMessage(t('auth.recovery.resetFailed'));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
    >
      <div className="mb-8">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          {t('auth.product')}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          {t('auth.recovery.resetTitle')}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {t('auth.recovery.resetSubtitle')}
        </p>
      </div>

      <div className="space-y-5">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">
            {t('auth.recovery.newPassword')}
          </span>
          <input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
            minLength={8}
            disabled={!token || Boolean(successMessage)}
            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100"
            placeholder={t('common.forms.passwordPlaceholder')}
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">
            {t('auth.recovery.confirmPassword')}
          </span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            minLength={8}
            disabled={!token || Boolean(successMessage)}
            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100"
            placeholder={t('auth.recovery.confirmPasswordPlaceholder')}
          />
        </label>

        <p className="text-xs text-slate-500">
          {t('auth.recovery.passwordRequirements')}
        </p>

        {successMessage ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {successMessage}
          </div>
        ) : null}

        {errorMessage ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting || !token || Boolean(successMessage)}
          className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting
            ? t('auth.recovery.resetting')
            : t('auth.recovery.resetPassword')}
        </button>

        <Link
          href="/login"
          className="block text-center text-sm font-medium text-slate-700 underline-offset-4 transition hover:text-slate-950 hover:underline"
        >
          {t('auth.recovery.backToLogin')}
        </Link>

        <PublicLegalLinks />
      </div>
    </form>
  );
}
