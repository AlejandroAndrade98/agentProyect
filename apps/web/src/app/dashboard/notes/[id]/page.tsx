'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { ErrorState } from '@/components/ui/ErrorState';
import { LongTextCard } from '@/components/ui/LongTextCard';
import { useAuth } from '@/hooks/useAuth';
import {
  getImportanceLabel,
  getSourceLabel,
} from '@/i18n/ai-display';
import { useI18n } from '@/i18n/useI18n';
import { ApiClientError, deleteNote, getNoteById } from '@/lib/api-client';
import { getImportanceClasses } from '@/lib/crm-styles';
import { formatDate } from '@/lib/formatters';
import { canDeleteCrm } from '@/lib/permissions';
import type { NoteDetail } from '@/types/crm';

export default function NoteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { token, user } = useAuth();
  const { t } = useI18n();

  const noteId =
    typeof params.id === 'string'
      ? params.id
      : Array.isArray(params.id)
        ? params.id[0]
        : '';

  const [note, setNote] = useState<NoteDetail | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadNote() {
      if (!token || !noteId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await getNoteById(token, noteId, {
          include: 'company,contact,lead,createdBy',
        });

        if (!isMounted) {
          return;
        }

        setNote(response);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (error instanceof ApiClientError) {
          setErrorMessage(error.message);
        } else if (error instanceof Error) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage(t('crm.notes.loadFailed'));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadNote();

    return () => {
      isMounted = false;
    };
  }, [token, noteId, t]);

  const canDeleteNote = canDeleteCrm(user);

  async function handleDeleteNote() {
    if (!token || !noteId || !note) {
      setErrorMessage(t('crm.common.sessionNotReady'));
      return;
    }

    const confirmed = window.confirm(
      `${t('crm.notes.deleteConfirmPrefix')} "${
        note.title ?? t('crm.common.untitledNote')
      }"? ${t('crm.notes.deleteConfirmSuffix')}`,
    );

    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setErrorMessage(null);

    try {
      await deleteNote(token, noteId);
      router.push('/dashboard/notes');
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage(t('crm.notes.deleteFailed'));
      }
    } finally {
      setIsDeleting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-52 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/notes"
          className="text-sm font-medium text-blue-700 transition hover:text-blue-900"
        >
          ← {t('crm.common.backToNotes')}
        </Link>

        <ErrorState message={errorMessage} />
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
          ← {t('crm.common.backToNotes')}
        </Link>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-950">
            {t('crm.notes.notFound')}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {t('crm.notes.notFoundDescription')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <Link
          href="/dashboard/notes"
          className="text-sm font-medium text-blue-700 transition hover:text-blue-900"
        >
          ← {t('crm.common.backToNotes')}
        </Link>

        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-blue-700">
              {t('crm.notes.detail')}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              {note.title ?? t('crm.common.untitledNote')}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              {t('crm.notes.detailDescription')}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/dashboard/notes/${note.id}/edit`}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              {t('common.actions.edit')}
            </Link>

            {canDeleteNote ? (
              <button
                type="button"
                onClick={handleDeleteNote}
                disabled={isDeleting}
                className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeleting
                  ? t('crm.common.deleting')
                  : t('crm.common.delete')}
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-6 lg:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('crm.common.importance')}
            </p>
            <div className="mt-2">
              <Badge className={getImportanceClasses(note.importanceLevel)}>
                {getImportanceLabel(note.importanceLevel, t)}
              </Badge>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('crm.common.source')}
            </p>
            <div className="mt-2">
              {note.source === 'AI_SUGGESTION' ? (
                <Badge className="border-blue-200 bg-blue-50 text-blue-700">
                  {getSourceLabel(note.source, t)}
                </Badge>
              ) : (
                <p className="text-sm text-slate-950">
                  {getSourceLabel(note.source, t)}
                </p>
              )}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('crm.notes.createdBy')}
            </p>
            <p className="mt-2 text-sm text-slate-950">
              {note.createdBy?.name ??
                note.createdBy?.email ??
                t('crm.notes.unknownAuthor')}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('crm.common.company')}
            </p>
            {note.company ? (
              <Link
                href={`/dashboard/companies/${note.company.id}`}
                className="mt-2 block text-sm font-medium text-blue-700 hover:text-blue-900"
              >
                {note.company.name}
              </Link>
            ) : (
              <p className="mt-2 text-sm text-slate-600">
                {t('crm.common.notLinked')}
              </p>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('crm.common.contact')}
            </p>
            {note.contact ? (
              <Link
                href={`/dashboard/contacts/${note.contact.id}`}
                className="mt-2 block text-sm font-medium text-blue-700 hover:text-blue-900"
              >
                {note.contact.firstName} {note.contact.lastName}
              </Link>
            ) : (
              <p className="mt-2 text-sm text-slate-600">
                {t('crm.common.notLinked')}
              </p>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('crm.common.lead')}
            </p>
            {note.lead ? (
              <Link
                href={`/dashboard/leads/${note.lead.id}`}
                className="mt-2 block text-sm font-medium text-blue-700 hover:text-blue-900"
              >
                {note.lead.title}
              </Link>
            ) : (
              <p className="mt-2 text-sm text-slate-600">
                {t('crm.common.notLinked')}
              </p>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('crm.common.created')}
            </p>
            <p className="mt-2 text-sm text-slate-950">
              {formatDate(note.createdAt)}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('crm.common.updated')}
            </p>
            <p className="mt-2 text-sm text-slate-950">
              {formatDate(note.updatedAt)}
            </p>
          </div>
        </div>

      </section>

      {note.source === 'AI_SUGGESTION' ? (
        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
          <Badge className="border-blue-200 bg-white text-blue-700">
            {getSourceLabel(note.source, t)}
          </Badge>
          <p className="mt-3 text-sm leading-6 text-blue-900">
            {t('crm.notes.aiSafety')}
          </p>
        </section>
      ) : null}

      <LongTextCard title={t('crm.notes.content')} content={note.content} />
    </div>
  );
}
