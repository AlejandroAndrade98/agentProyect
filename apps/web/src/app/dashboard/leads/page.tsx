'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';

import { useAuth } from '@/hooks/useAuth';
import { ApiClientError, getLeads } from '@/lib/api-client';
import type {
  Lead,
  LeadStatus,
  PaginatedResponse,
  Priority,
} from '@/types/crm';

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

export default function LeadsPage() {
  const { token } = useAuth();

  const [leadsResponse, setLeadsResponse] =
    useState<PaginatedResponse<Lead> | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<LeadStatus | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<Priority | ''>('');
  const [page, setPage] = useState(1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadLeads() {
      if (!token) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await getLeads(token, {
          page,
          pageSize: 10,
          search: submittedSearch || undefined,
          status: statusFilter || undefined,
          priority: priorityFilter || undefined,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        });

        if (!isMounted) {
          return;
        }

        setLeadsResponse(response);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (error instanceof ApiClientError) {
          setErrorMessage(error.message);
        } else if (error instanceof Error) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage('Could not load leads.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadLeads();

    return () => {
      isMounted = false;
    };
  }, [token, page, submittedSearch, statusFilter, priorityFilter]);

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSubmittedSearch(searchInput.trim());
  }

  function handleClearFilters() {
    setSearchInput('');
    setSubmittedSearch('');
    setStatusFilter('');
    setPriorityFilter('');
    setPage(1);
  }

  const leads = leadsResponse?.data ?? [];
  const meta = leadsResponse?.meta;

  return (
    <div className="space-y-8">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-blue-700">
            CRM Management
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            Leads
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Manage commercial opportunities, track pipeline status, and keep
            next steps visible.
          </p>
        </div>

        <Link
          href="/dashboard/leads/new"
          className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
        >
          New lead
        </Link>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <form
          onSubmit={handleSearchSubmit}
          className="grid gap-3 lg:grid-cols-[1fr_180px_180px_auto]"
        >
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search by title, description, next step..."
            className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          />

          <select
            value={statusFilter}
            onChange={(event) => {
              setPage(1);
              setStatusFilter(event.target.value as LeadStatus | '');
            }}
            className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          >
            <option value="">All statuses</option>
            <option value="NEW">New</option>
            <option value="CONTACTED">Contacted</option>
            <option value="MEETING_SCHEDULED">Meeting Scheduled</option>
            <option value="PROPOSAL_SENT">Proposal Sent</option>
            <option value="NEGOTIATION">Negotiation</option>
            <option value="WON">Won</option>
            <option value="LOST">Lost</option>
            <option value="ARCHIVED">Archived</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(event) => {
              setPage(1);
              setPriorityFilter(event.target.value as Priority | '');
            }}
            className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          >
            <option value="">All priorities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>

          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-800"
            >
              Search
            </button>

            <button
              type="button"
              onClick={handleClearFilters}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Clear
            </button>
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

      {!isLoading && !errorMessage && leads.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">
            No leads found
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Create your first lead to start tracking an opportunity.
          </p>
        </div>
      ) : null}

      {!isLoading && !errorMessage && leads.length > 0 ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Lead
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Priority
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Budget
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Close date
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {leads.map((lead) => (
                  <tr key={lead.id} className="transition hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-950">
                        {lead.title}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {lead.nextStep ?? 'No next step'}
                      </p>
                    </td>

                    <td className="px-6 py-4">
                      <Badge className={getStatusClasses(lead.status)}>
                        {formatEnumLabel(lead.status)}
                      </Badge>
                    </td>

                    <td className="px-6 py-4">
                      <Badge className={getPriorityClasses(lead.priority)}>
                        {formatEnumLabel(lead.priority)}
                      </Badge>
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-600">
                      {formatMoney(lead.estimatedBudget)}
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-600">
                      {formatDate(lead.expectedCloseDate)}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/dashboard/leads/${lead.id}`}
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
                Page {meta.page} of {meta.totalPages || 1} · {meta.total} leads
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