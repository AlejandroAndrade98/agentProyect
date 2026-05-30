'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import { useAuth } from '@/hooks/useAuth';
import {
  getImportanceLabel,
  getSourceLabel,
  type Translate,
} from '@/i18n/ai-display';
import { useI18n } from '@/i18n/useI18n';
import { ApiClientError, getNotes } from '@/lib/api-client';
import { importanceOptions, sourceOptions } from '@/lib/crm-options';
import { getImportanceClasses } from '@/lib/crm-styles';
import { formatDate, truncateText } from '@/lib/formatters';
import { canCreateCrm } from '@/lib/permissions';
import type {
  ImportanceLevel,
  Note,
  PaginatedResponse,
  Source,
} from '@/types/crm';

function getLinkedLabel(note: Note, t: Translate) {
  if (note.leadId) return t('crm.common.lead');
  if (note.contactId) return t('crm.common.contact');
  if (note.companyId) return t('crm.common.company');

  return t('common.labels.unlinked');
}

export default function NotesListPage() {
  const { token, user } = useAuth();
  const { t } = useI18n();

  const [notesResponse, setNotesResponse] =
    useState<PaginatedResponse<Note> | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [importanceFilter, setImportanceFilter] = useState<
    ImportanceLevel | ''
  >('');
  const [sourceFilter, setSourceFilter] = useState<Source | ''>('');
  const [page, setPage] = useState(1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadNotes() {
      if (!token) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await getNotes(token, {
          page,
          pageSize: 10,
          search: submittedSearch || undefined,
          importanceLevel: importanceFilter || undefined,
          source: sourceFilter || undefined,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        });

        if (!isMounted) {
          return;
        }

        setNotesResponse(response);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (error instanceof ApiClientError) {
          setErrorMessage(error.message);
        } else if (error instanceof Error) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage(t('crm.notes.loadListFailed'));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadNotes();

    return () => {
      isMounted = false;
    };
  }, [token, page, submittedSearch, importanceFilter, sourceFilter, t]);

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSubmittedSearch(searchInput.trim());
  }

  function handleClearFilters() {
    setSearchInput('');
    setSubmittedSearch('');
    setImportanceFilter('');
    setSourceFilter('');
    setPage(1);
  }

  const notes = notesResponse?.data ?? [];
  const meta = notesResponse?.meta;

  return (
    <div className="space-y-8">
      <PageHeader
        title={t('crm.notes.title')}
        description={t('crm.notes.subtitle')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/notes/board"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              {t('common.actions.boardView')}
            </Link>

            {canCreateCrm(user) ? (
              <Link
                href="/dashboard/notes/new"
                className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
              >
                {t('crm.common.newNote')}
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
            placeholder={t('crm.notes.searchPlaceholder')}
            className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          />

          <select
            value={importanceFilter}
            onChange={(event) => {
              setPage(1);
              setImportanceFilter(event.target.value as ImportanceLevel | '');
            }}
            className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          >
            <option value="">{t('crm.notes.allImportance')}</option>
            {importanceOptions.map((importance) => (
              <option key={importance} value={importance}>
                {getImportanceLabel(importance, t)}
              </option>
            ))}
          </select>

          <select
            value={sourceFilter}
            onChange={(event) => {
              setPage(1);
              setSourceFilter(event.target.value as Source | '');
            }}
            className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          >
            <option value="">{t('crm.notes.allSources')}</option>
            {sourceOptions.map((source) => (
              <option key={source} value={source}>
                {getSourceLabel(source, t)}
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

      {!isLoading && !errorMessage && notes.length === 0 ? (
        <EmptyState
          title={t('crm.notes.noFound')}
          description={t('crm.notes.empty')}
        />
      ) : null}

      {!isLoading && !errorMessage && notes.length > 0 ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t('crm.common.note')}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t('crm.notes.linkedTo')}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t('crm.common.importance')}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t('crm.common.source')}
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
                {notes.map((note) => (
                  <tr key={note.id} className="transition hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-950">
                        {note.title ?? t('common.emptyStates.untitledNote')}
                      </p>
                      <p className="mt-1 max-w-xl text-xs leading-5 text-slate-500">
                        {truncateText(note.content, 160)}
                      </p>
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-600">
                      {getLinkedLabel(note, t)}
                    </td>

                    <td className="px-6 py-4">
                      <Badge
                        className={getImportanceClasses(note.importanceLevel)}
                      >
                        {getImportanceLabel(note.importanceLevel, t)}
                      </Badge>
                    </td>

                    <td className="px-6 py-4">
                      {note.source === 'AI_SUGGESTION' ? (
                        <Badge className="border-blue-200 bg-blue-50 text-blue-700">
                          {getSourceLabel(note.source, t)}
                        </Badge>
                      ) : (
                        <span className="text-sm text-slate-600">
                          {getSourceLabel(note.source, t)}
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-600">
                      {formatDate(note.createdAt)}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/dashboard/notes/${note.id}`}
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
                {meta.total} {t('crm.notes.total')}
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
