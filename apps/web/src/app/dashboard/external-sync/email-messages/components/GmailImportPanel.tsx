'use client';

import { FormEvent, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { useI18n } from '@/i18n/useI18n';
import {
  ApiClientError,
  importSelectedExternalEmailMessages,
  searchGmailMessagesPreview,
} from '@/lib/api-client';
import { formatDateTime } from '@/lib/formatters';
import type { GmailSearchPreviewMessage } from '@/types/external-sync';

type GmailImportPanelProps = {
  token: string | null;
  canRunWriteActions: boolean;
  onImported: () => Promise<void> | void;
  onClose: () => void;
};

function formatSender(message: GmailSearchPreviewMessage) {
  if (message.senderName && message.senderEmail) {
    return `${message.senderName} <${message.senderEmail}>`;
  }

  return message.senderEmail ?? message.senderName;
}

function getFriendlyImportError(error: unknown, fallback: string) {
  if (error instanceof ApiClientError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

export function GmailImportPanel({
  token,
  canRunWriteActions,
  onImported,
  onClose,
}: GmailImportPanelProps) {
  const { t } = useI18n();
  const [searchText, setSearchText] = useState('');
  const [sender, setSender] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [maxResults, setMaxResults] = useState('10');
  const [previewMessages, setPreviewMessages] = useState<
    GmailSearchPreviewMessage[]
  >([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const selectableMessageIds = useMemo(
    () =>
      previewMessages
        .filter((message) => !message.alreadyImported || message.dismissed)
        .map((message) => message.providerMessageId),
    [previewMessages],
  );

  const selectedCount = selectedIds.length;

  function toggleSelected(messageId: string) {
    setSelectedIds((currentIds) =>
      currentIds.includes(messageId)
        ? currentIds.filter((currentId) => currentId !== messageId)
        : [...currentIds, messageId],
    );
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !canRunWriteActions) {
      return;
    }

    setIsSearching(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setSelectedIds([]);

    try {
      const result = await searchGmailMessagesPreview(token, {
        searchText: searchText.trim() || undefined,
        sender: sender.trim() || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        maxResults: Number(maxResults) || undefined,
      });

      setPreviewMessages(result.messages);
    } catch (error) {
      setErrorMessage(
        getFriendlyImportError(error, t('syncedEmails.import.searchFailed')),
      );
    } finally {
      setIsSearching(false);
    }
  }

  async function handleImportSelected() {
    if (!token || !canRunWriteActions || selectedIds.length === 0) {
      return;
    }

    setIsImporting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const result = await importSelectedExternalEmailMessages(token, {
        providerMessageIds: selectedIds,
      });

      setSuccessMessage(
        `${t('syncedEmails.import.imported')}: ${result.imported}. ${t(
          'syncedEmails.import.restored',
        )}: ${result.restored}. ${t('syncedEmails.import.alreadyImported')}: ${
          result.alreadyExisting
        }. ${t('syncedEmails.import.skipped')}: ${result.skipped}.`,
      );
      setPreviewMessages((currentMessages) =>
        currentMessages.map((message) =>
          selectedIds.includes(message.providerMessageId)
            ? { ...message, alreadyImported: true, dismissed: false }
            : message,
        ),
      );
      setSelectedIds([]);
      await onImported();
    } catch (error) {
      setErrorMessage(
        getFriendlyImportError(error, t('syncedEmails.import.importFailed')),
      );
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <section className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5 shadow-sm">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
        <div>
          <p className="text-sm font-medium text-blue-700">
            {t('syncedEmails.import.title')}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">
            {t('syncedEmails.import.heading')}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            {t('syncedEmails.import.description')}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-50"
        >
          {t('common.actions.hide')}
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {[
          t('externalSync.safety.emailMetadataOnly'),
          t('externalSync.safety.noEmailSent'),
          t('externalSync.safety.noCrmRecords'),
        ].map((message) => (
          <div
            key={message}
            className="rounded-xl border border-blue-100 bg-white p-3 text-sm font-medium text-blue-900"
          >
            {message}
          </div>
        ))}
      </div>

      <form
        onSubmit={handleSearch}
        className="mt-5 grid gap-4 rounded-2xl border border-blue-100 bg-white p-4 md:grid-cols-2 xl:grid-cols-5"
      >
        <label className="space-y-2 xl:col-span-2">
          <span className="text-sm font-medium text-slate-700">
            {t('syncedEmails.import.searchText')}
          </span>
          <input
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">
            {t('syncedEmails.import.sender')}
          </span>
          <input
            value={sender}
            onChange={(event) => setSender(event.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">
            {t('syncedEmails.import.fromDate')}
          </span>
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">
            {t('syncedEmails.import.toDate')}
          </span>
          <input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">
            {t('syncedEmails.import.maxResults')}
          </span>
          <input
            type="number"
            min={1}
            max={25}
            value={maxResults}
            onChange={(event) => setMaxResults(event.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          />
        </label>

        <div className="flex items-end gap-2 md:col-span-2 xl:col-span-4">
          <button
            type="submit"
            disabled={isSearching || !canRunWriteActions}
            className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSearching
              ? t('syncedEmails.import.searching')
              : t('common.actions.search')}
          </button>

          <button
            type="button"
            onClick={handleImportSelected}
            disabled={
              isImporting ||
              isSearching ||
              selectedCount === 0 ||
              !canRunWriteActions
            }
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isImporting
              ? t('syncedEmails.import.importing')
              : `${t('syncedEmails.import.importSelected')} (${selectedCount})`}
          </button>
        </div>
      </form>

      {errorMessage ? (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-800">
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
          {successMessage}
        </div>
      ) : null}

      {previewMessages.length > 0 ? (
        <div className="mt-5 space-y-3">
          <div className="flex items-center justify-between text-sm text-slate-600">
            <span>
              {previewMessages.length} {t('syncedEmails.import.previewResults')}
            </span>
            <span>
              {selectableMessageIds.length}{' '}
              {t('syncedEmails.import.selectableResults')}
            </span>
          </div>

          {previewMessages.map((message) => {
            const canSelect = !message.alreadyImported || message.dismissed;
            const isSelected = selectedIds.includes(message.providerMessageId);

            return (
              <article
                key={message.providerMessageId}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={!canSelect}
                      onChange={() => toggleSelected(message.providerMessageId)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600"
                    />
                    <span className="sr-only">
                      {t('syncedEmails.import.selectEmail')}
                    </span>
                  </label>

                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {message.alreadyImported ? (
                        <Badge className="bg-slate-100 text-slate-700 ring-slate-200">
                          {t('syncedEmails.import.alreadyImported')}
                        </Badge>
                      ) : null}

                      {message.dismissed ? (
                        <Badge className="bg-amber-50 text-amber-700 ring-amber-200">
                          {t('syncedEmails.view.dismissed')}
                        </Badge>
                      ) : null}
                    </div>

                    <h3 className="break-words text-sm font-semibold text-slate-950">
                      {message.subject ?? t('common.emptyStates.noSubject')}
                    </h3>
                    <p className="break-words text-xs text-slate-500">
                      {formatSender(message) ??
                        t('common.emptyStates.unknownSender')}
                    </p>
                    <p className="line-clamp-2 text-sm leading-6 text-slate-600">
                      {message.snippet ?? t('common.emptyStates.noSnippet')}
                    </p>
                    <p className="text-xs text-slate-500">
                      {message.internalDate
                        ? formatDateTime(message.internalDate)
                        : t('common.emptyStates.notSet')}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
