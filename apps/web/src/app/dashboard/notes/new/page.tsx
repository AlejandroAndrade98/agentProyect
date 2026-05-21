'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { NoteForm } from '@/components/NoteForm';
import { useAuth } from '@/hooks/useAuth';
import {
  ApiClientError,
  createNote,
  getCompanies,
  getContacts,
  getLeads,
} from '@/lib/api-client';
import type {
  Company,
  Contact,
  CreateNoteInput,
  Lead,
} from '@/types/crm';

export default function NewNotePage() {
  const router = useRouter();
  const { token } = useAuth();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
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
        const [companiesResponse, contactsResponse, leadsResponse] =
          await Promise.all([
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
            getLeads(token, {
              page: 1,
              pageSize: 100,
              sortBy: 'createdAt',
              sortOrder: 'desc',
            }),
          ]);

        if (!isMounted) {
          return;
        }

        setCompanies(companiesResponse.data);
        setContacts(contactsResponse.data);
        setLeads(leadsResponse.data);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (error instanceof ApiClientError) {
          setErrorMessage(error.message);
        } else if (error instanceof Error) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage('Could not load related CRM records.');
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
  }, [token]);

  async function handleCreateNote(values: CreateNoteInput) {
    if (!token) {
      setErrorMessage('Your session is not ready. Please try again.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const note = await createNote(token, values);
      router.push(`/dashboard/notes/${note.id}`);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Could not create note.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <Link
          href="/dashboard/notes"
          className="text-sm font-medium text-blue-700 transition hover:text-blue-900"
        >
          ← Back to notes
        </Link>

        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-blue-700">
            CRM Management
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            New note
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Create a commercial note and optionally link it to a company,
            contact, or lead.
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
        <NoteForm
          companies={companies}
          contacts={contacts}
          leads={leads}
          submitLabel="Create note"
          isSubmitting={isSubmitting}
          onSubmit={handleCreateNote}
        />
      )}
    </div>
  );
}