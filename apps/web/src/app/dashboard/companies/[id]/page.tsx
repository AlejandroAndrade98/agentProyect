'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ApiClientError, getCompanyById } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import type { CompanyDetail } from '@/types/crm';

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

function getImportanceClasses(value: CompanyDetail['importanceLevel']) {
  const classes: Record<CompanyDetail['importanceLevel'], string> = {
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

export default function CompanyDetailPage() {
  const params = useParams();
  const { token } = useAuth();

  const companyId =
    typeof params.id === 'string'
      ? params.id
      : Array.isArray(params.id)
        ? params.id[0]
        : '';

  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadCompany() {
      if (!token || !companyId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await getCompanyById(token, companyId, {
          include: 'contacts,leads,notes',
        });

        if (!isMounted) {
          return;
        }

        setCompany(response);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (error instanceof ApiClientError) {
          setErrorMessage(error.message);
        } else if (error instanceof Error) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage('Could not load company.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadCompany();

    return () => {
      isMounted = false;
    };
  }, [token, companyId]);

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
          href="/dashboard/companies"
          className="text-sm font-medium text-blue-700 transition hover:text-blue-900"
        >
          ← Back to companies
        </Link>

        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {errorMessage}
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/companies"
          className="text-sm font-medium text-blue-700 transition hover:text-blue-900"
        >
          ← Back to companies
        </Link>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-950">
            Company not found
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            The company may have been deleted or you may not have access.
          </p>
        </div>
      </div>
    );
  }

  const contacts = company.contacts ?? [];
  const leads = company.leads ?? [];
  const notes = company.linkedNotes ?? [];

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <Link
          href="/dashboard/companies"
          className="text-sm font-medium text-blue-700 transition hover:text-blue-900"
        >
          ← Back to companies
        </Link>

        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-blue-700">
              Company detail
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              {company.name}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Review account information, linked contacts, related leads, and
              notes for this company.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Edit
            </button>
            <button
              type="button"
              className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
            >
              New note
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-6 lg:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Website
            </p>
            {company.website ? (
              <a
                href={company.website}
                target="_blank"
                rel="noreferrer"
                className="mt-2 block break-all text-sm font-medium text-blue-700 hover:text-blue-900"
              >
                {company.website}
              </a>
            ) : (
              <p className="mt-2 text-sm text-slate-600">Not specified</p>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Industry
            </p>
            <p className="mt-2 text-sm text-slate-950">
              {company.industry ?? 'Not specified'}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Location
            </p>
            <p className="mt-2 text-sm text-slate-950">
              {[company.city, company.country].filter(Boolean).join(', ') ||
                'Not specified'}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Importance
            </p>
            <div className="mt-2">
              <Badge className={getImportanceClasses(company.importanceLevel)}>
                {formatEnumLabel(company.importanceLevel)}
              </Badge>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Source
            </p>
            <p className="mt-2 text-sm text-slate-950">
              {formatEnumLabel(company.source)}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Created
            </p>
            <p className="mt-2 text-sm text-slate-950">
              {formatDate(company.createdAt)}
            </p>
          </div>
        </div>

        {company.notes ? (
          <div className="mt-6 border-t border-slate-200 pt-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Notes
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              {company.notes}
            </p>
          </div>
        ) : null}
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-950">Contacts</h2>
            <span className="text-xs font-medium text-slate-500">
              {contacts.length}
            </span>
          </div>

          {contacts.length > 0 ? (
            <div className="space-y-3">
              {contacts.map((contact) => (
                <div
                  key={contact.id}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <p className="font-medium text-slate-950">
                    {contact.firstName} {contact.lastName}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {contact.email ?? 'No email'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {contact.phone ?? 'No phone'}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyRelatedState label="contacts" />
          )}
        </div>

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