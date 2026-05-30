'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { ErrorState } from '@/components/ui/ErrorState';
import { LongTextCard } from '@/components/ui/LongTextCard';
import { useAuth } from '@/hooks/useAuth';
import {
  getLeadStatusLabel,
  getPriorityLabel,
  getSourceLabel,
  getTaskStatusLabel,
} from '@/i18n/ai-display';
import { useI18n } from '@/i18n/useI18n';
import { ApiClientError, deleteLead, getLeadById } from '@/lib/api-client';
import { getLeadStatusClasses, getPriorityClasses } from '@/lib/crm-styles';
import { formatDate, formatMoney } from '@/lib/formatters';
import { canDeleteCrm } from '@/lib/permissions';
import type { LeadDetail } from '@/types/crm';

import { LeadAiSuggestionsPanel } from './LeadAiSuggestionsPanel';

function EmptyRelatedState({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
      {label}
    </div>
  );
}

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { token, user } = useAuth();
  const { t } = useI18n();

  const leadId =
    typeof params.id === 'string'
      ? params.id
      : Array.isArray(params.id)
        ? params.id[0]
        : '';

  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadLead() {
      if (!token || !leadId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await getLeadById(token, leadId, {
          include: 'company,contact,assignedUser,tasks,notes',
        });

        if (!isMounted) {
          return;
        }

        setLead(response);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (error instanceof ApiClientError) {
          setErrorMessage(error.message);
        } else if (error instanceof Error) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage(t('crm.leads.loadFailed'));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadLead();

    return () => {
      isMounted = false;
    };
  }, [token, leadId, t]);

  const canDeleteLead = canDeleteCrm(user);

  async function handleDeleteLead() {
    if (!token || !leadId || !lead) {
      setErrorMessage(t('crm.common.sessionNotReady'));
      return;
    }

    const confirmed = window.confirm(
      `${t('crm.leads.deleteConfirmPrefix')} "${lead.title}"? ${t(
        'crm.leads.deleteConfirmSuffix',
      )}`,
    );

    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setErrorMessage(null);

    try {
      await deleteLead(token, leadId);
      router.push('/dashboard/leads');
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage(t('crm.leads.deleteFailed'));
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
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-44 animate-pulse rounded-2xl bg-slate-100" />
          <div className="h-44 animate-pulse rounded-2xl bg-slate-100" />
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/leads"
          className="text-sm font-medium text-blue-700 transition hover:text-blue-900"
        >
          ← {t('crm.common.backToLeads')}
        </Link>

        <ErrorState message={errorMessage} />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/leads"
          className="text-sm font-medium text-blue-700 transition hover:text-blue-900"
        >
          ← {t('crm.common.backToLeads')}
        </Link>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-950">
            {t('crm.leads.notFound')}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {t('crm.leads.notFoundDescription')}
          </p>
        </div>
      </div>
    );
  }

  const tasks = lead.tasks ?? [];
  const notes = lead.linkedNotes ?? [];

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <Link
          href="/dashboard/leads"
          className="text-sm font-medium text-blue-700 transition hover:text-blue-900"
        >
          ← {t('crm.common.backToLeads')}
        </Link>

        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-blue-700">
              {t('crm.leads.detail')}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              {lead.title}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              {t('crm.leads.detailDescription')}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/dashboard/leads/${lead.id}/edit`}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              {t('common.actions.edit')}
            </Link>

                        <Link
              href={`/dashboard/notes/new?leadId=${lead.id}`}
              className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700 transition hover:bg-blue-100"
            >
              {t('crm.common.newNote')}
            </Link>

            <Link
              href={
                lead.contactId
                ? `/dashboard/tasks/new?leadId=${lead.id}&contactId=${lead.contactId}`
                : `/dashboard/tasks/new?leadId=${lead.id}`
              }
              className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700 transition hover:bg-blue-100"
            >
              {t('crm.common.newTask')}
            </Link>

            {canDeleteLead ? (
              <button
              type="button"
              onClick={handleDeleteLead}
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

      <LeadAiSuggestionsPanel leadId={lead.id} />
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-6 lg:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('crm.common.status')}
            </p>
            <div className="mt-2">
              <Badge className={getLeadStatusClasses(lead.status)}>
                {getLeadStatusLabel(lead.status, t)}
              </Badge>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('crm.common.priority')}
            </p>
            <div className="mt-2">
              <Badge className={getPriorityClasses(lead.priority)}>
                {getPriorityLabel(lead.priority, t)}
              </Badge>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('crm.common.budget')}
            </p>
            <p className="mt-2 text-sm text-slate-950">
              {formatMoney(lead.estimatedBudget)}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('crm.common.company')}
            </p>
            {lead.company ? (
              <Link
                href={`/dashboard/companies/${lead.company.id}`}
                className="mt-2 block text-sm font-medium text-blue-700 hover:text-blue-900"
              >
                {lead.company.name}
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
            {lead.contact ? (
              <Link
                href={`/dashboard/contacts/${lead.contact.id}`}
                className="mt-2 block text-sm font-medium text-blue-700 hover:text-blue-900"
              >
                {lead.contact.firstName} {lead.contact.lastName}
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
              {lead.user?.name ?? lead.user?.email ?? t('crm.common.notAssigned')}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('crm.common.expectedClose')}
            </p>
            <p className="mt-2 text-sm text-slate-950">
              {formatDate(lead.expectedCloseDate)}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('crm.common.lastContact')}
            </p>
            <p className="mt-2 text-sm text-slate-950">
              {formatDate(lead.lastContactAt)}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('crm.common.source')}
            </p>
            <div className="mt-2">
              {lead.source === 'AI_SUGGESTION' ? (
                <Badge className="border-blue-200 bg-blue-50 text-blue-700">
                  {getSourceLabel(lead.source, t)}
                </Badge>
              ) : (
                <p className="text-sm text-slate-950">
                  {getSourceLabel(lead.source, t)}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {lead.source === 'AI_SUGGESTION' ? (
        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
          <Badge className="border-blue-200 bg-white text-blue-700">
            {getSourceLabel(lead.source, t)}
          </Badge>
          <p className="mt-3 text-sm leading-6 text-blue-900">
            {t('crm.leads.aiSafety')}
          </p>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-2">
        <LongTextCard
          title={t('crm.common.nextStep')}
          content={lead.nextStep}
          emptyText={t('crm.leads.noNextStepRecorded')}
        />
        <LongTextCard
          title={t('crm.common.description')}
          content={lead.description}
          emptyText={t('crm.leads.noDescriptionRecorded')}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-950">
              {t('crm.common.tasks')}
            </h2>
            <span className="text-xs font-medium text-slate-500">
              {tasks.length}
            </span>
          </div>

          {tasks.length > 0 ? (
            <div className="space-y-3">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <p className="font-medium text-slate-950">{task.title}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge className="bg-slate-100 text-slate-700 ring-slate-200">
                      {getTaskStatusLabel(task.status, t)}
                    </Badge>
                    <Badge className={getPriorityClasses(task.priority)}>
                      {getPriorityLabel(task.priority, t)}
                    </Badge>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    {t('crm.common.createdAt').replace(
                      '{date}',
                      formatDate(task.createdAt),
                    )}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyRelatedState
              label={`${t('crm.common.noLinkedYetPrefix')} ${t(
                'crm.common.tasks',
              ).toLowerCase()} ${t('crm.common.noLinkedYetSuffix')}`}
            />
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-950">
              {t('crm.common.notes')}
            </h2>
            <span className="text-xs font-medium text-slate-500">
              {notes.length}
            </span>
          </div>

          {notes.length > 0 ? (
            <div className="space-y-3">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <p className="font-medium text-slate-950">
                    {note.title ?? t('crm.common.untitledNote')}
                  </p>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">
                    {note.content}
                  </p>
                  <p className="mt-3 text-xs text-slate-500">
                    {t('crm.common.createdAt').replace(
                      '{date}',
                      formatDate(note.createdAt),
                    )}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyRelatedState
              label={`${t('crm.common.noLinkedYetPrefix')} ${t(
                'crm.common.notes',
              ).toLowerCase()} ${t('crm.common.noLinkedYetSuffix')}`}
            />
          )}
        </div>
      </section>
    </div>
  );
}
