'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { LeadForm } from '@/components/LeadForm';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/i18n/useI18n';
import {
  ApiClientError,
  createLead,
  getCompanies,
  getContacts,
} from '@/lib/api-client';
import type { Company, Contact, CreateLeadInput } from '@/types/crm';

export default function NewLeadPage() {
  const router = useRouter();
  const { token, user } = useAuth();
  const { t } = useI18n();

  const [companies, setCompanies] = useState<Company[]>([]);
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
        const [companiesResponse, contactsResponse] = await Promise.all([
          getCompanies(token, {
            page: 1,
            pageSize: 100,
            sortBy: 'name',
            sortOrder: 'asc',
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

        setCompanies(companiesResponse.data);
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
          setErrorMessage(t('crm.leads.loadRelationsFailed'));
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

  async function handleCreateLead(values: CreateLeadInput) {
    if (!token) {
      setErrorMessage(t('crm.common.sessionNotReady'));
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const lead = await createLead(token, values);
      router.push(`/dashboard/leads/${lead.id}`);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage(t('crm.leads.createFailed'));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <Link
          href="/dashboard/leads"
          className="text-sm font-medium text-blue-700 transition hover:text-blue-900"
        >
          ← {t('crm.common.backToLeads')}
        </Link>

        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-blue-700">
            {t('crm.common.crmManagement')}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            {t('crm.leads.new')}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            {t('crm.leads.newDescription')}
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
        <LeadForm
          companies={companies}
          contacts={contacts}
          currentUser={user}
          submitLabel={t('crm.common.createLead')}
          isSubmitting={isSubmitting}
          onSubmit={handleCreateLead}
        />
      )}
    </div>
  );
}
