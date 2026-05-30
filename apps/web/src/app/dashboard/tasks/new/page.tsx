'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { TaskForm } from '@/components/TaskForm';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/i18n/useI18n';
import {
  ApiClientError,
  createTask,
  getContacts,
  getLeads,
} from '@/lib/api-client';
import type { Contact, CreateTaskInput, Lead } from '@/types/crm';

export default function NewTaskPage() {
  const router = useRouter();
  const { token, user } = useAuth();
  const { t } = useI18n();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoadingRelations, setIsLoadingRelations] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadRelations() {
      if (!token) {
        setIsLoadingRelations(false);
        return;
      }

      try {
        const [leadsResponse, contactsResponse] = await Promise.all([
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
          setErrorMessage(t('crm.tasks.loadRelationsFailed'));
        }
      } finally {
        if (isMounted) {
          setIsLoadingRelations(false);
        }
      }
    }

    loadRelations();

    return () => {
      isMounted = false;
    };
  }, [token, t]);

  async function handleCreateTask(values: CreateTaskInput) {
    if (!token) {
      setErrorMessage(t('crm.common.sessionNotReady'));
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const task = await createTask(token, values);
      router.push(`/dashboard/tasks/${task.id}`);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage(t('crm.tasks.createFailed'));
      }
    } finally {
      setIsSubmitting(false);
    }
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

        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-blue-700">
            {t('crm.common.crmManagement')}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            {t('crm.tasks.new')}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            {t('crm.tasks.newDescription')}
          </p>
        </div>
      </section>

      {errorMessage ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {isLoadingRelations ? (
        <div className="h-96 animate-pulse rounded-2xl bg-slate-100" />
      ) : (
        <TaskForm
          leads={leads}
          contacts={contacts}
          currentUser={user}
          submitLabel={t('crm.common.createTask')}
          isSubmitting={isSubmitting}
          onSubmit={handleCreateTask}
        />
      )}
    </div>
  );
}
