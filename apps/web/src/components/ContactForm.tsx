'use client';

import { FormEvent, useState } from 'react';

import type {
  Company,
  CreateContactInput,
  ImportanceLevel,
  Source,
} from '@/types/crm';

type ContactFormValues = CreateContactInput;

type ContactFormProps = {
  companies: Company[];
  initialValues?: Partial<CreateContactInput>;
  submitLabel: string;
  isSubmitting: boolean;
  onSubmit: (values: ContactFormValues) => Promise<void>;
};

const importanceOptions: ImportanceLevel[] = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
];

const sourceOptions: Source[] = [
  'MANUAL',
  'AI_SUGGESTION',
  'IMPORT',
  'EMAIL',
  'MEETING',
  'OTHER',
];

function cleanOptionalValue(value: string) {
  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function ContactForm({
  companies,
  initialValues,
  submitLabel,
  isSubmitting,
  onSubmit,
}: ContactFormProps) {
  const [firstName, setFirstName] = useState(initialValues?.firstName ?? '');
  const [lastName, setLastName] = useState(initialValues?.lastName ?? '');
  const [email, setEmail] = useState(initialValues?.email ?? '');
  const [phone, setPhone] = useState(initialValues?.phone ?? '');
  const [companyId, setCompanyId] = useState(initialValues?.companyId ?? '');
  const [jobTitle, setJobTitle] = useState(initialValues?.jobTitle ?? '');
  const [linkedinUrl, setLinkedinUrl] = useState(
    initialValues?.linkedinUrl ?? '',
  );
  const [city, setCity] = useState(initialValues?.city ?? '');
  const [country, setCountry] = useState(initialValues?.country ?? '');
  const [expertise, setExpertise] = useState(initialValues?.expertise ?? '');
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
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: cleanOptionalValue(email),
      phone: cleanOptionalValue(phone),
      companyId: cleanOptionalValue(companyId),
      jobTitle: cleanOptionalValue(jobTitle),
      linkedinUrl: cleanOptionalValue(linkedinUrl),
      city: cleanOptionalValue(city),
      country: cleanOptionalValue(country),
      notes: cleanOptionalValue(notes),
      expertise: cleanOptionalValue(expertise),
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
        <div>
          <label
            htmlFor="contact-first-name"
            className="text-sm font-medium text-slate-700"
          >
            First name
          </label>
          <input
            id="contact-first-name"
            type="text"
            required
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            placeholder="Jane"
          />
        </div>

        <div>
          <label
            htmlFor="contact-last-name"
            className="text-sm font-medium text-slate-700"
          >
            Last name
          </label>
          <input
            id="contact-last-name"
            type="text"
            required
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            placeholder="Doe"
          />
        </div>

        <div>
          <label
            htmlFor="contact-email"
            className="text-sm font-medium text-slate-700"
          >
            Email
          </label>
          <input
            id="contact-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            placeholder="jane@example.com"
          />
        </div>

        <div>
          <label
            htmlFor="contact-phone"
            className="text-sm font-medium text-slate-700"
          >
            Phone
          </label>
          <input
            id="contact-phone"
            type="text"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            placeholder="+57 300 000 0000"
          />
        </div>

        <div>
          <label
            htmlFor="contact-company"
            className="text-sm font-medium text-slate-700"
          >
            Company
          </label>
          <select
            id="contact-company"
            value={companyId}
            onChange={(event) => setCompanyId(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          >
            <option value="">No company</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="contact-job-title"
            className="text-sm font-medium text-slate-700"
          >
            Job title
          </label>
          <input
            id="contact-job-title"
            type="text"
            value={jobTitle}
            onChange={(event) => setJobTitle(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            placeholder="Sales Manager"
          />
        </div>

        <div>
          <label
            htmlFor="contact-linkedin"
            className="text-sm font-medium text-slate-700"
          >
            LinkedIn URL
          </label>
          <input
            id="contact-linkedin"
            type="url"
            value={linkedinUrl}
            onChange={(event) => setLinkedinUrl(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            placeholder="https://linkedin.com/in/example"
          />
        </div>

        <div>
          <label
            htmlFor="contact-expertise"
            className="text-sm font-medium text-slate-700"
          >
            Expertise
          </label>
          <input
            id="contact-expertise"
            type="text"
            value={expertise}
            onChange={(event) => setExpertise(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            placeholder="Marketing, procurement, operations..."
          />
        </div>

        <div>
          <label
            htmlFor="contact-city"
            className="text-sm font-medium text-slate-700"
          >
            City
          </label>
          <input
            id="contact-city"
            type="text"
            value={city}
            onChange={(event) => setCity(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            placeholder="Bogota"
          />
        </div>

        <div>
          <label
            htmlFor="contact-country"
            className="text-sm font-medium text-slate-700"
          >
            Country
          </label>
          <input
            id="contact-country"
            type="text"
            value={country}
            onChange={(event) => setCountry(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            placeholder="Colombia"
          />
        </div>

        <div>
          <label
            htmlFor="contact-importance"
            className="text-sm font-medium text-slate-700"
          >
            Importance
          </label>
          <select
            id="contact-importance"
            value={importanceLevel}
            onChange={(event) =>
              setImportanceLevel(event.target.value as ImportanceLevel)
            }
            className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          >
            {importanceOptions.map((option) => (
              <option key={option} value={option}>
                {formatEnumLabel(option)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="contact-source"
            className="text-sm font-medium text-slate-700"
          >
            Source
          </label>
          <select
            id="contact-source"
            value={source}
            onChange={(event) => setSource(event.target.value as Source)}
            className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          >
            {sourceOptions.map((option) => (
              <option key={option} value={option}>
                {formatEnumLabel(option)}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label
            htmlFor="contact-notes"
            className="text-sm font-medium text-slate-700"
          >
            Notes
          </label>
          <textarea
            id="contact-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={5}
            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            placeholder="Internal notes about this contact..."
          />
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  );
}