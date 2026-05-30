'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { ErrorState } from '@/components/ui/ErrorState';
import {
  getImportanceLabel,
  getLeadStatusLabel,
  getPriorityLabel,
  getSourceLabel,
} from '@/i18n/ai-display';
import { useI18n } from '@/i18n/useI18n';
import {
  ApiClientError,
  deleteCompany,
  getCompanyById,
} from '@/lib/api-client';
import { getImportanceClasses } from '@/lib/crm-styles';
import { formatDate } from '@/lib/formatters';
import { canDeleteCrm } from '@/lib/permissions';
import { useAuth } from '@/hooks/useAuth';
import type { CompanyDetail } from '@/types/crm';


function EmptyRelatedState({ label }: { label: string }) {
  const { t } = useI18n();

  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
      {t('crm.common.noLinkedYetPrefix')} {label}{' '}
      {t('crm.common.noLinkedYetSuffix')}
    </div>
  );
}

export default function CompanyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { token, user } = useAuth();
  const { t } = useI18n();

  const companyId =
    typeof params.id === 'string'
      ? params.id
      : Array.isArray(params.id)
        ? params.id[0]
        : '';

  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadCompany() {
      if (!token || !companyId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await getCompanyById(token, companyId, {
          include: 'contacts,leads,notes',
        });

        if (!isMounted) {
          return;
        }

        setCompany(response);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (error instanceof ApiClientError) {
          setErrorMessage(error.message);
        } else if (error instanceof Error) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage(t('crm.companies.loadOneFailed'));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadCompany();

    return () => {
      isMounted = false;
    };
  }, [token, companyId, t]);

  const canDeleteCompany = canDeleteCrm(user);

async function handleDeleteCompany() {
  if (!token || !companyId || !company) {
    setErrorMessage(t('crm.common.sessionNotReady'));
    return;
  }

  const confirmed = window.confirm(
    t('crm.companies.deleteConfirm').replace('{name}', company.name),
  );

  if (!confirmed) {
    return;
  }

  setIsDeleting(true);
  setErrorMessage(null);

  try {
    await deleteCompany(token, companyId);
    router.push('/dashboard/companies');
  } catch (error) {
    if (error instanceof ApiClientError) {
      setErrorMessage(error.message);
    } else if (error instanceof Error) {
      setErrorMessage(error.message);
    } else {
      setErrorMessage(t('crm.companies.deleteFailed'));
    }
  } finally {
    setIsDeleting(false);
  }
}

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="h-44 animate-pulse rounded-2xl bg-slate-100" />
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
          href="/dashboard/companies"
          className="text-sm font-medium text-blue-700 transition hover:text-blue-900"
        >
          ← {t('crm.common.backToCompanies')}
        </Link>

    <ErrorState message={errorMessage} />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/companies"
          className="text-sm font-medium text-blue-700 transition hover:text-blue-900"
        >
          ← {t('crm.common.backToCompanies')}
        </Link>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-950">
            {t('crm.companies.notFound')}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {t('crm.companies.notFoundDescription')}
          </p>
        </div>
      </div>
    );
  }

  const contacts = company.contacts ?? [];
  const leads = company.leads ?? [];
  const notes = company.linkedNotes ?? [];

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <Link
          href="/dashboard/companies"
          className="text-sm font-medium text-blue-700 transition hover:text-blue-900"
        >
          ← {t('crm.common.backToCompanies')}
        </Link>

        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-blue-700">
              {t('crm.companies.detail')}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              {company.name}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              {t('crm.companies.detailDescription')}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
  <Link
    href={`/dashboard/companies/${company.id}/edit`}
    className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
  >
    {t('crm.common.edit')}
  </Link>

  <Link
    href={`/dashboard/notes/new?companyId=${company.id}`}
    className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700 transition hover:bg-blue-100"
  >
    {t('navigation.items.notes')}
  </Link>

  <Link
    href={`/dashboard/leads/new?companyId=${company.id}`}
    className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700 transition hover:bg-blue-100"
  >
    {t('navigation.items.leads')}
  </Link>

  {canDeleteCompany ? (
    <button
      type="button"
      onClick={handleDeleteCompany}
      disabled={isDeleting}
      className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isDeleting ? t('crm.common.deleting') : t('crm.common.delete')}
    </button>
  ) : null}
</div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-6 lg:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('crm.companies.website')}
            </p>
            {company.website ? (
              <a
                href={company.website}
                target="_blank"
                rel="noreferrer"
                className="mt-2 block break-all text-sm font-medium text-blue-700 hover:text-blue-900"
              >
                {company.website}
              </a>
            ) : (
              <p className="mt-2 text-sm text-slate-600">
                {t('crm.common.notSpecified')}
              </p>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('crm.companies.industry')}
            </p>
            <p className="mt-2 text-sm text-slate-950">
              {company.industry ?? t('crm.common.notSpecified')}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('crm.common.location')}
            </p>
            <p className="mt-2 text-sm text-slate-950">
              {[company.city, company.country].filter(Boolean).join(', ') ||
                t('crm.common.notSpecified')}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('crm.common.importance')}
            </p>
            <div className="mt-2">
              <Badge className={getImportanceClasses(company.importanceLevel)}>
                {getImportanceLabel(company.importanceLevel, t)}
              </Badge>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('crm.common.source')}
            </p>
            <p className="mt-2 text-sm text-slate-950">
              {getSourceLabel(company.source, t)}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('crm.common.created')}
            </p>
            <p className="mt-2 text-sm text-slate-950">
              {formatDate(company.createdAt)}
            </p>
          </div>
        </div>

        {company.notes ? (
          <div className="mt-6 border-t border-slate-200 pt-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('crm.common.notes')}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              {company.notes}
            </p>
          </div>
        ) : null}
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-950">
              {t('navigation.items.contacts')}
            </h2>
            <span className="text-xs font-medium text-slate-500">
              {contacts.length}
            </span>
          </div>

          {contacts.length > 0 ? (
            <div className="space-y-3">
              {contacts.map((contact) => (
                <div
                  key={contact.id}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <p className="font-medium text-slate-950">
                    {contact.firstName} {contact.lastName}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {contact.email ?? t('crm.common.noEmail')}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {contact.phone ?? t('crm.common.noPhone')}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyRelatedState
              label={t('navigation.items.contacts').toLowerCase()}
            />
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-950">
              {t('navigation.items.leads')}
            </h2>
            <span className="text-xs font-medium text-slate-500">
              {leads.length}
            </span>
          </div>

          {leads.length > 0 ? (
            <div className="space-y-3">
              {leads.map((lead) => (
                <div
                  key={lead.id}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <p className="font-medium text-slate-950">{lead.title}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge className="bg-slate-100 text-slate-700 ring-slate-200">
                      {getLeadStatusLabel(lead.status, t)}
                    </Badge>
                    <Badge className={getImportanceClasses(lead.priority)}>
                      {getPriorityLabel(lead.priority, t)}
                    </Badge>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    {t('crm.common.created')} {formatDate(lead.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyRelatedState
              label={t('navigation.items.leads').toLowerCase()}
            />
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-950">
              {t('navigation.items.notes')}
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
                    {t('crm.common.created')} {formatDate(note.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyRelatedState
              label={t('navigation.items.notes').toLowerCase()}
            />
          )}
        </div>
      </section>
    </div>
  );
}
