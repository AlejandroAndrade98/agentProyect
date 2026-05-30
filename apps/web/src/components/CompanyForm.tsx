'use client';

import { FormEvent, useState } from 'react';

import { importanceOptions, sourceOptions } from '@/lib/crm-options';
import { getImportanceLabel, getSourceLabel } from '@/i18n/ai-display';
import { useI18n } from '@/i18n/useI18n';
import type { CreateCompanyInput, ImportanceLevel, Source } from '@/types/crm';

type CompanyFormValues = {
  name: string;
  website?: string;
  industry?: string;
  city?: string;
  country?: string;
  notes?: string;
  importanceLevel: ImportanceLevel;
  source: Source;
};

type CompanyFormProps = {
  initialValues?: Partial<CreateCompanyInput>;
  submitLabel: string;
  isSubmitting: boolean;
  onSubmit: (values: CompanyFormValues) => Promise<void>;
};

function cleanOptionalValue(value: string) {
  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

export function CompanyForm({
  initialValues,
  submitLabel,
  isSubmitting,
  onSubmit,
}: CompanyFormProps) {
  const { t } = useI18n();
  const [name, setName] = useState(initialValues?.name ?? '');
  const [website, setWebsite] = useState(initialValues?.website ?? '');
  const [industry, setIndustry] = useState(initialValues?.industry ?? '');
  const [city, setCity] = useState(initialValues?.city ?? '');
  const [country, setCountry] = useState(initialValues?.country ?? '');
  const [notes, setNotes] = useState(initialValues?.notes ?? '');
  const [importanceLevel, setImportanceLevel] = useState<ImportanceLevel>(
    initialValues?.importanceLevel ?? 'MEDIUM',
  );
  const [source, setSource] = useState<Source>(
    initialValues?.source ?? 'MANUAL',
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await onSubmit({
      name: name.trim(),
      website: cleanOptionalValue(website),
      industry: cleanOptionalValue(industry),
      city: cleanOptionalValue(city),
      country: cleanOptionalValue(country),
      notes: cleanOptionalValue(notes),
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
            htmlFor="company-name"
            className="text-sm font-medium text-slate-700"
          >
            {t('crm.companies.companyName')}
          </label>
          <input
            id="company-name"
            type="text"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            placeholder="Example Company"
          />
        </div>

        <div>
          <label
            htmlFor="company-website"
            className="text-sm font-medium text-slate-700"
          >
            {t('crm.companies.website')}
          </label>
          <input
            id="company-website"
            type="url"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            placeholder="https://example.com"
          />
          <p className="mt-1 text-xs text-slate-500">
            {t('crm.companies.websiteHelp')}
          </p>
        </div>

        <div>
          <label
            htmlFor="company-industry"
            className="text-sm font-medium text-slate-700"
          >
            {t('crm.companies.industry')}
          </label>
          <input
            id="company-industry"
            type="text"
            value={industry}
            onChange={(event) => setIndustry(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            placeholder="Advertising, SaaS, Retail..."
          />
        </div>

        <div>
          <label
            htmlFor="company-city"
            className="text-sm font-medium text-slate-700"
          >
            {t('crm.common.city')}
          </label>
          <input
            id="company-city"
            type="text"
            value={city}
            onChange={(event) => setCity(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            placeholder="Bogota"
          />
        </div>

        <div>
          <label
            htmlFor="company-country"
            className="text-sm font-medium text-slate-700"
          >
            {t('crm.common.country')}
          </label>
          <input
            id="company-country"
            type="text"
            value={country}
            onChange={(event) => setCountry(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            placeholder="Colombia"
          />
        </div>

        <div>
          <label
            htmlFor="company-importance"
            className="text-sm font-medium text-slate-700"
          >
            {t('crm.common.importance')}
          </label>
          <select
            id="company-importance"
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
            htmlFor="company-source"
            className="text-sm font-medium text-slate-700"
          >
            {t('crm.common.source')}
          </label>
          <select
            id="company-source"
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
            htmlFor="company-notes"
            className="text-sm font-medium text-slate-700"
          >
            {t('crm.common.notes')}
          </label>
          <textarea
            id="company-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={5}
            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            placeholder={t('crm.companies.notesPlaceholder')}
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
