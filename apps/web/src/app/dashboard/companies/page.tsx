'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import { useAuth } from '@/hooks/useAuth';
import { getImportanceLabel } from '@/i18n/ai-display';
import { useI18n } from '@/i18n/useI18n';
import { ApiClientError, getCompanies } from '@/lib/api-client';
import { formatDate } from '@/lib/formatters';
import { canCreateCrm } from '@/lib/permissions';
import { getImportanceClasses } from '@/lib/crm-styles';
import type { Company, PaginatedResponse } from '@/types/crm';

export default function CompaniesPage() {
  const { token, user } = useAuth();
  const { t } = useI18n();

  const [companiesResponse, setCompaniesResponse] =
    useState<PaginatedResponse<Company> | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadCompanies() {
      if (!token) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await getCompanies(token, {
          page,
          pageSize: 10,
          search: submittedSearch || undefined,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        });

        if (!isMounted) {
          return;
        }

        setCompaniesResponse(response);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (error instanceof ApiClientError) {
          setErrorMessage(error.message);
        } else if (error instanceof Error) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage(t('crm.companies.loadFailed'));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadCompanies();

    return () => {
      isMounted = false;
    };
  }, [token, page, submittedSearch, t]);

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

  const companies = companiesResponse?.data ?? [];
  const meta = companiesResponse?.meta;

  return (
    <div className="space-y-8">
      <PageHeader
        title={t('crm.companies.title')}
        description={t('crm.companies.subtitle')}
        actions={
          canCreateCrm(user) ? (
            <Link
              href="/dashboard/companies/new"
              className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
            >
              {t('crm.companies.new')}
            </Link>
          ) : null
        }
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <form
          onSubmit={handleSearchSubmit}
          className="flex flex-col gap-3 md:flex-row md:items-center"
        >
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={t('crm.companies.searchPlaceholder')}
            className="min-h-11 flex-1 rounded-xl border border-slate-300 px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          />

          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-800"
            >
              {t('crm.common.search')}
            </button>

            {submittedSearch ? (
              <button
                type="button"
                onClick={handleClearSearch}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                {t('crm.common.clear')}
              </button>
            ) : null}
          </div>
        </form>
      </section>

      {isLoading ? <LoadingSkeleton rows={6} /> : null}

      {!isLoading && errorMessage ? (
        <ErrorState message={errorMessage} />
      ) : null}

      {!isLoading && !errorMessage && companies.length === 0 ? (
        <EmptyState
          title={t('crm.companies.noFound')}
          description={
            submittedSearch
              ? t('crm.common.tryChangingSearch')
              : t('crm.companies.empty')
          }
        />
      ) : null}

      {!isLoading && !errorMessage && companies.length > 0 ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t('crm.companies.name')}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t('crm.companies.industry')}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t('crm.common.location')}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t('crm.common.importance')}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t('crm.common.created')}
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t('crm.common.action')}
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {companies.map((company) => (
                  <tr key={company.id} className="transition hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-slate-950">
                          {company.name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {company.website ?? t('crm.common.noWebsite')}
                        </p>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-600">
                      {company.industry ?? t('crm.common.notSpecified')}
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-600">
                      {[company.city, company.country]
                        .filter(Boolean)
                        .join(', ') || t('crm.common.notSpecified')}
                    </td>

                    <td className="px-6 py-4">
                      <Badge
                        className={getImportanceClasses(
                          company.importanceLevel,
                        )}
                      >
                        {getImportanceLabel(company.importanceLevel, t)}
                      </Badge>
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-600">
                      {formatDate(company.createdAt)}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/dashboard/companies/${company.id}`}
                        className="text-sm font-medium text-blue-700 transition hover:text-blue-900"
                      >
                        {t('crm.common.view')}
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
                {t('crm.common.page')} {meta.page} {t('crm.common.of')}{' '}
                {meta.totalPages || 1} · {meta.total}{' '}
                {t('crm.companies.title')}
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!meta.hasPreviousPage}
                  onClick={() => setPage((currentPage) => currentPage - 1)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t('crm.common.previous')}
                </button>

                <button
                  type="button"
                  disabled={!meta.hasNextPage}
                  onClick={() => setPage((currentPage) => currentPage + 1)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t('crm.common.next')}
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
