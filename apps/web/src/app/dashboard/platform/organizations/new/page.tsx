'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageHeader } from '@/components/ui/PageHeader';
import { useAuth } from '@/hooks/useAuth';
import {
  ApiClientError,
  onboardPlatformOrganization,
} from '@/lib/api-client';
import type {
  OnboardPlatformOrganizationInput,
  OnboardPlatformOrganizationResponse,
  OrganizationAccountType,
} from '@/types/platform';

function canViewPlatform(role?: string) {
  return role === 'SUPER_ADMIN';
}

function toOptionalString(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toOptionalNumber(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  return Number(trimmed);
}

function buildDefaultSlug(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export default function NewPlatformOrganizationPage() {
  const router = useRouter();
  const { token, user, isLoading } = useAuth();

  const [organizationName, setOrganizationName] = useState('');
  const [slug, setSlug] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [billingEmail, setBillingEmail] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [industry, setIndustry] = useState('');
  const [plan, setPlan] = useState('starter');
  const [accountType, setAccountType] =
    useState<OrganizationAccountType>('COMPANY');
  const [timezone, setTimezone] = useState('America/Bogota');
  const [locale, setLocale] = useState('es-CO');
  const [maxUsers, setMaxUsers] = useState('10');
  const [maxActiveLeads, setMaxActiveLeads] = useState('100');
  const [aiMonthlyCreditsLimit, setAiMonthlyCreditsLimit] =
    useState('5000000');
  const [
    aiDefaultUserMonthlyCreditsLimit,
    setAiDefaultUserMonthlyCreditsLimit,
  ] = useState('1000000');
  const [aiCreditsBalance, setAiCreditsBalance] = useState('5000000');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdOnboarding, setCreatedOnboarding] =
    useState<OnboardPlatformOrganizationResponse | null>(null);

  const acceptInvitationUrl = useMemo(() => {
    if (!createdOnboarding?.ownerInvitation.acceptanceToken) {
      return null;
    }

    return `/accept-invitation/${createdOnboarding.ownerInvitation.acceptanceToken}`;
  }, [createdOnboarding]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Platform"
          title="Create organization"
          description="Loading platform context..."
        />
      </div>
    );
  }

  if (!canViewPlatform(user?.role)) {
  return (
    <ErrorState message="Platform access required. Only super admins can create platform organizations." />
  );
}

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setCreatedOnboarding(null);

    const input: OnboardPlatformOrganizationInput = {
      organizationName: organizationName.trim(),
      slug: slug.trim().toLowerCase(),
      ownerEmail: ownerEmail.trim().toLowerCase(),
      billingEmail: toOptionalString(billingEmail)?.toLowerCase(),
      supportEmail: toOptionalString(supportEmail)?.toLowerCase(),
      industry: toOptionalString(industry),
      plan: toOptionalString(plan),
      accountType,
      status: 'TRIAL',
      timezone: toOptionalString(timezone),
      locale: toOptionalString(locale),
      maxUsers: toOptionalNumber(maxUsers),
      maxActiveLeads: toOptionalNumber(maxActiveLeads),
      aiMonthlyCreditsLimit: toOptionalNumber(aiMonthlyCreditsLimit),
      aiDefaultUserMonthlyCreditsLimit: toOptionalNumber(
        aiDefaultUserMonthlyCreditsLimit,
      ),
      aiCreditsBalance: toOptionalNumber(aiCreditsBalance),
    };

    try {
      const result = await onboardPlatformOrganization(token, input);
      setCreatedOnboarding(result);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Could not onboard organization.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleOrganizationNameChange(value: string) {
    setOrganizationName(value);

    if (!slug) {
      setSlug(buildDefaultSlug(value));
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Platform"
        title="Create organization"
        description="Create a new customer organization and generate the first OWNER invitation."
        actions={
          <Link
            href="/dashboard/platform/organizations"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Back to organizations
          </Link>
        }
      />

      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      {createdOnboarding ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-emerald-100 text-emerald-700 ring-emerald-200">
                  Created
                </Badge>
                <Badge className="bg-blue-100 text-blue-700 ring-blue-200">
                  Owner invitation pending
                </Badge>
              </div>

              <h2 className="text-lg font-semibold text-slate-950">
                {createdOnboarding.organization.name}
              </h2>

              <p className="text-sm text-slate-600">
                Owner invitation created for{' '}
                <span className="font-medium text-slate-900">
                  {createdOnboarding.ownerInvitation.email}
                </span>
                .
              </p>

              {acceptInvitationUrl ? (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium text-slate-700">
                    Development invitation link
                  </p>

                  <div className="rounded-xl border border-emerald-200 bg-white p-3 text-sm text-slate-700">
                    {acceptInvitationUrl}
                  </div>

                  <Link
                    href={acceptInvitationUrl}
                    className="inline-flex rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                  >
                    Open invitation
                  </Link>
                </div>
              ) : null}
            </div>

            <Link
              href={`/dashboard/platform/organizations/${createdOnboarding.organization.id}`}
              className="rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100"
            >
              View organization
            </Link>
          </div>
        </section>
      ) : null}

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="grid gap-5 lg:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Organization name
            <input
              value={organizationName}
              onChange={(event) =>
                handleOrganizationNameChange(event.target.value)
              }
              required
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              placeholder="Acme Sales"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Slug
            <input
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              required
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              placeholder="acme-sales"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Owner email
            <input
              value={ownerEmail}
              onChange={(event) => setOwnerEmail(event.target.value)}
              required
              type="email"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              placeholder="owner@acme.com"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Account type
            <select
              value={accountType}
              onChange={(event) =>
                setAccountType(event.target.value as OrganizationAccountType)
              }
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            >
              <option value="COMPANY">Company</option>
              <option value="INDIVIDUAL">Individual</option>
            </select>
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Billing email
            <input
              value={billingEmail}
              onChange={(event) => setBillingEmail(event.target.value)}
              type="email"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              placeholder="billing@acme.com"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Support email
            <input
              value={supportEmail}
              onChange={(event) => setSupportEmail(event.target.value)}
              type="email"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              placeholder="support@acme.com"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Industry
            <input
              value={industry}
              onChange={(event) => setIndustry(event.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              placeholder="Sales, consulting, agency..."
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Plan
            <input
              value={plan}
              onChange={(event) => setPlan(event.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              placeholder="starter"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Timezone
            <input
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Locale
            <input
              value={locale}
              onChange={(event) => setLocale(event.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Max users
            <input
              value={maxUsers}
              onChange={(event) => setMaxUsers(event.target.value)}
              type="number"
              min={1}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Max active leads
            <input
              value={maxActiveLeads}
              onChange={(event) => setMaxActiveLeads(event.target.value)}
              type="number"
              min={1}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            AI monthly credits limit
            <input
              value={aiMonthlyCreditsLimit}
              onChange={(event) =>
                setAiMonthlyCreditsLimit(event.target.value)
              }
              type="number"
              min={0}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Default user AI credits limit
            <input
              value={aiDefaultUserMonthlyCreditsLimit}
              onChange={(event) =>
                setAiDefaultUserMonthlyCreditsLimit(event.target.value)
              }
              type="number"
              min={0}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700 lg:col-span-2">
            AI credits balance
            <input
              value={aiCreditsBalance}
              onChange={(event) => setAiCreditsBalance(event.target.value)}
              type="number"
              min={0}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            />
          </label>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <Link
            href="/dashboard/platform/organizations"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-center text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </Link>

          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? 'Creating...' : 'Create organization'}
          </button>
        </div>
      </form>
    </div>
  );
}