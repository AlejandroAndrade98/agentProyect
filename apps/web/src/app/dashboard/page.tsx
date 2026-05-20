import { DashboardOverview } from '@/components/DashboardOverview';

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm font-medium uppercase tracking-wide text-blue-700">
          CRM Overview
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Dashboard
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Monitor your commercial pipeline, tasks, and recent activity from one
          place.
        </p>
      </section>

      <DashboardOverview />
    </div>
  );
}