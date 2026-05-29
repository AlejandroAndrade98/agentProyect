'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import { useAuth } from '@/hooks/useAuth';
import { ApiClientError, getTasks, moveTaskBoard } from '@/lib/api-client';
import { taskStatusOptions } from '@/lib/crm-options';
import { getPriorityClasses, getTaskStatusClasses } from '@/lib/crm-styles';
import { formatDate, formatEnumLabel } from '@/lib/formatters';
import { canCreateCrm } from '@/lib/permissions';
import type { Task, TaskStatus } from '@/types/crm';

type TasksByStatus = Record<TaskStatus, Task[]>;

function createEmptyTasksByStatus() {
  return taskStatusOptions.reduce((accumulator, status) => {
    accumulator[status] = [];

    return accumulator;
  }, {} as TasksByStatus);
}

function sortTasksForBoard(tasks: Task[]) {
  return [...tasks].sort((firstTask, secondTask) => {
    if (firstTask.boardPosition !== secondTask.boardPosition) {
      return firstTask.boardPosition - secondTask.boardPosition;
    }

    return (
      new Date(secondTask.updatedAt).getTime() -
      new Date(firstTask.updatedAt).getTime()
    );
  });
}

export default function TasksBoardPage() {
  const { token, user } = useAuth();

  const [tasksByStatus, setTasksByStatus] = useState<TasksByStatus>(() =>
    createEmptyTasksByStatus(),
  );
  const [movingTaskId, setMovingTaskId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadBoard = useCallback(async () => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const responses = await Promise.all(
        taskStatusOptions.map(async (status) => {
          const response = await getTasks(token, {
            page: 1,
            pageSize: 100,
            status,
            sortBy: 'updatedAt',
            sortOrder: 'desc',
          });

          return [status, sortTasksForBoard(response.data)] as const;
        }),
      );

      const nextTasksByStatus = createEmptyTasksByStatus();

      responses.forEach(([status, tasks]) => {
        nextTasksByStatus[status] = tasks;
      });

      setTasksByStatus(nextTasksByStatus);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Could not load tasks board.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  async function handleMoveTask(task: Task, nextStatus: TaskStatus) {
    if (!token || task.status === nextStatus) {
      return;
    }

    setMovingTaskId(task.id);
    setErrorMessage(null);

    try {
      await moveTaskBoard(token, task.id, {
        status: nextStatus,
      });

      await loadBoard();
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Could not move task.');
      }
    } finally {
      setMovingTaskId(null);
    }
  }

  const totalTasks = useMemo(
    () =>
      taskStatusOptions.reduce(
        (total, status) => total + tasksByStatus[status].length,
        0,
      ),
    [tasksByStatus],
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Tasks Board"
        description="Track execution work by status, due date, priority, and completion state."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/tasks/list"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              List view
            </Link>

            {canCreateCrm(user) ? (
              <Link
                href="/dashboard/tasks/new"
                className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
              >
                New task
              </Link>
            ) : null}
          </div>
        }
      />

      {isLoading ? <LoadingSkeleton rows={8} /> : null}

      {!isLoading && errorMessage ? (
        <ErrorState message={errorMessage} />
      ) : null}

      {!isLoading && !errorMessage && totalTasks === 0 ? (
        <EmptyState
          title="No tasks in board"
          description="Create tasks to start managing execution from the board."
        />
      ) : null}

      {!isLoading && !errorMessage && totalTasks > 0 ? (
        <section className="overflow-x-auto pb-3">
          <div className="grid min-w-[1200px] gap-4 xl:grid-cols-5">
            {taskStatusOptions.map((status) => {
              const tasks = tasksByStatus[status];

              return (
                <div
                  key={status}
                  className="flex min-h-[520px] flex-col rounded-2xl border border-slate-200 bg-slate-50"
                >
                  <div className="border-b border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <Badge className={getTaskStatusClasses(status)}>
                        {formatEnumLabel(status)}
                      </Badge>

                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200">
                        {tasks.length}
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 space-y-3 p-3">
                    {tasks.length > 0 ? (
                      tasks.map((task) => (
                        <article
                          key={task.id}
                          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                        >
                          <div className="space-y-3">
                            <div>
                              <Link
                                href={`/dashboard/tasks/${task.id}`}
                                className="font-medium text-slate-950 transition hover:text-blue-700"
                              >
                                {task.title}
                              </Link>

                              <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                                {task.description ?? 'No description'}
                              </p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <Badge
                                className={getPriorityClasses(task.priority)}
                              >
                                {formatEnumLabel(task.priority)}
                              </Badge>
                            </div>

                            <div className="space-y-1 text-xs text-slate-500">
                              <p>
                                Due:{' '}
                                <span className="font-medium text-slate-700">
                                  {formatDate(task.dueDate)}
                                </span>
                              </p>

                              <p>
                                Status since:{' '}
                                <span className="font-medium text-slate-700">
                                  {formatDate(task.statusChangedAt)}
                                </span>
                              </p>

                              <p>
                                Completed:{' '}
                                <span className="font-medium text-slate-700">
                                  {formatDate(task.completedAt)}
                                </span>
                              </p>

                              {task.lead ? (
                                <p>
                                  Lead:{' '}
                                  <span className="font-medium text-slate-700">
                                    {task.lead.title}
                                  </span>
                                </p>
                              ) : null}

                              {task.contact ? (
                                <p>
                                  Contact:{' '}
                                  <span className="font-medium text-slate-700">
                                    {task.contact.firstName}{' '}
                                    {task.contact.lastName}
                                  </span>
                                </p>
                              ) : null}
                            </div>

                            <div className="space-y-2">
                              <label className="text-xs font-medium text-slate-600">
                                Move to status
                              </label>

                              <select
                                value={task.status}
                                disabled={movingTaskId === task.id}
                                onChange={(event) =>
                                  handleMoveTask(
                                    task,
                                    event.target.value as TaskStatus,
                                  )
                                }
                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {taskStatusOptions.map((option) => (
                                  <option key={option} value={option}>
                                    {formatEnumLabel(option)}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <Link
                              href={`/dashboard/tasks/${task.id}`}
                              className="inline-flex text-xs font-medium text-blue-700 transition hover:text-blue-900"
                            >
                              View record
                            </Link>
                          </div>
                        </article>
                      ))
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-sm text-slate-500">
                        No tasks
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
