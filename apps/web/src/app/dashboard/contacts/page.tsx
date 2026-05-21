'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';

import { useAuth } from '@/hooks/useAuth';
import { ApiClientError, getContacts } from '@/lib/api-client';
import type { Contact, PaginatedResponse } from '@/types/crm';

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

function getImportanceClasses(value: Contact['importanceLevel']) {
  const classes: Record<Contact['importanceLevel'], string> = {
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

export default function ContactsPage() {
  const { token } = useAuth();

  const [contactsResponse, setContactsResponse] =
    useState<PaginatedResponse<Contact> | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadContacts() {
      if (!token) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await getContacts(token, {
          page,
          pageSize: 10,
          search: submittedSearch || undefined,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        });

        if (!isMounted) {
          return;
        }

        setContactsResponse(response);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (error instanceof ApiClientError) {
          setErrorMessage(error.message);
        } else if (error instanceof Error) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage('Could not load contacts.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadContacts();

    return () => {
      isMounted = false;
    };
  }, [token, page, submittedSearch]);

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSubmittedSearch(searchInput.trim());
  }

  function handleClearSearch() {
    setSearchInput('');
    setSubmittedSearch('');
    setPage(1);
  }

  const contacts = contactsResponse?.data ?? [];
  const meta = contactsResponse?.meta;

  return (
    <div className="space-y-8">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-blue-700">
            CRM Management
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            Contacts
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Manage decision makers, stakeholders, and people related to your
            commercial pipeline.
          </p>
        </div>

        <Link
          href="/dashboard/contacts/new"
          className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
        >
          New contact
        </Link>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <form
          onSubmit={handleSearchSubmit}
          className="flex flex-col gap-3 md:flex-row md:items-center"
        >
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search by name, email, phone, job title, city..."
            className="min-h-11 flex-1 rounded-xl border border-slate-300 px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          />

          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-800"
            >
              Search
            </button>

            {submittedSearch ? (
              <button
                type="button"
                onClick={handleClearSearch}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Clear
              </button>
            ) : null}
          </div>
        </form>
      </section>

      {isLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-14 animate-pulse rounded-xl bg-slate-100"
              />
            ))}
          </div>
        </div>
      ) : null}

      {!isLoading && errorMessage ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {!isLoading && !errorMessage && contacts.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">
            No contacts found
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            {submittedSearch
              ? 'Try changing your search terms.'
              : 'Create your first contact to start building your CRM network.'}
          </p>
        </div>
      ) : null}

      {!isLoading && !errorMessage && contacts.length > 0 ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Contact
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Job title
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Location
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Importance
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Created
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {contacts.map((contact) => (
                  <tr key={contact.id} className="transition hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-slate-950">
                          {contact.firstName} {contact.lastName}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {contact.email ?? contact.phone ?? 'No contact info'}
                        </p>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-600">
                      {contact.jobTitle ?? 'Not specified'}
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-600">
                      {[contact.city, contact.country].filter(Boolean).join(', ') ||
                        'Not specified'}
                    </td>

                    <td className="px-6 py-4">
                      <Badge
                        className={getImportanceClasses(
                          contact.importanceLevel,
                        )}
                      >
                        {formatEnumLabel(contact.importanceLevel)}
                      </Badge>
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-600">
                      {formatDate(contact.createdAt)}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/dashboard/contacts/${contact.id}`}
                        className="text-sm font-medium text-blue-700 transition hover:text-blue-900"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {meta ? (
            <div className="flex flex-col gap-3 border-t border-slate-200 px-6 py-4 md:flex-row md:items-center md:justify-between">
              <p className="text-sm text-slate-600">
                Page {meta.page} of {meta.totalPages || 1} · {meta.total}{' '}
                contacts
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!meta.hasPreviousPage}
                  onClick={() => setPage((currentPage) => currentPage - 1)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>

                <button
                  type="button"
                  disabled={!meta.hasNextPage}
                  onClick={() => setPage((currentPage) => currentPage + 1)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}