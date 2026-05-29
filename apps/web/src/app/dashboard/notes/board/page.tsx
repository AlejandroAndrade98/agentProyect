'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import { useAuth } from '@/hooks/useAuth';
import { ApiClientError, getNotes } from '@/lib/api-client';
import { sourceOptions } from '@/lib/crm-options';
import { getImportanceClasses } from '@/lib/crm-styles';
import { formatDate, formatEnumLabel, truncateText } from '@/lib/formatters';
import { canCreateCrm } from '@/lib/permissions';
import type { Note, Source } from '@/types/crm';

const BOARD_PAGE_SIZE = 5;

type NotesColumnState = {
  items: Note[];
  total: number;
  totalPages: number;
  isLoading: boolean;
  errorMessage: string | null;
};

type NotesColumnPages = Record<Source, number>;
type NotesColumns = Record<Source, NotesColumnState>;

function createInitialColumnPages() {
  return sourceOptions.reduce((accumulator, source) => {
    accumulator[source] = 1;

    return accumulator;
  }, {} as NotesColumnPages);
}

function createInitialColumns() {
  return sourceOptions.reduce((accumulator, source) => {
    accumulator[source] = {
      items: [],
      total: 0,
      totalPages: 1,
      isLoading: true,
      errorMessage: null,
    };

    return accumulator;
  }, {} as NotesColumns);
}

function getSourceColumnTitle(source: Source) {
  if (source === 'AI_SUGGESTION') {
    return 'AI Suggestion';
  }

  return formatEnumLabel(source);
}

function getSourceBadgeClasses(source: Source) {
  const classes: Record<Source, string> = {
    MANUAL: 'bg-slate-100 text-slate-700 ring-slate-200',
    AI_SUGGESTION: 'bg-blue-50 text-blue-700 ring-blue-200',
    IMPORT: 'bg-purple-50 text-purple-700 ring-purple-200',
    EMAIL: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
    MEETING: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    OTHER: 'bg-slate-100 text-slate-600 ring-slate-200',
  };

  return classes[source];
}

