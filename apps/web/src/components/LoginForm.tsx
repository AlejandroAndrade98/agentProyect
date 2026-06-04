'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { ApiClientError } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/i18n/useI18n';
import { PublicLegalLinks } from '@/components/PublicLegalLinks';

export function LoginForm() {
  const router = useRouter();
  const { login, isLoading } = useAuth();
  const { t } = useI18n();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await login({
        email,
        password,
      });

      router.replace('/dashboard');
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage(t('common.errors.signInFailed'));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const submitDisabled = isSubmitting || isLoading;

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
          {t('auth.loginTitle')}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {t('auth.loginSubtitle')}
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

        <label className="block">
          <span className="text-sm font-medium text-slate-700">
            {t('auth.password')}
          </span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
            placeholder={t('common.forms.passwordPlaceholder')}
          />
        </label>

        <div className="text-right">
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-slate-700 underline-offset-4 transition hover:text-slate-950 hover:underline"
          >
            {t('auth.forgotPassword')}
          </Link>
        </div>

        {errorMessage ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={submitDisabled}
          className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? t('auth.signingIn') : t('auth.signIn')}
        </button>

        <PublicLegalLinks />
      </div>
    </form>
  );
}
