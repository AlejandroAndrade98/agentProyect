'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import { useAuth } from '@/hooks/useAuth';
import {
  getActivityTypeLabel,
  getEntityTypeLabel,
  getSourceLabel,
} from '@/i18n/ai-display';
import { useI18n } from '@/i18n/useI18n';
import { ApiClientError, getActivityEvents } from '@/lib/api-client';
import { formatDateTime } from '@/lib/formatters';
import type {
  ActivityEntityType,
  ActivityEvent,
  ActivityEventType,
} from '@/types/activity';
import type { PaginatedResponse } from '@/types/crm';

const activityTypeOptions: ActivityEventType[] = [
  'COMPANY_CREATED',
  'CONTACT_CREATED',
  'LEAD_CREATED',
  'TASK_CREATED',
  'NOTE_CREATED',
  'TASK_COMPLETED',
  'LEAD_STATUS_CHANGED',
  'LEAD_PRIORITY_CHANGED',
  'TASK_STATUS_CHANGED',
  'TASK_ASSIGNED',
];

const entityTypeOptions: ActivityEntityType[] = [
  'COMPANY',
  'CONTACT',
  'LEAD',
  'TASK',
  'NOTE',
];

function getActivityTypeClasses(type: ActivityEventType) {
  if (type.includes('CREATED')) {
    return 'bg-blue-50 text-blue-700 ring-blue-200';
  }

  if (type.includes('COMPLETED')) {
    return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  }

  if (type.includes('STATUS')) {
    return 'bg-purple-50 text-purple-700 ring-purple-200';
  }

  if (type.includes('PRIORITY')) {
    return 'bg-amber-50 text-amber-700 ring-amber-200';
  }

  if (type.includes('ASSIGNED')) {
    return 'bg-indigo-50 text-indigo-700 ring-indigo-200';
  }

  return 'bg-slate-100 text-slate-700 ring-slate-200';
}

function getEntityHref(event: ActivityEvent) {
  if (event.entityType === 'COMPANY') {
    return `/dashboard/companies/${event.entityId}`;
  }

  if (event.entityType === 'CONTACT') {
    return `/dashboard/contacts/${event.entityId}`;
  }

  if (event.entityType === 'LEAD') {
    return `/dashboard/leads/${event.entityId}`;
  }

  if (event.entityType === 'TASK') {
    return `/dashboard/tasks/${event.entityId}`;
  }

  if (event.entityType === 'NOTE') {
    return `/dashboard/notes/${event.entityId}`;
  }

  return null;
}

function getActorLabel(event: ActivityEvent, systemLabel: string) {
  const actor = event.actor ?? event.actorUser;

  return actor?.name ?? actor?.email ?? systemLabel;
}

export default function ActivityPage() {
  const { token } = useAuth();
  const { t } = useI18n();

  const [activityResponse, setActivityResponse] =
    useState<PaginatedResponse<ActivityEvent> | null>(null);
  const [typeFilter, setTypeFilter] = useState<ActivityEventType | ''>('');
  const [entityTypeFilter, setEntityTypeFilter] = useState<
    ActivityEntityType | ''
  >('');
  const [page, setPage] = useState(1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadActivity() {
      if (!token) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await getActivityEvents(token, {
          page,
          pageSize: 15,
          type: typeFilter || undefined,
          entityType: entityTypeFilter || undefined,
          sortOrder: 'desc',
        });

        if (!isMounted) {
          return;
        }

        setActivityResponse(response);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (error instanceof ApiClientError) {
          setErrorMessage(error.message);
        } else if (error instanceof Error) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage(t('crm.activity.loadFailed'));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadActivity();

    return () => {
      isMounted = false;
    };
  }, [token, page, typeFilter, entityTypeFilter, t]);

  function handleClearFilters() {
    setTypeFilter('');
    setEntityTypeFilter('');
    setPage(1);
  }

  const events = activityResponse?.data ?? [];
  const meta = activityResponse?.meta;

  return (
    <div className="space-y-8">
      <PageHeader
        title={t('crm.activity.title')}
        description={t('crm.activity.subtitle')}
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[220px_180px_auto]">
          <select
            value={typeFilter}
            onChange={(event) => {
              setPage(1);
              setTypeFilter(event.target.value as ActivityEventType | '');
            }}
            className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          >
            <option value="">{t('crm.activity.allTypes')}</option>
            {activityTypeOptions.map((type) => (
              <option key={type} value={type}>
                {getActivityTypeLabel(type, t)}
              </option>
            ))}
          </select>

          <select
            value={entityTypeFilter}
            onChange={(event) => {
              setPage(1);
              setEntityTypeFilter(
                event.target.value as ActivityEntityType | '',
              );
            }}
            className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          >
            <option value="">{t('crm.activity.allEntities')}</option>
            {entityTypeOptions.map((entityType) => (
              <option key={entityType} value={entityType}>
                {getEntityTypeLabel(entityType, t)}
              </option>
            ))}
          </select>

          <div>
            <button
              type="button"
              onClick={handleClearFilters}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              {t('common.actions.clear')}
            </button>
          </div>
        </div>
      </section>

      {isLoading ? <LoadingSkeleton rows={8} /> : null}

      {!isLoading && errorMessage ? (
        <ErrorState message={errorMessage} />
      ) : null}

      {!isLoading && !errorMessage && events.length === 0 ? (
        <EmptyState
          title={t('crm.activity.noFound')}
          description={t('crm.activity.empty')}
        />
      ) : null}

      {!isLoading && !errorMessage && events.length > 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="space-y-4">
            {events.map((event) => {
              const entityHref = getEntityHref(event);

              return (
                <article
                  key={event.id}
                  className="relative rounded-2xl border border-slate-200 p-5"
                >
                  <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={getActivityTypeClasses(event.type)}>
                          {getActivityTypeLabel(event.type, t)}
                        </Badge>

                        <Badge className="bg-slate-100 text-slate-700 ring-slate-200">
                          {getEntityTypeLabel(event.entityType, t)}
                        </Badge>

                        {event.source ? (
                          <span className="text-xs text-slate-500">
                            {t('common.labels.source')}:{' '}
                            {getSourceLabel(event.source, t)}
                          </span>
                        ) : null}
                      </div>

                      <div>
                        <h2 className="text-base font-semibold text-slate-950">
                          {event.title}
                        </h2>

                        {event.description ? (
                          <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">
                            {event.description}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                        <span>
                          {t('common.labels.actor')}:{' '}
                          {getActorLabel(event, t('common.labels.system'))}
                        </span>
                        <span>
                          {t('common.labels.occurred')}:{' '}
                          {formatDateTime(event.occurredAt)}
                        </span>
                      </div>
                    </div>

                    {entityHref ? (
                      <Link
                        href={entityHref}
                        className="shrink-0 text-sm font-medium text-blue-700 transition hover:text-blue-900"
                      >
                        {t('common.actions.viewRecord')}
                      </Link>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>

          {meta ? (
            <div className="mt-5 flex flex-col gap-3 border-t border-slate-200 pt-5 md:flex-row md:items-center md:justify-between">
              <p className="text-sm text-slate-600">
                {t('common.pagination.page')} {meta.page}{' '}
                {t('common.pagination.of')} {meta.totalPages || 1} ·{' '}
                {meta.total} {t('crm.activity.total')}
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
