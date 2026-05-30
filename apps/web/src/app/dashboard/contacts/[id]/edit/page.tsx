'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ContactForm } from '@/components/ContactForm';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/i18n/useI18n';
import {
  ApiClientError,
  getCompanies,
  getContactById,
  updateContact,
} from '@/lib/api-client';
import type {
  Company,
  ContactDetail,
  CreateContactInput,
} from '@/types/crm';

function getContactInitialValues(contact: ContactDetail): CreateContactInput {
  return {
    firstName: contact.firstName,
    lastName: contact.lastName,
    email: contact.email ?? undefined,
    phone: contact.phone ?? undefined,
    companyId: contact.companyId ?? undefined,
    jobTitle: contact.jobTitle ?? undefined,
    linkedinUrl: contact.linkedinUrl ?? undefined,
    city: contact.city ?? undefined,
    country: contact.country ?? undefined,
    notes: contact.notes ?? undefined,
    expertise: contact.expertise ?? undefined,
    importanceLevel: contact.importanceLevel,
    source: contact.source,
  };
}

export default function EditContactPage() {
  const params = useParams();
  const router = useRouter();
  const { token } = useAuth();
  const { t } = useI18n();

  const contactId =
    typeof params.id === 'string'
      ? params.id
      : Array.isArray(params.id)
        ? params.id[0]
        : '';

  const [contact, setContact] = useState<ContactDetail | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      if (!token || !contactId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const [contactResponse, companiesResponse] = await Promise.all([
          getContactById(token, contactId),
          getCompanies(token, {
            page: 1,
            pageSize: 100,
            sortBy: 'name',
            sortOrder: 'asc',
          }),
        ]);

        if (!isMounted) {
          return;
        }

        setContact(contactResponse);
        setCompanies(companiesResponse.data);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (error instanceof ApiClientError) {
          setErrorMessage(error.message);
        } else if (error instanceof Error) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage(t('crm.contacts.loadOneFailed'));
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
  }, [token, contactId, t]);

  async function handleUpdateContact(values: CreateContactInput) {
    if (!token || !contactId) {
      setErrorMessage(t('crm.common.sessionNotReady'));
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const updatedContact = await updateContact(token, contactId, values);
      router.push(`/dashboard/contacts/${updatedContact.id}`);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage(t('crm.contacts.updateFailed'));
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

  if (errorMessage && !contact) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/contacts"
          className="text-sm font-medium text-blue-700 transition hover:text-blue-900"
        >
          ← {t('crm.common.backToContacts')}
        </Link>

        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {errorMessage}
        </div>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/contacts"
          className="text-sm font-medium text-blue-700 transition hover:text-blue-900"
        >
          ← {t('crm.common.backToContacts')}
        </Link>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-950">
            {t('crm.contacts.notFound')}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {t('crm.contacts.notFoundDescription')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <Link
          href={`/dashboard/contacts/${contact.id}`}
          className="text-sm font-medium text-blue-700 transition hover:text-blue-900"
        >
          ← {t('crm.common.backToContactDetail')}
        </Link>

        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-blue-700">
            {t('crm.common.crmManagement')}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            {t('crm.contacts.edit')}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            {t('crm.contacts.editDescription')}
          </p>
        </div>
      </section>

      {errorMessage ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <ContactForm
        companies={companies}
        initialValues={getContactInitialValues(contact)}
        submitLabel={t('crm.common.saveChanges')}
        isSubmitting={isSubmitting}
        onSubmit={handleUpdateContact}
      />
    </div>
  );
}
