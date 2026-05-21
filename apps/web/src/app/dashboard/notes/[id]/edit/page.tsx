'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { NoteForm } from '@/components/NoteForm';
import { useAuth } from '@/hooks/useAuth';
import {
  ApiClientError,
  getCompanies,
  getContacts,
  getLeads,
  getNoteById,
  updateNote,
} from '@/lib/api-client';
import type {
  Company,
  Contact,
  CreateNoteInput,
  Lead,
  NoteDetail,
} from '@/types/crm';

function getNoteInitialValues(note: NoteDetail): CreateNoteInput {
  return {
    title: note.title ?? undefined,
    content: note.content,
    companyId: note.companyId ?? undefined,
    contactId: note.contactId ?? undefined,
    leadId: note.leadId ?? undefined,
    importanceLevel: note.importanceLevel,
    source: note.source,
  };
}

export default function EditNotePage() {
  const params = useParams();
  const router = useRouter();
  const { token } = useAuth();

  const noteId =
    typeof params.id === 'string'
      ? params.id
      : Array.isArray(params.id)
        ? params.id[0]
        : '';

  const [note, setNote] = useState<NoteDetail | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      if (!token || !noteId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const [noteResponse, companiesResponse, contactsResponse, leadsResponse] =
          await Promise.all([
            getNoteById(token, noteId),
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

        setNote(noteResponse);
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
          setErrorMessage('Could not load note.');
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
  }, [token, noteId]);

  async function handleUpdateNote(values: CreateNoteInput) {
    if (!token || !noteId) {
      setErrorMessage('Your session is not ready. Please try again.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const updatedNote = await updateNote(token, noteId, values);
      router.push(`/dashboard/notes/${updatedNote.id}`);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Could not update note.');
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

  if (errorMessage && !note) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/notes"
          className="text-sm font-medium text-blue-700 transition hover:text-blue-900"
        >
          ← Back to notes
        </Link>

        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {errorMessage}
        </div>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/notes"
          className="text-sm font-medium text-blue-700 transition hover:text-blue-900"
        >
          ← Back to notes
        </Link>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-950">
            Note not found
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            The note may have been deleted or you may not have access.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <Link
          href={`/dashboard/notes/${note.id}`}
          className="text-sm font-medium text-blue-700 transition hover:text-blue-900"
        >
          ← Back to note detail
        </Link>

        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-blue-700">
            CRM Management
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            Edit note
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Update note content, importance, source, or linked CRM records.
          </p>
        </div>
      </section>

      {errorMessage ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <NoteForm
        companies={companies}
        contacts={contacts}
        leads={leads}
        initialValues={getNoteInitialValues(note)}
        submitLabel="Save changes"
        isSubmitting={isSubmitting}
        onSubmit={handleUpdateNote}
      />
    </div>
  );
}