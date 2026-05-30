'use client';

import { FormEvent, useEffect, useState } from 'react';

import { importanceOptions, sourceOptions } from '@/lib/crm-options';
import {
  getImportanceLabel,
  getSourceLabel,
} from '@/i18n/ai-display';
import { useI18n } from '@/i18n/useI18n';
import type {
  Company,
  Contact,
  CreateNoteInput,
  ImportanceLevel,
  Lead,
  Source,
} from '@/types/crm';

type NoteFormProps = {
  companies: Company[];
  contacts: Contact[];
  leads: Lead[];
  initialValues?: Partial<CreateNoteInput>;
  submitLabel: string;
  isSubmitting: boolean;
  onSubmit: (values: CreateNoteInput) => Promise<void>;
};

function cleanOptionalValue(value: string) {
  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

export function NoteForm({
  companies,
  contacts,
  leads,
  initialValues,
  submitLabel,
  isSubmitting,
  onSubmit,
}: NoteFormProps) {
  const { t } = useI18n();
  const [title, setTitle] = useState(initialValues?.title ?? '');
  const [content, setContent] = useState(initialValues?.content ?? '');
  const [companyId, setCompanyId] = useState(initialValues?.companyId ?? '');
  const [contactId, setContactId] = useState(initialValues?.contactId ?? '');
  const [leadId, setLeadId] = useState(initialValues?.leadId ?? '');
  const [importanceLevel, setImportanceLevel] = useState<ImportanceLevel>(
    initialValues?.importanceLevel ?? 'MEDIUM',
  );
  const [source, setSource] = useState<Source>(
    initialValues?.source ?? 'MANUAL',
  );

    useEffect(() => {
    if (initialValues) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const companyIdParam = params.get('companyId');
    const contactIdParam = params.get('contactId');
    const leadIdParam = params.get('leadId');

    if (companyIdParam) {
      setCompanyId(companyIdParam);
    }

    if (contactIdParam) {
      setContactId(contactIdParam);
    }

    if (leadIdParam) {
      setLeadId(leadIdParam);
    }
  }, [initialValues]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await onSubmit({
      title: cleanOptionalValue(title),
      content: content.trim(),
      companyId: cleanOptionalValue(companyId),
      contactId: cleanOptionalValue(contactId),
      leadId: cleanOptionalValue(leadId),
      importanceLevel,
      source,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div className="grid gap-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <label
            htmlFor="note-title"
            className="text-sm font-medium text-slate-700"
          >
            {t('crm.notes.titleLabel')}
          </label>
          <input
            id="note-title"
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            placeholder={t('crm.notes.titlePlaceholder')}
          />
          <p className="mt-1 text-xs text-slate-500">
            {t('crm.notes.titleHelp')}
          </p>
        </div>

        <div>
          <label
            htmlFor="note-company"
            className="text-sm font-medium text-slate-700"
          >
            {t('crm.common.company')}
          </label>
          <select
            id="note-company"
            value={companyId}
            onChange={(event) => setCompanyId(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          >
            <option value="">{t('crm.common.noCompany')}</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="note-contact"
            className="text-sm font-medium text-slate-700"
          >
            {t('crm.common.contact')}
          </label>
          <select
            id="note-contact"
            value={contactId}
            onChange={(event) => setContactId(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          >
            <option value="">{t('crm.common.noContact')}</option>
            {contacts.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contact.firstName} {contact.lastName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="note-lead"
            className="text-sm font-medium text-slate-700"
          >
            {t('crm.common.lead')}
          </label>
          <select
            id="note-lead"
            value={leadId}
            onChange={(event) => setLeadId(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          >
            <option value="">{t('crm.common.noLead')}</option>
            {leads.map((lead) => (
              <option key={lead.id} value={lead.id}>
                {lead.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="note-importance"
            className="text-sm font-medium text-slate-700"
          >
            {t('crm.common.importance')}
          </label>
          <select
            id="note-importance"
            value={importanceLevel}
            onChange={(event) =>
              setImportanceLevel(event.target.value as ImportanceLevel)
            }
            className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          >
            {importanceOptions.map((option) => (
              <option key={option} value={option}>
                {getImportanceLabel(option, t)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="note-source"
            className="text-sm font-medium text-slate-700"
          >
            {t('crm.common.source')}
          </label>
          <select
            id="note-source"
            value={source}
            onChange={(event) => setSource(event.target.value as Source)}
            className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          >
            {sourceOptions.map((option) => (
              <option key={option} value={option}>
                {getSourceLabel(option, t)}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label
            htmlFor="note-content"
            className="text-sm font-medium text-slate-700"
          >
            {t('crm.notes.content')}
          </label>
          <textarea
            id="note-content"
            required
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows={7}
            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            placeholder={t('crm.notes.contentPlaceholder')}
          />
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? t('common.actions.saving') : submitLabel}
        </button>
      </div>
    </form>
  );
}
