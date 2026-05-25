'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import {
  ApiClientError,
  acceptOrganizationInvitation,
  getOrganizationInvitationPreview,
} from '@/lib/api-client';
import { formatDateTime, formatEnumLabel } from '@/lib/formatters';
import type {
  AcceptOrganizationInvitationResponse,
  OrganizationInvitationPreview,
} from '@/types/organization-settings';

export default function AcceptInvitationPage({
  params,
}: {
  params: { token: string };
}) {
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
        setLoadErrorMessage('Could not load invitation.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [params.token]);

  useEffect(() => {
    loadInvitation();
  }, [loadInvitation]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (form.password !== form.confirmPassword) {
    setFormErrorMessage('Passwords do not match.');
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
        setLoadErrorMessage('Could not accept invitation.');
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
            Sales AI Platform
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Accept invitation
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Create your account to join the invited organization.
          </p>
        </div>

        {isLoading ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">Loading invitation...</p>
          </section>
        ) : null}

        {!isLoading && loadErrorMessage ? (
          <section className="rounded-2xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-rose-900">
              Invitation unavailable
            </h2>
            <p className="mt-2 text-sm leading-6 text-rose-700">
              {loadErrorMessage}
            </p>

            <Link
              href="/login"
              className="mt-5 inline-flex rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Go to login
            </Link>
          </section>
        ) : null}

        {!isLoading && !loadErrorMessage && acceptedResult ? (
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-emerald-950">
              Invitation accepted
            </h2>
            <p className="mt-2 text-sm leading-6 text-emerald-800">
              Your account was created successfully for{' '}
              <span className="font-medium">
                {acceptedResult.organization.name}
              </span>
              .
            </p>

            <div className="mt-5 rounded-xl bg-white p-4 text-sm text-slate-700">
              <p>
                Email:{' '}
                <span className="font-medium">
                  {acceptedResult.user.email}
                </span>
              </p>
              <p>
                Role:{' '}
                <span className="font-medium">
                  {formatEnumLabel(acceptedResult.user.role)}
                </span>
              </p>
            </div>

            <Link
              href="/login"
              className="mt-5 inline-flex rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Go to login
            </Link>
          </section>
        ) : null}

        {!isLoading && !loadErrorMessage && invitation && !acceptedResult ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
              <p className="text-sm font-medium text-blue-900">
                Invitation details
              </p>

              <div className="mt-3 grid gap-2 text-sm text-blue-900">
                <p>
                  Organization:{' '}
                  <span className="font-medium">
                    {invitation.organization.name}
                  </span>
                </p>
                <p>
                  Email:{' '}
                  <span className="font-medium">{invitation.email}</span>
                </p>
                <p>
                  Role:{' '}
                  <span className="font-medium">
                    {formatEnumLabel(invitation.role)}
                  </span>
                </p>
                <p>
                  Expires:{' '}
                  <span className="font-medium">
                    {formatDateTime(invitation.expiresAt)}
                  </span>
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  Full name
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
                  placeholder="Your name"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  Password
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
                  placeholder="Minimum 8 characters"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  Confirm password
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
                  placeholder="Repeat password"
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
                {isSubmitting ? 'Accepting invitation...' : 'Accept invitation'}
              </button>
            </form>
          </section>
        ) : null}
      </div>
    </main>
  );
}