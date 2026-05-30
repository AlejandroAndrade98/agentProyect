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
import { getLeadStatusLabel, getPriorityLabel } from '@/i18n/ai-display';
import { useI18n } from '@/i18n/useI18n';
import { ApiClientError, getLeads, moveLeadPipeline } from '@/lib/api-client';
import { leadStatusOptions } from '@/lib/crm-options';
import { getLeadStatusClasses, getPriorityClasses } from '@/lib/crm-styles';
import { formatDate, formatMoney } from '@/lib/formatters';
import { canCreateCrm } from '@/lib/permissions';
import type { Lead, LeadStatus } from '@/types/crm';

type LeadsByStatus = Record<LeadStatus, Lead[]>;
type LeadColumnPages = Record<LeadStatus, number>;

const BOARD_PAGE_SIZE = 5;

function createEmptyLeadsByStatus() {
  return leadStatusOptions.reduce((accumulator, status) => {
    accumulator[status] = [];

    return accumulator;
  }, {} as LeadsByStatus);
}

function createInitialLeadColumnPages() {
  return leadStatusOptions.reduce((accumulator, status) => {
    accumulator[status] = 1;

    return accumulator;
  }, {} as LeadColumnPages);
}

function getLeadColumnTotalPages(leads: Lead[]) {
  return Math.max(1, Math.ceil(leads.length / BOARD_PAGE_SIZE));
}

function getVisibleLeadPage(leads: Lead[], page: number) {
  const startIndex = (page - 1) * BOARD_PAGE_SIZE;

  return leads.slice(startIndex, startIndex + BOARD_PAGE_SIZE);
}

function sortLeadsForBoard(leads: Lead[]) {
  return [...leads].sort((firstLead, secondLead) => {
    if (firstLead.pipelinePosition !== secondLead.pipelinePosition) {
      return firstLead.pipelinePosition - secondLead.pipelinePosition;
    }

    return (
      new Date(secondLead.updatedAt).getTime() -
      new Date(firstLead.updatedAt).getTime()
    );
  });
}

