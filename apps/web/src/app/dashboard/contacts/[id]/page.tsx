'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAuth } from '@/hooks/useAuth';
import {
  ApiClientError,
  deleteContact,
  getContactById,
} from '@/lib/api-client';
import type { ContactDetail, ImportanceLevel } from '@/types/crm';

function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function getImportanceClasses(value: ImportanceLevel) {
  const classes: Record<ImportanceLevel, string> = {
    LOW: 'bg-slate-100 text-slate-700 ring-slate-200',
    MEDIUM: 'bg-blue-50 text-blue-700 ring-blue-200',
    HIGH: 'bg-amber-50 text-amber-700 ring-amber-200',
    CRITICAL: 'bg-red-50 text-red-700 ring-red-200',
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

export default function ContactDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { token, user } = useAuth();

  const contactId =
    typeof params.id === 'string'
      ? params.id
      : Array.isArray(params.id)
        ? params.id[0]
        : '';

  const [contact, setContact] = useState<ContactDetail | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadContact() {
      if (!token || !contactId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await getContactById(token, contactId, {
          include: 'company,leads,tasks,notes',
        });

        if (!isMounted) {
          return;
        }

        setContact(response);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (error instanceof ApiClientError) {
          setErrorMessage(error.message);
        } else if (error instanceof Error) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage('Could not load contact.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadContact();

    return () => {
      isMounted = false;
    };
  }, [token, contactId]);

  const canDeleteContact =
    user?.role === 'SUPER_ADMIN' || user?.role === 'OWNER' || user?.role === 'ADMIN';

  async function handleDeleteContact() {
    if (!token || !contactId || !contact) {
      setErrorMessage('Your session is not ready. Please try again.');
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete "${contact.firstName} ${contact.lastName}"? This action will remove it from active CRM views.`,
    );

    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setErrorMessage(null);

    try {
      await deleteContact(token, contactId);
      router.push('/dashboard/contacts');
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Could not delete contact.');
      }
    } finally {
      setIsDeleting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="h-44 animate-pulse rounded-2xl bg-slate-100" />
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
          href="/dashboard/contacts"
          className="text-sm font-medium text-blue-700 transition hover:text-blue-900"
        >
          ← Back to contacts
        </Link>

        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {errorMessage}
        </div>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/contacts"
          className="text-sm font-medium text-blue-700 transition hover:text-blue-900"
        >
          ← Back to contacts
        </Link>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-950">
            Contact not found
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            The contact may have been deleted or you may not have access.
          </p>
        </div>
      </div>
    );
  }

  const leads = contact.leads ?? [];
  const tasks = contact.tasks ?? [];
  const notes = contact.linkedNotes ?? [];

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <Link
          href="/dashboard/contacts"
          className="text-sm font-medium text-blue-700 transition hover:text-blue-900"
        >
          ← Back to contacts
        </Link>

        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-blue-700">
              Contact detail
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              {contact.firstName} {contact.lastName}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Review stakeholder details, linked company, related leads, tasks,
              and notes.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/dashboard/contacts/${contact.id}/edit`}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Edit
            </Link>

            {canDeleteContact ? (
              <button
                type="button"
                onClick={handleDeleteContact}
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
              Email
            </p>
            <p className="mt-2 text-sm text-slate-950">
              {contact.email ?? 'Not specified'}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Phone
            </p>
            <p className="mt-2 text-sm text-slate-950">
              {contact.phone ?? 'Not specified'}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Company
            </p>
            {contact.company ? (
              <Link
                href={`/dashboard/companies/${contact.company.id}`}
                className="mt-2 block text-sm font-medium text-blue-700 hover:text-blue-900"
              >
                {contact.company.name}
              </Link>
            ) : (
              <p className="mt-2 text-sm text-slate-600">Not linked</p>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Job title
            </p>
            <p className="mt-2 text-sm text-slate-950">
              {contact.jobTitle ?? 'Not specified'}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Location
            </p>
            <p className="mt-2 text-sm text-slate-950">
              {[contact.city, contact.country].filter(Boolean).join(', ') ||
                'Not specified'}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Importance
            </p>
            <div className="mt-2">
              <Badge className={getImportanceClasses(contact.importanceLevel)}>
                {formatEnumLabel(contact.importanceLevel)}
              </Badge>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Source
            </p>
            <p className="mt-2 text-sm text-slate-950">
              {formatEnumLabel(contact.source)}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Created
            </p>
            <p className="mt-2 text-sm text-slate-950">
              {formatDate(contact.createdAt)}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              LinkedIn
            </p>
            {contact.linkedinUrl ? (
              <a
                href={contact.linkedinUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 block break-all text-sm font-medium text-blue-700 hover:text-blue-900"
              >
                {contact.linkedinUrl}
              </a>
            ) : (
              <p className="mt-2 text-sm text-slate-600">Not specified</p>
            )}
          </div>
        </div>

        {contact.expertise ? (
          <div className="mt-6 border-t border-slate-200 pt-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Expertise
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              {contact.expertise}
            </p>
          </div>
        ) : null}

        {contact.notes ? (
          <div className="mt-6 border-t border-slate-200 pt-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Notes
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              {contact.notes}
            </p>
          </div>
        ) : null}
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-950">Leads</h2>
            <span className="text-xs font-medium text-slate-500">
              {leads.length}
            </span>
          </div>

          {leads.length > 0 ? (
            <div className="space-y-3">
              {leads.map((lead) => (
                <div
                  key={lead.id}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <p className="font-medium text-slate-950">{lead.title}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge className="bg-slate-100 text-slate-700 ring-slate-200">
                      {formatEnumLabel(lead.status)}
                    </Badge>
                    <Badge className={getImportanceClasses(lead.priority)}>
                      {formatEnumLabel(lead.priority)}
                    </Badge>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    Created {formatDate(lead.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyRelatedState label="leads" />
          )}
        </div>

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
                    <Badge className={getImportanceClasses(task.priority)}>
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