'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { LeadForm } from '@/components/LeadForm';
import { useAuth } from '@/hooks/useAuth';
import {
  ApiClientError,
  getCompanies,
  getContacts,
  getLeadById,
  updateLead,
} from '@/lib/api-client';
import type {
  Company,
  Contact,
  CreateLeadInput,
  LeadDetail,
} from '@/types/crm';

function getLeadInitialValues(lead: LeadDetail): CreateLeadInput {
  return {
    title: lead.title,
    description: lead.description ?? undefined,
    companyId: lead.companyId ?? undefined,
    contactId: lead.contactId ?? undefined,
    assignedToUserId: lead.assignedToUserId ?? undefined,
    status: lead.status,
    priority: lead.priority,
    importanceLevel: lead.importanceLevel,
    source: lead.source,
    estimatedBudget: lead.estimatedBudget ?? undefined,
    expectedCloseDate: lead.expectedCloseDate ?? undefined,
    lastContactAt: lead.lastContactAt ?? undefined,
    nextStep: lead.nextStep ?? undefined,
  };
}

export default function EditLeadPage() {
  const params = useParams();
  const router = useRouter();
  const { token, user } = useAuth();

  const leadId =
    typeof params.id === 'string'
      ? params.id
      : Array.isArray(params.id)
        ? params.id[0]
        : '';

  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      if (!token || !leadId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const [leadResponse, companiesResponse, contactsResponse] =
          await Promise.all([
            getLeadById(token, leadId),
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

        setLead(leadResponse);
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
          setErrorMessage('Could not load lead.');
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
  }, [token, leadId]);

  async function handleUpdateLead(values: CreateLeadInput) {
    if (!token || !leadId) {
      setErrorMessage('Your session is not ready. Please try again.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const updatedLead = await updateLead(token, leadId, values);
      router.push(`/dashboard/leads/${updatedLead.id}`);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Could not update lead.');
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

  if (errorMessage && !lead) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/leads"
          className="text-sm font-medium text-blue-700 transition hover:text-blue-900"
        >
          ← Back to leads
        </Link>

        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {errorMessage}
        </div>
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
          ← Back to leads
        </Link>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-950">
            Lead not found
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            The lead may have been deleted or you may not have access.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <Link
          href={`/dashboard/leads/${lead.id}`}
          className="text-sm font-medium text-blue-700 transition hover:text-blue-900"
        >
          ← Back to lead detail
        </Link>

        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-blue-700">
            CRM Management
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            Edit lead
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Update opportunity status, priority, budget, ownership, and next
            steps.
          </p>
        </div>
      </section>

      {errorMessage ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <LeadForm
        companies={companies}
        contacts={contacts}
        currentUser={user}
        initialValues={getLeadInitialValues(lead)}
        submitLabel="Save changes"
        isSubmitting={isSubmitting}
        onSubmit={handleUpdateLead}
      />
    </div>
  );
}