export default function LeadPipelinePage() {
  const { token, user } = useAuth();
  const { t } = useI18n();

  const [leadsByStatus, setLeadsByStatus] = useState<LeadsByStatus>(() =>
    createEmptyLeadsByStatus(),
  );
  const [columnPages, setColumnPages] = useState<LeadColumnPages>(() =>
    createInitialLeadColumnPages(),
  );
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<LeadStatus | null>(null);
  const [movingLeadId, setMovingLeadId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadPipeline = useCallback(async () => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const responses = await Promise.all(
        leadStatusOptions.map(async (status) => {
          const response = await getLeads(token, {
            page: 1,
            pageSize: 100,
            status,
            sortBy: 'updatedAt',
            sortOrder: 'desc',
          });

          return [status, sortLeadsForBoard(response.data)] as const;
        }),
      );

      const nextLeadsByStatus = createEmptyLeadsByStatus();

      responses.forEach(([status, leads]) => {
        nextLeadsByStatus[status] = leads;
      });

      setLeadsByStatus(nextLeadsByStatus);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage(t('crm.leads.loadPipelineFailed'));
      }
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadPipeline();
  }, [loadPipeline]);

  useEffect(() => {
    setColumnPages((currentPages) => {
      const nextPages = { ...currentPages };

      leadStatusOptions.forEach((status) => {
        nextPages[status] = Math.min(
          nextPages[status],
          getLeadColumnTotalPages(leadsByStatus[status]),
        );
      });

      return nextPages;
    });
  }, [leadsByStatus]);

  async function handleMoveLead(lead: Lead, nextStatus: LeadStatus) {
    if (!token || lead.status === nextStatus) {
      return;
    }

    setMovingLeadId(lead.id);
    setErrorMessage(null);

    try {
      await moveLeadPipeline(token, lead.id, {
        status: nextStatus,
      });

      await loadPipeline();
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage(t('crm.leads.moveFailed'));
      }
    } finally {
      setMovingLeadId(null);
    }
  }

  function getLeadById(leadId: string) {
    for (const status of leadStatusOptions) {
      const lead = leadsByStatus[status].find((item) => item.id === leadId);

      if (lead) {
        return lead;
      }
    }

    return null;
  }

  function handleLeadDragStart(
    event: DragEvent<HTMLElement>,
    lead: Lead,
  ) {
    setDraggedLeadId(lead.id);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', lead.id);
  }

  function handleColumnDragOver(
    event: DragEvent<HTMLDivElement>,
    status: LeadStatus,
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

  function handleLeadDrop(
    event: DragEvent<HTMLDivElement>,
    nextStatus: LeadStatus,
  ) {
    event.preventDefault();
    const leadId = event.dataTransfer.getData('text/plain') || draggedLeadId;
    const lead = leadId ? getLeadById(leadId) : null;

    setDraggedLeadId(null);
    setDragOverStatus(null);

    if (lead) {
      void handleMoveLead(lead, nextStatus);
    }
  }

  function handleLeadDragEnd() {
    setDraggedLeadId(null);
    setDragOverStatus(null);
  }

  const totalLeads = useMemo(
    () =>
      leadStatusOptions.reduce(
        (total, status) => total + leadsByStatus[status].length,
        0,
      ),
    [leadsByStatus],
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title={t('crm.leads.pipelineTitle')}
        description={t('crm.leads.pipelineSubtitle')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/leads/list"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              {t('common.actions.listView')}
            </Link>

            {canCreateCrm(user) ? (
              <Link
                href="/dashboard/leads/new"
                className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
              >
                {t('crm.common.newLead')}
              </Link>
            ) : null}
          </div>
        }
      />

      {isLoading ? <LoadingSkeleton rows={8} /> : null}

      {!isLoading && errorMessage ? (
        <ErrorState message={errorMessage} />
      ) : null}

      {!isLoading && !errorMessage && totalLeads === 0 ? (
        <EmptyState
          title={t('crm.leads.noPipeline')}
          description={t('crm.leads.noPipelineDescription')}
        />
      ) : null}

      {!isLoading && !errorMessage && totalLeads > 0 ? (
        <section className="overflow-x-auto pb-3">
          <div className="grid min-w-[1320px] gap-4 xl:grid-cols-4 2xl:grid-cols-8">
            {leadStatusOptions.map((status) => {
              const leads = leadsByStatus[status];
              const currentPage = columnPages[status];
              const totalPages = getLeadColumnTotalPages(leads);
              const visibleLeads = getVisibleLeadPage(leads, currentPage);

              return (
                <div
                  key={status}
                  onDragOver={(event) => handleColumnDragOver(event, status)}
                  onDragLeave={handleColumnDragLeave}
                  onDrop={(event) => handleLeadDrop(event, status)}
                  className={`flex min-h-[520px] flex-col rounded-2xl border bg-slate-50 transition ${
                    dragOverStatus === status
                      ? 'border-blue-300 ring-4 ring-blue-100'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="border-b border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <Badge className={getLeadStatusClasses(status)}>
                        {getLeadStatusLabel(status, t)}
                      </Badge>

                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200">
                        {leads.length}
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 space-y-3 p-3">
                    {visibleLeads.length > 0 ? (
                      visibleLeads.map((lead) => (
                        <article
                          key={lead.id}
                          draggable={movingLeadId !== lead.id}
                          onDragStart={(event) =>
                            handleLeadDragStart(event, lead)
                          }
                          onDragEnd={handleLeadDragEnd}
                          className={`cursor-grab rounded-2xl border bg-white p-4 shadow-sm transition active:cursor-grabbing ${
                            draggedLeadId === lead.id || movingLeadId === lead.id
                              ? 'border-blue-200 opacity-60'
                              : 'border-slate-200'
                          }`}
                        >
                          <div className="space-y-3">
                            <div>
                              <Link
                                href={`/dashboard/leads/${lead.id}`}
                                className="font-medium text-slate-950 transition hover:text-blue-700"
                              >
                                {lead.title}
                              </Link>

                              <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                                {lead.nextStep ?? t('crm.common.noNextStep')}
                              </p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <Badge
                                className={getPriorityClasses(lead.priority)}
                              >
                                {getPriorityLabel(lead.priority, t)}
                              </Badge>
                            </div>

                            <div className="space-y-1 text-xs text-slate-500">
                              <p>
                                {t('crm.common.budget')}:{' '}
                                <span className="font-medium text-slate-700">
                                  {formatMoney(lead.estimatedBudget)}
                                </span>
                              </p>

                              <p>
                                {t('crm.common.closeDate')}:{' '}
                                <span className="font-medium text-slate-700">
                                  {formatDate(lead.expectedCloseDate)}
                                </span>
                              </p>

                              <p>
                                {t('crm.common.stageSince')}:{' '}
                                <span className="font-medium text-slate-700">
                                  {formatDate(lead.statusChangedAt)}
                                </span>
                              </p>

                              {lead.company ? (
                                <p>
                                  {t('crm.common.company')}:{' '}
                                  <span className="font-medium text-slate-700">
                                    {lead.company.name}
                                  </span>
                                </p>
                              ) : null}

                              {lead.contact ? (
                                <p>
                                  {t('crm.common.contact')}:{' '}
                                  <span className="font-medium text-slate-700">
                                    {lead.contact.firstName}{' '}
                                    {lead.contact.lastName}
                                  </span>
                                </p>
                              ) : null}
                            </div>

                            <div className="space-y-2">
                              <label className="text-xs font-medium text-slate-600">
                                {t('crm.common.moveToStage')}
                              </label>

                              <select
                                value={lead.status}
                                disabled={movingLeadId === lead.id}
                                onChange={(event) =>
                                  handleMoveLead(
                                    lead,
                                    event.target.value as LeadStatus,
                                  )
                                }
                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {leadStatusOptions.map((option) => (
                                  <option key={option} value={option}>
                                    {getLeadStatusLabel(option, t)}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <Link
                              href={`/dashboard/leads/${lead.id}`}
                              className="inline-flex text-xs font-medium text-blue-700 transition hover:text-blue-900"
                            >
                              {t('common.actions.viewRecord')}
                            </Link>
                          </div>
                        </article>
                      ))
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-sm text-slate-500">
                        {t('crm.leads.noLeads')}
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
