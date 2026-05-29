'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import { useAuth } from '@/hooks/useAuth';
import { ApiClientError, getLeads, moveLeadPipeline } from '@/lib/api-client';
import { leadStatusOptions } from '@/lib/crm-options';
import { getLeadStatusClasses, getPriorityClasses } from '@/lib/crm-styles';
import { formatDate, formatEnumLabel, formatMoney } from '@/lib/formatters';
import { canCreateCrm } from '@/lib/permissions';
import type { Lead, LeadStatus } from '@/types/crm';

type LeadsByStatus = Record<LeadStatus, Lead[]>;

function createEmptyLeadsByStatus() {
  return leadStatusOptions.reduce((accumulator, status) => {
    accumulator[status] = [];

    return accumulator;
  }, {} as LeadsByStatus);
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

  const [leadsByStatus, setLeadsByStatus] = useState<LeadsByStatus>(() =>
    createEmptyLeadsByStatus(),
  );
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
        setErrorMessage('Could not load lead pipeline.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadPipeline();
  }, [loadPipeline]);

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
        setErrorMessage('Could not move lead.');
      }
    } finally {
      setMovingLeadId(null);
    }
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
        title="Lead Pipeline"
        description="Manage opportunities by stage, review pipeline health, and move leads through the commercial workflow."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/leads/list"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              List view
            </Link>

            {canCreateCrm(user) ? (
              <Link
                href="/dashboard/leads/new"
                className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
              >
                New lead
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
          title="No leads in pipeline"
          description="Create leads to start visualizing your commercial pipeline."
        />
      ) : null}

      {!isLoading && !errorMessage && totalLeads > 0 ? (
        <section className="overflow-x-auto pb-3">
          <div className="grid min-w-[1320px] gap-4 xl:grid-cols-4 2xl:grid-cols-8">
            {leadStatusOptions.map((status) => {
              const leads = leadsByStatus[status];

              return (
                <div
                  key={status}
                  className="flex min-h-[520px] flex-col rounded-2xl border border-slate-200 bg-slate-50"
                >
                  <div className="border-b border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <Badge className={getLeadStatusClasses(status)}>
                        {formatEnumLabel(status)}
                      </Badge>

                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200">
                        {leads.length}
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 space-y-3 p-3">
                    {leads.length > 0 ? (
                      leads.map((lead) => (
                        <article
                          key={lead.id}
                          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
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
                                {lead.nextStep ?? 'No next step'}
                              </p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <Badge
                                className={getPriorityClasses(lead.priority)}
                              >
                                {formatEnumLabel(lead.priority)}
                              </Badge>
                            </div>

                            <div className="space-y-1 text-xs text-slate-500">
                              <p>
                                Budget:{' '}
                                <span className="font-medium text-slate-700">
                                  {formatMoney(lead.estimatedBudget)}
                                </span>
                              </p>

                              <p>
                                Close:{' '}
                                <span className="font-medium text-slate-700">
                                  {formatDate(lead.expectedCloseDate)}
                                </span>
                              </p>

                              <p>
                                Stage since:{' '}
                                <span className="font-medium text-slate-700">
                                  {formatDate(lead.statusChangedAt)}
                                </span>
                              </p>

                              {lead.company ? (
                                <p>
                                  Company:{' '}
                                  <span className="font-medium text-slate-700">
                                    {lead.company.name}
                                  </span>
                                </p>
                              ) : null}

                              {lead.contact ? (
                                <p>
                                  Contact:{' '}
                                  <span className="font-medium text-slate-700">
                                    {lead.contact.firstName}{' '}
                                    {lead.contact.lastName}
                                  </span>
                                </p>
                              ) : null}
                            </div>

                            <div className="space-y-2">
                              <label className="text-xs font-medium text-slate-600">
                                Move to stage
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
                                    {formatEnumLabel(option)}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <Link
                              href={`/dashboard/leads/${lead.id}`}
                              className="inline-flex text-xs font-medium text-blue-700 transition hover:text-blue-900"
                            >
                              View record
                            </Link>
                          </div>
                        </article>
                      ))
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-sm text-slate-500">
                        No leads
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
