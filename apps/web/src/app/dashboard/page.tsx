import Link from 'next/link';

import { DashboardOverview } from '@/components/DashboardOverview';

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-blue-700">
              Command Center
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              Dashboard
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Monitor what needs attention across CRM, AI, email, and calendar.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/ai-workspace"
              className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
            >
              AI Workspace
            </Link>
            <Link
              href="/dashboard/leads"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Lead Pipeline
            </Link>
            <Link
              href="/dashboard/tasks"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Tasks Board
            </Link>
          </div>
        </div>
      </section>

      <DashboardOverview />
    </div>
  );
}
