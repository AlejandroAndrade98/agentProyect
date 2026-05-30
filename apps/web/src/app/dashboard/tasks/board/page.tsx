'use client';

import Link from 'next/link';
import type { DragEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import { useAuth } from '@/hooks/useAuth';
import { getPriorityLabel, getTaskStatusLabel } from '@/i18n/ai-display';
import { useI18n } from '@/i18n/useI18n';
import { ApiClientError, getTasks, moveTaskBoard } from '@/lib/api-client';
import { taskStatusOptions } from '@/lib/crm-options';
import { getPriorityClasses, getTaskStatusClasses } from '@/lib/crm-styles';
import { formatDate } from '@/lib/formatters';
import { canCreateCrm } from '@/lib/permissions';
import type { Task, TaskStatus } from '@/types/crm';

type TasksByStatus = Record<TaskStatus, Task[]>;
type TaskColumnPages = Record<TaskStatus, number>;

const BOARD_PAGE_SIZE = 5;

function createEmptyTasksByStatus() {
  return taskStatusOptions.reduce((accumulator, status) => {
    accumulator[status] = [];

    return accumulator;
  }, {} as TasksByStatus);
}

function createInitialTaskColumnPages() {
  return taskStatusOptions.reduce((accumulator, status) => {
    accumulator[status] = 1;

    return accumulator;
  }, {} as TaskColumnPages);
}

function getTaskColumnTotalPages(tasks: Task[]) {
  return Math.max(1, Math.ceil(tasks.length / BOARD_PAGE_SIZE));
}

function getVisibleTaskPage(tasks: Task[], page: number) {
  const startIndex = (page - 1) * BOARD_PAGE_SIZE;

  return tasks.slice(startIndex, startIndex + BOARD_PAGE_SIZE);
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
  const { t } = useI18n();

  const [tasksByStatus, setTasksByStatus] = useState<TasksByStatus>(() =>
    createEmptyTasksByStatus(),
  );
  const [columnPages, setColumnPages] = useState<TaskColumnPages>(() =>
    createInitialTaskColumnPages(),
  );
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<TaskStatus | null>(null);
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
        setErrorMessage(t('crm.tasks.loadBoardFailed'));
      }
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  useEffect(() => {
    setColumnPages((currentPages) => {
      const nextPages = { ...currentPages };

      taskStatusOptions.forEach((status) => {
        nextPages[status] = Math.min(
          nextPages[status],
          getTaskColumnTotalPages(tasksByStatus[status]),
        );
      });

      return nextPages;
    });
  }, [tasksByStatus]);

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
        setErrorMessage(t('crm.tasks.moveFailed'));
      }
    } finally {
      setMovingTaskId(null);
    }
  }

  function getTaskById(taskId: string) {
    for (const status of taskStatusOptions) {
      const task = tasksByStatus[status].find((item) => item.id === taskId);

      if (task) {
        return task;
      }
    }

    return null;
  }

  function handleTaskDragStart(
    event: DragEvent<HTMLElement>,
    task: Task,
  ) {
    setDraggedTaskId(task.id);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', task.id);
  }

  function handleColumnDragOver(
    event: DragEvent<HTMLDivElement>,
    status: TaskStatus,
  ) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverStatus(status);
  }

  function handleColumnDragLeave(event: DragEvent<HTMLDivElement>) {
    const relatedTarget = event.relatedTarget;

    if (
      !(relatedTarget instanceof Node) ||
      !event.currentTarget.contains(relatedTarget)
    ) {
      setDragOverStatus(null);
    }
  }

  function handleTaskDrop(
    event: DragEvent<HTMLDivElement>,
    nextStatus: TaskStatus,
  ) {
    event.preventDefault();
    const taskId = event.dataTransfer.getData('text/plain') || draggedTaskId;
    const task = taskId ? getTaskById(taskId) : null;

    setDraggedTaskId(null);
    setDragOverStatus(null);

    if (task) {
      void handleMoveTask(task, nextStatus);
    }
  }

  function handleTaskDragEnd() {
    setDraggedTaskId(null);
    setDragOverStatus(null);
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
        title={t('crm.tasks.boardTitle')}
        description={t('crm.tasks.subtitle')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/tasks/list"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              {t('common.actions.listView')}
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

      {isLoading ? <LoadingSkeleton rows={8} /> : null}

      {!isLoading && errorMessage ? (
        <ErrorState message={errorMessage} />
      ) : null}

      {!isLoading && !errorMessage && totalTasks === 0 ? (
        <EmptyState
          title={t('crm.tasks.noBoard')}
          description={t('crm.tasks.noBoardDescription')}
        />
      ) : null}

      {!isLoading && !errorMessage && totalTasks > 0 ? (
        <section className="overflow-x-auto pb-3">
          <div className="grid min-w-[1200px] gap-4 xl:grid-cols-5">
            {taskStatusOptions.map((status) => {
              const tasks = tasksByStatus[status];
              const currentPage = columnPages[status];
              const totalPages = getTaskColumnTotalPages(tasks);
              const visibleTasks = getVisibleTaskPage(tasks, currentPage);

              return (
                <div
                  key={status}
                  onDragOver={(event) => handleColumnDragOver(event, status)}
                  onDragLeave={handleColumnDragLeave}
                  onDrop={(event) => handleTaskDrop(event, status)}
                  className={`flex min-h-[520px] flex-col rounded-2xl border bg-slate-50 transition ${
                    dragOverStatus === status
                      ? 'border-blue-300 ring-4 ring-blue-100'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="border-b border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <Badge className={getTaskStatusClasses(status)}>
                        {getTaskStatusLabel(status, t)}
                      </Badge>

                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200">
                        {tasks.length}
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 space-y-3 p-3">
                    {visibleTasks.length > 0 ? (
                      visibleTasks.map((task) => (
                        <article
                          key={task.id}
                          draggable={movingTaskId !== task.id}
                          onDragStart={(event) =>
                            handleTaskDragStart(event, task)
                          }
                          onDragEnd={handleTaskDragEnd}
                          className={`cursor-grab rounded-2xl border bg-white p-4 shadow-sm transition active:cursor-grabbing ${
                            draggedTaskId === task.id || movingTaskId === task.id
                              ? 'border-blue-200 opacity-60'
                              : 'border-slate-200'
                          }`}
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
                                {task.description ??
                                  t('common.emptyStates.noDescription')}
                              </p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <Badge
                                className={getPriorityClasses(task.priority)}
                              >
                                {getPriorityLabel(task.priority, t)}
                              </Badge>
                            </div>

                            <div className="space-y-1 text-xs text-slate-500">
                              <p>
                                {t('crm.common.due')}:{' '}
                                <span className="font-medium text-slate-700">
                                  {formatDate(task.dueDate)}
                                </span>
                              </p>

                              <p>
                                {t('crm.common.statusSince')}:{' '}
                                <span className="font-medium text-slate-700">
                                  {formatDate(task.statusChangedAt)}
                                </span>
                              </p>

                              <p>
                                {t('crm.common.completed')}:{' '}
                                <span className="font-medium text-slate-700">
                                  {formatDate(task.completedAt)}
                                </span>
                              </p>

                              {task.lead ? (
                                <p>
                                  {t('crm.common.lead')}:{' '}
                                  <span className="font-medium text-slate-700">
                                    {task.lead.title}
                                  </span>
                                </p>
                              ) : null}

                              {task.contact ? (
                                <p>
                                  {t('crm.common.contact')}:{' '}
                                  <span className="font-medium text-slate-700">
                                    {task.contact.firstName}{' '}
                                    {task.contact.lastName}
                                  </span>
                                </p>
                              ) : null}
                            </div>

                            <div className="space-y-2">
                              <label className="text-xs font-medium text-slate-600">
                                {t('crm.common.moveToStatus')}
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
                                    {getTaskStatusLabel(option, t)}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <Link
                              href={`/dashboard/tasks/${task.id}`}
                              className="inline-flex text-xs font-medium text-blue-700 transition hover:text-blue-900"
                            >
                              {t('common.actions.viewRecord')}
                            </Link>
                          </div>
                        </article>
                      ))
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-sm text-slate-500">
                        {t('crm.tasks.noTasks')}
                      </div>
                    )}
                  </div>

                  <div className="border-t border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        disabled={currentPage <= 1}
                        onClick={() =>
                          setColumnPages((currentPages) => ({
                            ...currentPages,
                            [status]: currentPage - 1,
                          }))
                        }
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {t('common.pagination.previous')}
                      </button>

                      <span className="text-xs text-slate-500">
                        {t('common.pagination.page')} {currentPage}{' '}
                        {t('common.pagination.of')} {totalPages}
                      </span>

                      <button
                        type="button"
                        disabled={currentPage >= totalPages}
                        onClick={() =>
                          setColumnPages((currentPages) => ({
                            ...currentPages,
                            [status]: currentPage + 1,
                          }))
                        }
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {t('common.pagination.next')}
                      </button>
                    </div>
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
