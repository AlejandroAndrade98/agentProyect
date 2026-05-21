'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ContactForm } from '@/components/ContactForm';
import { useAuth } from '@/hooks/useAuth';
import { ApiClientError, createContact, getCompanies } from '@/lib/api-client';
import type { Company, CreateContactInput } from '@/types/crm';

export default function NewContactPage() {
  const router = useRouter();
  const { token } = useAuth();

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
          setErrorMessage('Could not load companies.');
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
  }, [token]);

  async function handleCreateContact(values: CreateContactInput) {
    if (!token) {
      setErrorMessage('Your session is not ready. Please try again.');
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
        setErrorMessage('Could not create contact.');
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
          ← Back to contacts
        </Link>

        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-blue-700">
            CRM Management
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            New contact
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Create a stakeholder profile and optionally link it to an existing
            company.
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
          submitLabel="Create contact"
          isSubmitting={isSubmitting}
          onSubmit={handleCreateContact}
        />
      )}
    </div>
  );
}