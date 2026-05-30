'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import { useAuth } from '@/hooks/useAuth';
import { getLeadStatusLabel, getPriorityLabel, getSourceLabel } from '@/i18n/ai-display';
import { useI18n } from '@/i18n/useI18n';
import { ApiClientError, getLeads } from '@/lib/api-client';
import { leadStatusOptions, priorityOptions } from '@/lib/crm-options';
import { getLeadStatusClasses, getPriorityClasses } from '@/lib/crm-styles';
import {
  formatDate,
  formatMoney,
  truncateText,
} from '@/lib/formatters';
import { canCreateCrm } from '@/lib/permissions';
import type {
  Lead,
  LeadStatus,
  PaginatedResponse,
  Priority,
} from '@/types/crm';

export default function LeadsListPage() {
  const { token, user } = useAuth();
  const { t } = useI18n();

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
          setErrorMessage(t('crm.leads.loadListFailed'));
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
  }, [token, page, submittedSearch, statusFilter, priorityFilter, t]);

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
      <PageHeader
        title={t('crm.leads.title')}
        description={t('crm.leads.subtitle')}
        actions={
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/leads/pipeline"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            {t('common.actions.boardView')}
          </Link>

          {canCreateCrm(user) ? (
            <Link
              href="/dashboard/leads/new"
              className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
            >
              {t('crm.common.newLead')}
            </Link>
          ) : null}
        </div>
      }
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <form
          onSubmit={handleSearchSubmit}
          className="grid gap-3 lg:grid-cols-[1fr_180px_180px_auto]"
        >
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={t('crm.leads.searchPlaceholder')}
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
            <option value="">{t('crm.common.allStatuses')}</option>
            {leadStatusOptions.map((status) => (
              <option key={status} value={status}>
                {getLeadStatusLabel(status, t)}
              </option>
            ))}
          </select>

          <select
            value={priorityFilter}
            onChange={(event) => {
              setPage(1);
              setPriorityFilter(event.target.value as Priority | '');
            }}
            className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          >
            <option value="">{t('crm.common.allPriorities')}</option>
            {priorityOptions.map((priority) => (
              <option key={priority} value={priority}>
                {getPriorityLabel(priority, t)}
              </option>
            ))}
          </select>

          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-800"
            >
              {t('common.actions.search')}
            </button>

            <button
              type="button"
              onClick={handleClearFilters}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              {t('common.actions.clear')}
            </button>
          </div>
        </form>
      </section>

      {isLoading ? <LoadingSkeleton rows={6} /> : null}

      {!isLoading && errorMessage ? (
        <ErrorState message={errorMessage} />
      ) : null}

      {!isLoading && !errorMessage && leads.length === 0 ? (
        <EmptyState
          title={t('crm.leads.noFound')}
          description={t('crm.leads.empty')}
        />
      ) : null}

      {!isLoading && !errorMessage && leads.length > 0 ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t('crm.common.lead')}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t('crm.common.status')}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t('crm.common.priority')}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t('crm.common.budget')}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t('crm.common.closeDate')}
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t('crm.common.action')}
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {leads.map((lead) => (
                  <tr key={lead.id} className="transition hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-slate-950">
                          {lead.title}
                        </p>
                        {lead.source === 'AI_SUGGESTION' ? (
                          <Badge className="border-blue-200 bg-blue-50 text-blue-700">
                            {getSourceLabel(lead.source, t)}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 max-w-xl text-xs leading-5 text-slate-500">
                        {truncateText(lead.nextStep ?? lead.description, 160) ||
                          t('crm.common.noNextStep')}
                      </p>
                    </td>

                    <td className="px-6 py-4">
                      <Badge className={getLeadStatusClasses(lead.status)}>
                        {getLeadStatusLabel(lead.status, t)}
                      </Badge>
                    </td>

                    <td className="px-6 py-4">
                      <Badge className={getPriorityClasses(lead.priority)}>
                        {getPriorityLabel(lead.priority, t)}
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
                        {t('common.actions.view')}
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
                {t('common.pagination.page')} {meta.page}{' '}
                {t('common.pagination.of')} {meta.totalPages || 1} ·{' '}
                {meta.total} {t('crm.leads.total')}
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!meta.hasPreviousPage}
                  onClick={() => setPage((currentPage) => currentPage - 1)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t('common.pagination.previous')}
                </button>

                <button
                  type="button"
                  disabled={!meta.hasNextPage}
                  onClick={() => setPage((currentPage) => currentPage + 1)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t('common.pagination.next')}
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
