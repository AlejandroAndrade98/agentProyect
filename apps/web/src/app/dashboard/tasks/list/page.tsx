'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import { useAuth } from '@/hooks/useAuth';
import { getPriorityLabel, getTaskStatusLabel } from '@/i18n/ai-display';
import { useI18n } from '@/i18n/useI18n';
import { ApiClientError, getTasks } from '@/lib/api-client';
import { priorityOptions, taskStatusOptions } from '@/lib/crm-options';
import { getPriorityClasses, getTaskStatusClasses } from '@/lib/crm-styles';
import { formatDate, truncateText } from '@/lib/formatters';
import { canCreateCrm } from '@/lib/permissions';
import type {
  PaginatedResponse,
  Priority,
  Task,
  TaskStatus,
} from '@/types/crm';

export default function TasksListPage() {
  const { token, user } = useAuth();
  const { t } = useI18n();

  const [tasksResponse, setTasksResponse] =
    useState<PaginatedResponse<Task> | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<Priority | ''>('');
  const [page, setPage] = useState(1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadTasks() {
      if (!token) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await getTasks(token, {
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

        setTasksResponse(response);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (error instanceof ApiClientError) {
          setErrorMessage(error.message);
        } else if (error instanceof Error) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage(t('crm.tasks.loadListFailed'));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadTasks();

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

  const tasks = tasksResponse?.data ?? [];
  const meta = tasksResponse?.meta;

  return (
    <div className="space-y-8">
      <PageHeader
        title={t('crm.tasks.title')}
        description={t('crm.tasks.listSubtitle')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/tasks/board"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              {t('common.actions.boardView')}
            </Link>

            {canCreateCrm(user) ? (
              <Link
                href="/dashboard/tasks/new"
                className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
              >
                {t('crm.common.newTask')}
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
            placeholder={t('crm.tasks.searchPlaceholder')}
            className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          />

          <select
            value={statusFilter}
            onChange={(event) => {
              setPage(1);
              setStatusFilter(event.target.value as TaskStatus | '');
            }}
            className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          >
            <option value="">{t('crm.common.allStatuses')}</option>
            {taskStatusOptions.map((status) => (
              <option key={status} value={status}>
                {getTaskStatusLabel(status, t)}
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

      {!isLoading && !errorMessage && tasks.length === 0 ? (
        <EmptyState
          title={t('crm.tasks.noFound')}
          description={t('crm.tasks.empty')}
        />
      ) : null}

      {!isLoading && !errorMessage && tasks.length > 0 ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t('crm.common.task')}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t('crm.common.status')}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t('crm.common.priority')}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t('crm.tasks.dueDate')}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t('crm.common.completed')}
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t('crm.common.action')}
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {tasks.map((task) => (
                  <tr key={task.id} className="transition hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-950">
                        {task.title}
                      </p>
                      <p className="mt-1 max-w-xl text-xs leading-5 text-slate-500">
                        {truncateText(task.description, 160) ||
                          t('common.emptyStates.noDescription')}
                      </p>
                    </td>

                    <td className="px-6 py-4">
                      <Badge className={getTaskStatusClasses(task.status)}>
                        {getTaskStatusLabel(task.status, t)}
                      </Badge>
                    </td>

                    <td className="px-6 py-4">
                      <Badge className={getPriorityClasses(task.priority)}>
                        {getPriorityLabel(task.priority, t)}
                      </Badge>
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-600">
                      {formatDate(task.dueDate)}
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-600">
                      {formatDate(task.completedAt)}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/dashboard/tasks/${task.id}`}
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
                {meta.total} {t('crm.tasks.total')}
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
