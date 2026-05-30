'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/i18n/useI18n';

export function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const pathname = usePathname();

  const navGroups = [
    {
      label: t('navigation.groups.overview'),
      items: [
        {
          label: t('navigation.items.dashboard'),
          href: '/dashboard',
          enabled: true,
        },
      ],
    },
    {
      label: t('navigation.groups.ai'),
      items: [
        {
          label: t('navigation.items.aiWorkspace'),
          href: '/dashboard/ai-workspace',
          enabled: true,
        },
        {
          label: t('navigation.items.aiSuggestions'),
          href: '/dashboard/ai-suggestions',
          enabled: true,
        },
        {
          label: t('navigation.items.syncedEmails'),
          href: '/dashboard/external-sync/email-messages',
          enabled: true,
        },
        {
          label: t('navigation.items.syncedCalendar'),
          href: '/dashboard/external-sync/calendar-events',
          enabled: true,
        },
      ],
    },
    {
      label: t('navigation.groups.crmWork'),
      items: [
        {
          label: t('navigation.items.leads'),
          href: '/dashboard/leads',
          enabled: true,
        },
        {
          label: t('navigation.items.tasks'),
          href: '/dashboard/tasks',
          enabled: true,
        },
        {
          label: t('navigation.items.notes'),
          href: '/dashboard/notes',
          enabled: true,
        },
      ],
    },
    {
      label: t('navigation.groups.crmData'),
      items: [
        {
          label: t('navigation.items.companies'),
          href: '/dashboard/companies',
          enabled: true,
        },
        {
          label: t('navigation.items.contacts'),
          href: '/dashboard/contacts',
          enabled: true,
        },
        {
          label: t('navigation.items.products'),
          href: '/dashboard/products',
          enabled: true,
        },
      ],
    },
    {
      label: t('navigation.groups.system'),
      items: [
        {
          label: t('navigation.items.activity'),
          href: '/dashboard/activity',
          enabled: true,
        },
        ...(user?.role === 'SUPER_ADMIN'
          ? [
              {
                label: t('navigation.items.platform'),
                href: '/dashboard/platform/organizations',
                enabled: true,
              },
            ]
          : []),
        {
          label: t('navigation.items.settings'),
          href: '/dashboard/settings',
          enabled: true,
        },
      ],
    },
  ];

  function isActiveRoute(href: string) {
    return href === '/dashboard'
      ? pathname === '/dashboard'
      : pathname === href || pathname.startsWith(`${href}/`);
  }

  function handleLogout() {
    logout();
    router.replace('/login');
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <aside className="fixed inset-y-0 left-0 hidden w-72 flex-col border-r border-slate-800 bg-slate-950 px-6 py-6 text-white lg:flex">
        <div className="shrink-0">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-300">
            Sales AI
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Platform
          </h1>
        </div>

        <nav className="mt-8 flex-1 space-y-6 overflow-y-auto pb-4 pr-1">
          {navGroups.map((group) => (
            <section key={group.label}>
              <p className="px-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {group.label}
              </p>

              <div className="mt-2 space-y-1">
                {group.items.map((item) => {
                  const isActive = isActiveRoute(item.href);

                  if (!item.enabled) {
                    return (
                      <span
                        key={item.href}
                        className="block rounded-xl px-4 py-2.5 text-sm text-slate-500"
                      >
                        {item.label}
                      </span>
                    );
                  }

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`block rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                        isActive
                          ? 'bg-white/10 text-white'
                          : 'text-slate-400 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </nav>

        <div className="mt-4 shrink-0 rounded-2xl border border-white/10 bg-white/5 p-4">
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
              <p className="text-sm text-slate-500">
                {t('navigation.welcomeBack')}
              </p>
              <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                {user?.name ?? t('navigation.items.dashboard')}
              </h2>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              {t('common.actions.logout')}
            </button>
          </div>
        </header>

        <main className="px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
