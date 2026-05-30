'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ContactForm } from '@/components/ContactForm';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/i18n/useI18n';
import { ApiClientError, createContact, getCompanies } from '@/lib/api-client';
import type { Company, CreateContactInput } from '@/types/crm';

export default function NewContactPage() {
  const router = useRouter();
  const { token } = useAuth();
  const { t } = useI18n();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadCompanies() {
      if (!token) {
        setIsLoadingCompanies(false);
        return;
      }

      try {
        const response = await getCompanies(token, {
          page: 1,
          pageSize: 100,
          sortBy: 'name',
          sortOrder: 'asc',
        });

        if (!isMounted) {
          return;
        }

        setCompanies(response.data);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (error instanceof ApiClientError) {
          setErrorMessage(error.message);
        } else if (error instanceof Error) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage(t('crm.companies.loadFailed'));
        }
      } finally {
        if (isMounted) {
          setIsLoadingCompanies(false);
        }
      }
    }

    loadCompanies();

    return () => {
      isMounted = false;
    };
  }, [token, t]);

  async function handleCreateContact(values: CreateContactInput) {
    if (!token) {
      setErrorMessage(t('crm.common.sessionNotReady'));
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const contact = await createContact(token, values);
      router.push(`/dashboard/contacts/${contact.id}`);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage(t('crm.contacts.createFailed'));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <Link
          href="/dashboard/contacts"
          className="text-sm font-medium text-blue-700 transition hover:text-blue-900"
        >
          ← {t('crm.common.backToContacts')}
        </Link>

        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-blue-700">
            {t('crm.common.crmManagement')}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            {t('crm.contacts.new')}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            {t('crm.contacts.newDescription')}
          </p>
        </div>
      </section>

      {errorMessage ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {isLoadingCompanies ? (
        <div className="h-96 animate-pulse rounded-2xl bg-slate-100" />
      ) : (
        <ContactForm
          companies={companies}
          submitLabel={t('crm.contacts.create')}
          isSubmitting={isSubmitting}
          onSubmit={handleCreateContact}
        />
      )}
    </div>
  );
}
