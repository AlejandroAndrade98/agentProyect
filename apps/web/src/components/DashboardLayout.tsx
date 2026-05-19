'use client';

import { useRouter } from 'next/navigation';

import { useAuth } from '@/hooks/useAuth';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, logout } = useAuth();

  function handleLogout() {
    logout();
    router.replace('/login');
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-slate-800 bg-slate-950 px-6 py-6 text-white lg:block">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-300">
            Sales AI
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Platform
          </h1>
        </div>

        <nav className="mt-10 space-y-2">
          <a
            href="/dashboard"
            className="block rounded-xl bg-white/10 px-4 py-3 text-sm font-medium text-white"
          >
            Dashboard
          </a>
          <span className="block rounded-xl px-4 py-3 text-sm text-slate-400">
            Companies
          </span>
          <span className="block rounded-xl px-4 py-3 text-sm text-slate-400">
            Contacts
          </span>
          <span className="block rounded-xl px-4 py-3 text-sm text-slate-400">
            Leads
          </span>
          <span className="block rounded-xl px-4 py-3 text-sm text-slate-400">
            Tasks
          </span>
        </nav>

        <div className="absolute bottom-6 left-6 right-6 rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm font-medium text-white">{user?.name}</p>
          <p className="mt-1 truncate text-xs text-slate-400">{user?.email}</p>
          <p className="mt-2 text-xs uppercase tracking-wide text-blue-300">
            {user?.role}
          </p>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 px-6 py-4 backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500">Welcome back</p>
              <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                {user?.name ?? 'Dashboard'}
              </h2>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Logout
            </button>
          </div>
        </header>

        <main className="px-6 py-8">{children}</main>
      </div>
    </div>
  );
}