function getLinkedLabel(note: Note) {
  if (note.lead) return `Lead: ${note.lead.title}`;
  if (note.contact) {
    return `Contact: ${note.contact.firstName} ${note.contact.lastName}`;
  }
  if (note.company) return `Company: ${note.company.name}`;
  if (note.leadId) return 'Lead';
  if (note.contactId) return 'Contact';
  if (note.companyId) return 'Company';

  return 'Unlinked';
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiClientError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

function NoteCard({ note }: { note: Note }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="space-y-3">
        <div>
          <Link
            href={`/dashboard/notes/${note.id}`}
            className="text-sm font-semibold leading-5 text-slate-950 transition hover:text-blue-700"
          >
            {note.title ?? 'Untitled note'}
          </Link>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            {truncateText(note.content, 140) || 'No content'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge className={getSourceBadgeClasses(note.source)}>
            {note.source === 'AI_SUGGESTION'
              ? 'AI suggestion'
              : formatEnumLabel(note.source)}
          </Badge>
          <Badge className={getImportanceClasses(note.importanceLevel)}>
            {formatEnumLabel(note.importanceLevel)}
          </Badge>
        </div>

        <div className="space-y-1 text-xs text-slate-500">
          <p>{getLinkedLabel(note)}</p>
          <p>Created {formatDate(note.createdAt)}</p>
        </div>

        <Link
          href={`/dashboard/notes/${note.id}`}
          className="inline-flex text-xs font-medium text-blue-700 transition hover:text-blue-900"
        >
          View record
        </Link>
      </div>
    </article>
  );
}

export default function NotesBoardPage() {
  const { token, user } = useAuth();
  const [columnPages, setColumnPages] = useState<NotesColumnPages>(() =>
    createInitialColumnPages(),
  );
  const [columns, setColumns] = useState<NotesColumns>(() =>
    createInitialColumns(),
  );

  const loadColumn = useCallback(
    async (source: Source, page: number) => {
      if (!token) {
        setColumns((currentColumns) => ({
          ...currentColumns,
          [source]: {
            ...currentColumns[source],
            isLoading: false,
          },
        }));
        return;
      }

      setColumns((currentColumns) => ({
        ...currentColumns,
        [source]: {
          ...currentColumns[source],
          isLoading: true,
          errorMessage: null,
        },
      }));

      try {
        const response = await getNotes(token, {
          page,
          pageSize: BOARD_PAGE_SIZE,
          source,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        });

        setColumns((currentColumns) => ({
          ...currentColumns,
          [source]: {
            items: response.data,
            total: response.meta.total,
            totalPages: response.meta.totalPages || 1,
            isLoading: false,
            errorMessage: null,
          },
        }));
      } catch (error) {
        setColumns((currentColumns) => ({
          ...currentColumns,
          [source]: {
            ...currentColumns[source],
            isLoading: false,
            errorMessage: getErrorMessage(
              error,
              `Could not load ${getSourceColumnTitle(source)} notes.`,
            ),
          },
        }));
      }
    },
    [token],
  );

  useEffect(() => {
    sourceOptions.forEach((source) => {
      void loadColumn(source, columnPages[source]);
    });
  }, [columnPages, loadColumn]);

  const totalNotes = sourceOptions.reduce(
    (total, source) => total + columns[source].total,
    0,
  );
  const isInitialLoading = sourceOptions.every(
    (source) => columns[source].isLoading,
  );
  const hasErrors = sourceOptions.some(
    (source) => columns[source].errorMessage,
  );

  function setColumnPage(source: Source, page: number) {
    setColumnPages((currentPages) => ({
      ...currentPages,
      [source]: page,
    }));
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Notes Board"
        description="Browse notes visually by source. This board is read-only and does not change note source, importance, or linked records."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/notes/list"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              List view
            </Link>

            {canCreateCrm(user) ? (
              <Link
                href="/dashboard/notes/new"
                className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
              >
                New note
              </Link>
            ) : null}
          </div>
        }
      />

      {isInitialLoading ? <LoadingSkeleton rows={8} /> : null}

      {!isInitialLoading && totalNotes === 0 && !hasErrors ? (
        <EmptyState
          title="No notes found"
          description="Create your first note to start documenting commercial context."
        />
      ) : null}

      {!isInitialLoading && (totalNotes > 0 || hasErrors) ? (
        <section className="overflow-x-auto pb-3">
          <div className="grid min-w-[1500px] gap-4 xl:grid-cols-6">
            {sourceOptions.map((source) => {
              const column = columns[source];
              const currentPage = columnPages[source];

              return (
                <div
                  key={source}
                  className="flex min-h-[620px] flex-col rounded-2xl border border-slate-200 bg-slate-50"
                >
                  <div className="border-b border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <Badge className={getSourceBadgeClasses(source)}>
                        {getSourceColumnTitle(source)}
                      </Badge>
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200">
                        {column.total}
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 space-y-3 p-3">
                    {column.isLoading ? (
                      Array.from({ length: 3 }).map((_, index) => (
                        <div
                          key={index}
                          className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white"
                        />
                      ))
                    ) : null}

                    {!column.isLoading && column.errorMessage ? (
                      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                        <p>{column.errorMessage}</p>
                        <button
                          type="button"
                          onClick={() => void loadColumn(source, currentPage)}
                          className="mt-3 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-50"
                        >
                          Retry
                        </button>
                      </div>
                    ) : null}

                    {!column.isLoading &&
                    !column.errorMessage &&
                    column.items.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-sm text-slate-500">
                        No {getSourceColumnTitle(source).toLowerCase()} notes
                      </div>
                    ) : null}

                    {!column.isLoading && !column.errorMessage
                      ? column.items.map((note) => (
                          <NoteCard key={note.id} note={note} />
                        ))
                      : null}
                  </div>

                  <div className="border-t border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        disabled={currentPage <= 1 || column.isLoading}
                        onClick={() => setColumnPage(source, currentPage - 1)}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Previous
                      </button>

                      <span className="text-xs text-slate-500">
                        Page {currentPage} of {column.totalPages}
                      </span>

                      <button
                        type="button"
                        disabled={
                          currentPage >= column.totalPages || column.isLoading
                        }
                        onClick={() => setColumnPage(source, currentPage + 1)}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
