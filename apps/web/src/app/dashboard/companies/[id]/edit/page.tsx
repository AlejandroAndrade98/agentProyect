'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { CompanyForm } from '@/components/CompanyForm';
import { useAuth } from '@/hooks/useAuth';
import { ApiClientError, getCompanyById, updateCompany } from '@/lib/api-client';
import type { CompanyDetail, CreateCompanyInput } from '@/types/crm';

function getCompanyInitialValues(company: CompanyDetail): CreateCompanyInput {
  return {
    name: company.name,
    website: company.website ?? undefined,
    industry: company.industry ?? undefined,
    city: company.city ?? undefined,
    country: company.country ?? undefined,
    notes: company.notes ?? undefined,
    importanceLevel: company.importanceLevel,
    source: company.source,
  };
}

export default function EditCompanyPage() {
  const params = useParams();
  const router = useRouter();
  const { token } = useAuth();

  const companyId =
    typeof params.id === 'string'
      ? params.id
      : Array.isArray(params.id)
        ? params.id[0]
        : '';

  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        const response = await getCompanyById(token, companyId);

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
          setErrorMessage('Could not load company.');
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
  }, [token, companyId]);

  async function handleUpdateCompany(values: CreateCompanyInput) {
    if (!token || !companyId) {
      setErrorMessage('Your session is not ready. Please try again.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const updatedCompany = await updateCompany(token, companyId, values);
      router.push(`/dashboard/companies/${updatedCompany.id}`);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Could not update company.');
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

  if (errorMessage && !company) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/companies"
          className="text-sm font-medium text-blue-700 transition hover:text-blue-900"
        >
          ← Back to companies
        </Link>

        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {errorMessage}
        </div>
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
          ← Back to companies
        </Link>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-950">
            Company not found
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            The company may have been deleted or you may not have access.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <Link
          href={`/dashboard/companies/${company.id}`}
          className="text-sm font-medium text-blue-700 transition hover:text-blue-900"
        >
          ← Back to company detail
        </Link>

        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-blue-700">
            CRM Management
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            Edit company
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Update company account information and keep your CRM data clean.
          </p>
        </div>
      </section>

      {errorMessage ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <CompanyForm
        initialValues={getCompanyInitialValues(company)}
        submitLabel="Save changes"
        isSubmitting={isSubmitting}
        onSubmit={handleUpdateCompany}
      />
    </div>
  );
}