'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAuth } from '@/hooks/useAuth';
import { ApiClientError, deleteLead, getLeadById } from '@/lib/api-client';
import type { LeadDetail, LeadStatus, Priority } from '@/types/crm';

function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatDate(value: string | null) {
  if (!value) {
    return 'Not set';
  }

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function formatMoney(value: number | null) {
  if (value === null) {
    return 'Not set';
  }

  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function getPriorityClasses(value: Priority) {
  const classes: Record<Priority, string> = {
    LOW: 'bg-slate-100 text-slate-700 ring-slate-200',
    MEDIUM: 'bg-blue-50 text-blue-700 ring-blue-200',
    HIGH: 'bg-amber-50 text-amber-700 ring-amber-200',
    CRITICAL: 'bg-red-50 text-red-700 ring-red-200',
  };

  return classes[value];
}

function getStatusClasses(value: LeadStatus) {
  const classes: Record<LeadStatus, string> = {
    NEW: 'bg-slate-100 text-slate-700 ring-slate-200',
    CONTACTED: 'bg-blue-50 text-blue-700 ring-blue-200',
    MEETING_SCHEDULED: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
    PROPOSAL_SENT: 'bg-purple-50 text-purple-700 ring-purple-200',
    NEGOTIATION: 'bg-amber-50 text-amber-700 ring-amber-200',
    WON: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    LOST: 'bg-red-50 text-red-700 ring-red-200',
    ARCHIVED: 'bg-slate-100 text-slate-500 ring-slate-200',
  };

  return classes[value];
}

function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${className}`}
    >
      {children}
    </span>
  );
}

function EmptyRelatedState({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
      No {label} linked yet.
    </div>
  );
}

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { token, user } = useAuth();

  const leadId =
    typeof params.id === 'string'
      ? params.id
      : Array.isArray(params.id)
        ? params.id[0]
        : '';

  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadLead() {
      if (!token || !leadId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await getLeadById(token, leadId, {
          include: 'company,contact,assignedUser,tasks,notes',
        });

        if (!isMounted) {
          return;
        }

        setLead(response);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (error instanceof ApiClientError) {
          setErrorMessage(error.message);
        } else if (error instanceof Error) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage('Could not load lead.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadLead();

    return () => {
      isMounted = false;
    };
  }, [token, leadId]);

  const canDeleteLead =
    user?.role === 'SUPER_ADMIN' ||
    user?.role === 'OWNER' ||
    user?.role === 'ADMIN';

  async function handleDeleteLead() {
    if (!token || !leadId || !lead) {
      setErrorMessage('Your session is not ready. Please try again.');
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete "${lead.title}"? This action will remove it from active CRM views.`,
    );

    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setErrorMessage(null);

    try {
      await deleteLead(token, leadId);
      router.push('/dashboard/leads');
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Could not delete lead.');
      }
    } finally {
      setIsDeleting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-52 animate-pulse rounded-2xl bg-slate-100" />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-44 animate-pulse rounded-2xl bg-slate-100" />
          <div className="h-44 animate-pulse rounded-2xl bg-slate-100" />
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/leads"
          className="text-sm font-medium text-blue-700 transition hover:text-blue-900"
        >
          ← Back to leads
        </Link>

        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {errorMessage}
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/leads"
          className="text-sm font-medium text-blue-700 transition hover:text-blue-900"
        >
          ← Back to leads
        </Link>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-950">
            Lead not found
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            The lead may have been deleted or you may not have access.
          </p>
        </div>
      </div>
    );
  }

  const tasks = lead.tasks ?? [];
  const notes = lead.linkedNotes ?? [];

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <Link
          href="/dashboard/leads"
          className="text-sm font-medium text-blue-700 transition hover:text-blue-900"
        >
          ← Back to leads
        </Link>

        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-blue-700">
              Lead detail
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              {lead.title}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Review opportunity details, related CRM records, next steps,
              tasks, and notes.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/dashboard/leads/${lead.id}/edit`}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Edit
            </Link>

            {canDeleteLead ? (
              <button
                type="button"
                onClick={handleDeleteLead}
                disabled={isDeleting}
                className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-6 lg:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Status
            </p>
            <div className="mt-2">
              <Badge className={getStatusClasses(lead.status)}>
                {formatEnumLabel(lead.status)}
              </Badge>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Priority
            </p>
            <div className="mt-2">
              <Badge className={getPriorityClasses(lead.priority)}>
                {formatEnumLabel(lead.priority)}
              </Badge>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Budget
            </p>
            <p className="mt-2 text-sm text-slate-950">
              {formatMoney(lead.estimatedBudget)}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Company
            </p>
            {lead.company ? (
              <Link
                href={`/dashboard/companies/${lead.company.id}`}
                className="mt-2 block text-sm font-medium text-blue-700 hover:text-blue-900"
              >
                {lead.company.name}
              </Link>
            ) : (
              <p className="mt-2 text-sm text-slate-600">Not linked</p>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Contact
            </p>
            {lead.contact ? (
              <Link
                href={`/dashboard/contacts/${lead.contact.id}`}
                className="mt-2 block text-sm font-medium text-blue-700 hover:text-blue-900"
              >
                {lead.contact.firstName} {lead.contact.lastName}
              </Link>
            ) : (
              <p className="mt-2 text-sm text-slate-600">Not linked</p>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Assignee
            </p>
            <p className="mt-2 text-sm text-slate-950">
              {lead.user?.name ?? lead.user?.email ?? 'Not assigned'}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Expected close
            </p>
            <p className="mt-2 text-sm text-slate-950">
              {formatDate(lead.expectedCloseDate)}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Last contact
            </p>
            <p className="mt-2 text-sm text-slate-950">
              {formatDate(lead.lastContactAt)}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Source
            </p>
            <p className="mt-2 text-sm text-slate-950">
              {formatEnumLabel(lead.source)}
            </p>
          </div>
        </div>

        {lead.nextStep ? (
          <div className="mt-6 border-t border-slate-200 pt-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Next step
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              {lead.nextStep}
            </p>
          </div>
        ) : null}

        {lead.description ? (
          <div className="mt-6 border-t border-slate-200 pt-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Description
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              {lead.description}
            </p>
          </div>
        ) : null}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-950">Tasks</h2>
            <span className="text-xs font-medium text-slate-500">
              {tasks.length}
            </span>
          </div>

          {tasks.length > 0 ? (
            <div className="space-y-3">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <p className="font-medium text-slate-950">{task.title}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge className="bg-slate-100 text-slate-700 ring-slate-200">
                      {formatEnumLabel(task.status)}
                    </Badge>
                    <Badge className={getPriorityClasses(task.priority)}>
                      {formatEnumLabel(task.priority)}
                    </Badge>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    Created {formatDate(task.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyRelatedState label="tasks" />
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-950">Notes</h2>
            <span className="text-xs font-medium text-slate-500">
              {notes.length}
            </span>
          </div>

          {notes.length > 0 ? (
            <div className="space-y-3">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <p className="font-medium text-slate-950">
                    {note.title ?? 'Untitled note'}
                  </p>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">
                    {note.content}
                  </p>
                  <p className="mt-3 text-xs text-slate-500">
                    Created {formatDate(note.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyRelatedState label="notes" />
          )}
        </div>
      </section>
    </div>
  );
}