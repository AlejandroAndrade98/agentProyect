'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { TaskForm } from '@/components/TaskForm';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/i18n/useI18n';
import {
  ApiClientError,
  getContacts,
  getLeads,
  getTaskById,
  updateTask,
} from '@/lib/api-client';
import type { Contact, CreateTaskInput, Lead, TaskDetail } from '@/types/crm';

function getTaskInitialValues(task: TaskDetail): CreateTaskInput {
  return {
    title: task.title,
    description: task.description ?? undefined,
    leadId: task.leadId ?? undefined,
    contactId: task.contactId ?? undefined,
    assignedToUserId: task.assignedToUserId ?? undefined,
    status: task.status,
    priority: task.priority,
    importanceLevel: task.importanceLevel,
    dueDate: task.dueDate ?? undefined,
  };
}

export default function EditTaskPage() {
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
  const [leads, setLeads] = useState<Lead[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      if (!token || !taskId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const [taskResponse, leadsResponse, contactsResponse] =
          await Promise.all([
            getTaskById(token, taskId),
            getLeads(token, {
              page: 1,
              pageSize: 100,
              sortBy: 'createdAt',
              sortOrder: 'desc',
            }),
            getContacts(token, {
              page: 1,
              pageSize: 100,
              sortBy: 'firstName',
              sortOrder: 'asc',
            }),
          ]);

        if (!isMounted) {
          return;
        }

        setTask(taskResponse);
        setLeads(leadsResponse.data);
        setContacts(contactsResponse.data);
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

    loadData();

    return () => {
      isMounted = false;
    };
  }, [token, taskId, t]);

  async function handleUpdateTask(values: CreateTaskInput) {
    if (!token || !taskId) {
      setErrorMessage(t('crm.common.sessionNotReady'));
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const updatedTask = await updateTask(token, taskId, values);
      router.push(`/dashboard/tasks/${updatedTask.id}`);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage(t('crm.tasks.updateFailed'));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-96 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    );
  }

  if (errorMessage && !task) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/tasks"
          className="text-sm font-medium text-blue-700 transition hover:text-blue-900"
        >
          ← {t('crm.common.backToTasks')}
        </Link>

        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {errorMessage}
        </div>
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
          href={`/dashboard/tasks/${task.id}`}
          className="text-sm font-medium text-blue-700 transition hover:text-blue-900"
        >
          ← {t('crm.common.backToTaskDetail')}
        </Link>

        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-blue-700">
            {t('crm.common.crmManagement')}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            {t('crm.tasks.edit')}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            {t('crm.tasks.editDescription')}
          </p>
        </div>
      </section>

      {errorMessage ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <TaskForm
        leads={leads}
        contacts={contacts}
        currentUser={user}
        initialValues={getTaskInitialValues(task)}
        submitLabel={t('crm.common.saveChanges')}
        isSubmitting={isSubmitting}
        onSubmit={handleUpdateTask}
      />
    </div>
  );
}
