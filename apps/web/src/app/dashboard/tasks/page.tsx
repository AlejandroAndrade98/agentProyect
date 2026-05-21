'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import { useAuth } from '@/hooks/useAuth';
import { ApiClientError, getTasks } from '@/lib/api-client';
import { priorityOptions, taskStatusOptions } from '@/lib/crm-options';
import { getPriorityClasses, getTaskStatusClasses } from '@/lib/crm-styles';
import { formatDate, formatEnumLabel } from '@/lib/formatters';
import { canCreateCrm } from '@/lib/permissions';
import type {
  PaginatedResponse,
  Priority,
  Task,
  TaskStatus,
} from '@/types/crm';

export default function TasksPage() {
  const { token, user } = useAuth();

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
          setErrorMessage('Could not load tasks.');
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

  const tasks = tasksResponse?.data ?? [];
  const meta = tasksResponse?.meta;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Tasks"
        description="Manage follow-ups, deadlines, and sales execution tasks."
        actions={
          canCreateCrm(user) ? (
            <Link
              href="/dashboard/tasks/new"
              className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
            >
              New task
            </Link>
          ) : null
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
            placeholder="Search by title or description..."
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
            <option value="">All statuses</option>
            {taskStatusOptions.map((status) => (
              <option key={status} value={status}>
                {formatEnumLabel(status)}
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
            <option value="">All priorities</option>
            {priorityOptions.map((priority) => (
              <option key={priority} value={priority}>
                {formatEnumLabel(priority)}
              </option>
            ))}
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

      {isLoading ? <LoadingSkeleton rows={6} /> : null}

      {!isLoading && errorMessage ? (
        <ErrorState message={errorMessage} />
      ) : null}

      {!isLoading && !errorMessage && tasks.length === 0 ? (
        <EmptyState
          title="No tasks found"
          description="Create your first task to start tracking execution."
        />
      ) : null}

      {!isLoading && !errorMessage && tasks.length > 0 ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Task
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Priority
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Due date
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Completed
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Action
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
                      <p className="mt-1 text-xs text-slate-500">
                        {task.description ?? 'No description'}
                      </p>
                    </td>

                    <td className="px-6 py-4">
                      <Badge className={getTaskStatusClasses(task.status)}>
                        {formatEnumLabel(task.status)}
                      </Badge>
                    </td>

                    <td className="px-6 py-4">
                      <Badge className={getPriorityClasses(task.priority)}>
                        {formatEnumLabel(task.priority)}
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
                Page {meta.page} of {meta.totalPages || 1} · {meta.total} tasks
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