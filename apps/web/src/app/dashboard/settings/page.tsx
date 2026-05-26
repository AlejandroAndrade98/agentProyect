'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';

import { PageHeader } from '@/components/ui/PageHeader';

export default function SettingsPage() {
  const { user } = useAuth();

  const canManageUsers =
  user?.role === 'SUPER_ADMIN' ||
  user?.role === 'OWNER' ||
  user?.role === 'ADMIN';

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        description="Manage account, organization, usage, appearance, and future workspace preferences."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Link
          href="/dashboard/settings/organization"
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-blue-200 hover:bg-blue-50/40"
        >
          <p className="text-sm font-medium text-blue-700">Workspace</p>
          <h2 className="mt-2 text-lg font-semibold text-slate-950">
            Organization
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Review and update your organization profile, billing contact,
            support contact, timezone, and locale.
          </p>
        </Link>

      {canManageUsers ? (
        <Link
          href="/dashboard/settings/users"
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-blue-200 hover:bg-blue-50/40"
        >
          <p className="text-sm font-medium text-blue-700">Access</p>
          <h2 className="mt-2 text-lg font-semibold text-slate-950">Users</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            View users in your organization and review roles, status, and access
            information.
          </p>
        </Link>
        ) : null}

        <Link
          href="/dashboard/settings/ai-usage"
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-blue-200 hover:bg-blue-50/40"
        >
          <p className="text-sm font-medium text-blue-700">AI Governance</p>
          <h2 className="mt-2 text-lg font-semibold text-slate-950">
            AI Usage
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Review personal usage, organization credits, limits, and AI usage
            history.
          </p>
        </Link>

        <Link
          href="/dashboard/settings/connected-accounts"
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-blue-200 hover:bg-blue-50/40"
        >
          <p className="text-sm font-medium text-blue-700">Integrations</p>
          <h2 className="mt-2 text-lg font-semibold text-slate-950">
            Connected Accounts
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Review Gmail, Outlook, email, and calendar connections prepared for future
            sync and AI review workflows.
          </p>
        </Link>

        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6">
          <p className="text-sm font-medium text-slate-500">Coming soon</p>
          <h2 className="mt-2 text-lg font-semibold text-slate-800">
            Appearance
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Dark mode and visual preferences will be added later.
          </p>
        </div>

        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6">
          <p className="text-sm font-medium text-slate-500">Coming soon</p>
          <h2 className="mt-2 text-lg font-semibold text-slate-800">
            Language
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Spanish and English workspace preferences will be added later.
          </p>
        </div>
      </div>
    </div>
  );
}