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
          Your authenticated dashboard shell is ready. In the next block, this
          page will load real CRM metrics, leads, tasks, and recent activity
          from the API.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {['Summary', 'Leads', 'Tasks', 'Recent activity'].map((item) => (
          <div
            key={item}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <p className="text-sm font-medium text-slate-500">{item}</p>
            <p className="mt-3 text-2xl font-semibold text-slate-950">
              Coming soon
            </p>
          </div>
        ))}
      </section>
    </div>
  );
}