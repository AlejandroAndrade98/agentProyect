'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';

import { forgotPassword } from '@/lib/api/auth';
import { useI18n } from '@/i18n/useI18n';

export function ForgotPasswordForm() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccessMessage(null);
    setDevResetUrl(null);
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const response = await forgotPassword({ email });
      setSuccessMessage(t('auth.recovery.genericSuccess'));
      setDevResetUrl(response.devResetUrl ?? null);
    } catch {
      setErrorMessage(t('auth.recovery.requestFailed'));
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
          {t('auth.recovery.forgotTitle')}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {t('auth.recovery.forgotSubtitle')}
        </p>
      </div>

      <div className="space-y-5">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">
            {t('auth.email')}
          </span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
            placeholder={t('common.forms.emailPlaceholder')}
          />
        </label>

        {successMessage ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {successMessage}
          </div>
        ) : null}

        {devResetUrl ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <p className="font-medium">{t('auth.recovery.devResetLink')}</p>
            <Link
              href={devResetUrl}
              className="mt-2 block break-all underline underline-offset-4"
            >
              {devResetUrl}
            </Link>
          </div>
        ) : null}

        {errorMessage ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting
            ? t('auth.recovery.sending')
            : t('auth.recovery.sendResetLink')}
        </button>

        <Link
          href="/login"
          className="block text-center text-sm font-medium text-slate-700 underline-offset-4 transition hover:text-slate-950 hover:underline"
        >
          {t('auth.recovery.backToLogin')}
        </Link>
      </div>
    </form>
  );
}
