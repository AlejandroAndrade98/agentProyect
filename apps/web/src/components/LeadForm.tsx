'use client';

import { FormEvent, useEffect, useState } from 'react';

import {
  importanceOptions,
  leadStatusOptions,
  priorityOptions,
  sourceOptions,
} from '@/lib/crm-options';
import { formatEnumLabel } from '@/lib/formatters';
import type {
  Company,
  Contact,
  CreateLeadInput,
  ImportanceLevel,
  LeadStatus,
  Priority,
  Source,
} from '@/types/crm';
import type { CurrentUser } from '@/types/user';

type LeadFormProps = {
  companies: Company[];
  contacts: Contact[];
  currentUser: CurrentUser | null;
  initialValues?: Partial<CreateLeadInput>;
  submitLabel: string;
  isSubmitting: boolean;
  onSubmit: (values: CreateLeadInput) => Promise<void>;
};

function cleanOptionalValue(value: string) {
  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

function cleanOptionalNumber(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return undefined;
  }

  const parsedValue = Number(trimmedValue);

  return Number.isFinite(parsedValue) ? parsedValue : undefined;
}

function cleanOptionalDate(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return undefined;
  }

  return new Date(`${trimmedValue}T00:00:00.000Z`).toISOString();
}

export function LeadForm({
  companies,
  contacts,
  currentUser,
  initialValues,
  submitLabel,
  isSubmitting,
  onSubmit,
}: LeadFormProps) {
  const [title, setTitle] = useState(initialValues?.title ?? '');
  const [description, setDescription] = useState(
    initialValues?.description ?? '',
  );
  const [companyId, setCompanyId] = useState(initialValues?.companyId ?? '');
  const [contactId, setContactId] = useState(initialValues?.contactId ?? '');
  const [assignedToUserId, setAssignedToUserId] = useState(
    initialValues?.assignedToUserId ?? '',
  );
  const [status, setStatus] = useState<LeadStatus>(
    initialValues?.status ?? 'NEW',
  );
  const [priority, setPriority] = useState<Priority>(
    initialValues?.priority ?? 'MEDIUM',
  );
  const [importanceLevel, setImportanceLevel] = useState<ImportanceLevel>(
    initialValues?.importanceLevel ?? 'MEDIUM',
  );
  const [source, setSource] = useState<Source>(
    initialValues?.source ?? 'MANUAL',
  );
  const [estimatedBudget, setEstimatedBudget] = useState(
    initialValues?.estimatedBudget?.toString() ?? '',
  );
  const [expectedCloseDate, setExpectedCloseDate] = useState(
    initialValues?.expectedCloseDate?.slice(0, 10) ?? '',
  );
  const [lastContactAt, setLastContactAt] = useState(
    initialValues?.lastContactAt?.slice(0, 10) ?? '',
  );
  const [nextStep, setNextStep] = useState(initialValues?.nextStep ?? '');

  useEffect(() => {
    if (initialValues) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const companyIdParam = params.get('companyId');
    const contactIdParam = params.get('contactId');

    if (companyIdParam) {
      setCompanyId(companyIdParam);
    }

    if (contactIdParam) {
      setContactId(contactIdParam);
    }
  }, [initialValues]);
  
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await onSubmit({
      title: title.trim(),
      description: cleanOptionalValue(description),
      companyId: cleanOptionalValue(companyId),
      contactId: cleanOptionalValue(contactId),
      assignedToUserId: cleanOptionalValue(assignedToUserId),
      status,
      priority,
      importanceLevel,
      source,
      estimatedBudget: cleanOptionalNumber(estimatedBudget),
      expectedCloseDate: cleanOptionalDate(expectedCloseDate),
      lastContactAt: cleanOptionalDate(lastContactAt),
      nextStep: cleanOptionalValue(nextStep),
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
            htmlFor="lead-title"
            className="text-sm font-medium text-slate-700"
          >
            Lead title
          </label>
          <input
            id="lead-title"
            type="text"
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            placeholder="Website redesign opportunity"
          />
        </div>

        <div>
          <label
            htmlFor="lead-company"
            className="text-sm font-medium text-slate-700"
          >
            Company
          </label>
          <select
            id="lead-company"
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
            htmlFor="lead-contact"
            className="text-sm font-medium text-slate-700"
          >
            Contact
          </label>
          <select
            id="lead-contact"
            value={contactId}
            onChange={(event) => setContactId(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          >
            <option value="">No contact</option>
            {contacts.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contact.firstName} {contact.lastName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="lead-status"
            className="text-sm font-medium text-slate-700"
          >
            Status
          </label>
          <select
            id="lead-status"
            value={status}
            onChange={(event) => setStatus(event.target.value as LeadStatus)}
            className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          >
            {leadStatusOptions.map((option) => (
              <option key={option} value={option}>
                {formatEnumLabel(option)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="lead-priority"
            className="text-sm font-medium text-slate-700"
          >
            Priority
          </label>
          <select
            id="lead-priority"
            value={priority}
            onChange={(event) => setPriority(event.target.value as Priority)}
            className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          >
            {priorityOptions.map((option) => (
              <option key={option} value={option}>
                {formatEnumLabel(option)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="lead-importance"
            className="text-sm font-medium text-slate-700"
          >
            Importance
          </label>
          <select
            id="lead-importance"
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
            htmlFor="lead-source"
            className="text-sm font-medium text-slate-700"
          >
            Source
          </label>
          <select
            id="lead-source"
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

        <div>
          <label
            htmlFor="lead-budget"
            className="text-sm font-medium text-slate-700"
          >
            Estimated budget
          </label>
          <input
            id="lead-budget"
            type="number"
            min="0"
            step="1"
            value={estimatedBudget}
            onChange={(event) => setEstimatedBudget(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            placeholder="5000000"
          />
        </div>

        <div>
          <label
            htmlFor="lead-expected-close"
            className="text-sm font-medium text-slate-700"
          >
            Expected close date
          </label>
          <input
            id="lead-expected-close"
            type="date"
            value={expectedCloseDate}
            onChange={(event) => setExpectedCloseDate(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          />
        </div>

        <div>
          <label
            htmlFor="lead-last-contact"
            className="text-sm font-medium text-slate-700"
          >
            Last contact date
          </label>
          <input
            id="lead-last-contact"
            type="date"
            value={lastContactAt}
            onChange={(event) => setLastContactAt(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          />
        </div>

        <div>
          <label
            htmlFor="lead-assignee"
            className="text-sm font-medium text-slate-700"
          >
            Assignee
          </label>
          <select
            id="lead-assignee"
            value={assignedToUserId}
            onChange={(event) => setAssignedToUserId(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          >
            <option value="">No assignee</option>
            {currentUser ? (
              <option value={currentUser.id}>
                {currentUser.name ?? currentUser.email}
              </option>
            ) : null}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            For now, only the current user can be selected from the frontend.
          </p>
        </div>

        <div className="md:col-span-2">
          <label
            htmlFor="lead-next-step"
            className="text-sm font-medium text-slate-700"
          >
            Next step
          </label>
          <input
            id="lead-next-step"
            type="text"
            value={nextStep}
            onChange={(event) => setNextStep(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            placeholder="Schedule discovery call"
          />
        </div>

        <div className="md:col-span-2">
          <label
            htmlFor="lead-description"
            className="text-sm font-medium text-slate-700"
          >
            Description
          </label>
          <textarea
            id="lead-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={5}
            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            placeholder="Describe the opportunity..."
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