'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { ErrorState } from '@/components/ui/ErrorState';
import { LongTextCard } from '@/components/ui/LongTextCard';
import { useAuth } from '@/hooks/useAuth';
import {
  getImportanceLabel,
  getPriorityLabel,
  getTaskStatusLabel,
} from '@/i18n/ai-display';
import { useI18n } from '@/i18n/useI18n';
import { ApiClientError, deleteTask, getTaskById } from '@/lib/api-client';
import { getPriorityClasses, getTaskStatusClasses } from '@/lib/crm-styles';
import { formatDate } from '@/lib/formatters';
import { canDeleteCrm } from '@/lib/permissions';
import type { TaskDetail } from '@/types/crm';

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { token, user } = useAuth();
  const { t } = useI18n();

  const taskId =
    typeof params.id === 'string'
      ? params.id
      : Array.isArray(params.id)
        ? params.id[0]
        : '';

  const [task, setTask] = useState<TaskDetail | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadTask() {
      if (!token || !taskId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await getTaskById(token, taskId, {
          include: 'lead,contact,assignedUser',
        });

        if (!isMounted) {
          return;
        }

        setTask(response);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (error instanceof ApiClientError) {
          setErrorMessage(error.message);
        } else if (error instanceof Error) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage(t('crm.tasks.loadFailed'));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadTask();

    return () => {
      isMounted = false;
    };
  }, [token, taskId, t]);

  const canDeleteTask = canDeleteCrm(user);

  async function handleDeleteTask() {
    if (!token || !taskId || !task) {
      setErrorMessage(t('crm.common.sessionNotReady'));
      return;
    }

    const confirmed = window.confirm(
      `${t('crm.tasks.deleteConfirmPrefix')} "${task.title}"? ${t(
        'crm.tasks.deleteConfirmSuffix',
      )}`,
    );

    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setErrorMessage(null);

    try {
      await deleteTask(token, taskId);
      router.push('/dashboard/tasks');
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage(t('crm.tasks.deleteFailed'));
      }
    } finally {
      setIsDeleting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-52 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/tasks"
          className="text-sm font-medium text-blue-700 transition hover:text-blue-900"
        >
          ← {t('crm.common.backToTasks')}
        </Link>

        <ErrorState message={errorMessage} />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/tasks"
          className="text-sm font-medium text-blue-700 transition hover:text-blue-900"
        >
          ← {t('crm.common.backToTasks')}
        </Link>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-950">
            {t('crm.tasks.notFound')}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {t('crm.tasks.notFoundDescription')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <Link
          href="/dashboard/tasks"
          className="text-sm font-medium text-blue-700 transition hover:text-blue-900"
        >
          ← {t('crm.common.backToTasks')}
        </Link>

        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-blue-700">
              {t('crm.tasks.detail')}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              {task.title}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              {t('crm.tasks.detailDescription')}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/dashboard/tasks/${task.id}/edit`}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              {t('common.actions.edit')}
            </Link>

            {canDeleteTask ? (
              <button
                type="button"
                onClick={handleDeleteTask}
                disabled={isDeleting}
                className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeleting
                  ? t('crm.common.deleting')
                  : t('crm.common.delete')}
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-6 lg:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('crm.common.status')}
            </p>
            <div className="mt-2">
              <Badge className={getTaskStatusClasses(task.status)}>
                {getTaskStatusLabel(task.status, t)}
              </Badge>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('crm.common.priority')}
            </p>
            <div className="mt-2">
              <Badge className={getPriorityClasses(task.priority)}>
                {getPriorityLabel(task.priority, t)}
              </Badge>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('crm.common.importance')}
            </p>
            <div className="mt-2">
              <Badge className={getPriorityClasses(task.importanceLevel)}>
                {getImportanceLabel(task.importanceLevel, t)}
              </Badge>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('crm.common.lead')}
            </p>
            {task.lead ? (
              <Link
                href={`/dashboard/leads/${task.lead.id}`}
                className="mt-2 block text-sm font-medium text-blue-700 hover:text-blue-900"
              >
                {task.lead.title}
              </Link>
            ) : (
              <p className="mt-2 text-sm text-slate-600">
                {t('crm.common.notLinked')}
              </p>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('crm.common.contact')}
            </p>
            {task.contact ? (
              <Link
                href={`/dashboard/contacts/${task.contact.id}`}
                className="mt-2 block text-sm font-medium text-blue-700 hover:text-blue-900"
              >
                {task.contact.firstName} {task.contact.lastName}
              </Link>
            ) : (
              <p className="mt-2 text-sm text-slate-600">
                {t('crm.common.notLinked')}
              </p>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('crm.common.assignee')}
            </p>
            <p className="mt-2 text-sm text-slate-950">
              {task.user?.name ?? task.user?.email ?? t('crm.common.notAssigned')}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('crm.tasks.dueDate')}
            </p>
            <p className="mt-2 text-sm text-slate-950">
              {formatDate(task.dueDate)}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('crm.tasks.completedAt')}
            </p>
            <p className="mt-2 text-sm text-slate-950">
              {formatDate(task.completedAt)}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('crm.common.created')}
            </p>
            <p className="mt-2 text-sm text-slate-950">
              {formatDate(task.createdAt)}
            </p>
          </div>
        </div>

      </section>

      <LongTextCard
        title={t('crm.common.description')}
        content={task.description}
        emptyText={t('crm.tasks.noDescriptionRecorded')}
      />
    </div>
  );
}
