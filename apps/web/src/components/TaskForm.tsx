'use client';

import { FormEvent, useEffect, useState } from 'react';

import {
  importanceOptions,
  priorityOptions,
  taskStatusOptions,
} from '@/lib/crm-options';
import { formatEnumLabel } from '@/lib/formatters';
import type {
  Contact,
  CreateTaskInput,
  ImportanceLevel,
  Lead,
  Priority,
  TaskStatus,
} from '@/types/crm';
import type { CurrentUser } from '@/types/user';

type TaskFormProps = {
  leads: Lead[];
  contacts: Contact[];
  currentUser: CurrentUser | null;
  initialValues?: Partial<CreateTaskInput>;
  submitLabel: string;
  isSubmitting: boolean;
  onSubmit: (values: CreateTaskInput) => Promise<void>;
};

function cleanOptionalValue(value: string) {
  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

function cleanOptionalDate(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return undefined;
  }

  return new Date(`${trimmedValue}T00:00:00.000Z`).toISOString();
}

export function TaskForm({
  leads,
  contacts,
  currentUser,
  initialValues,
  submitLabel,
  isSubmitting,
  onSubmit,
}: TaskFormProps) {
  const [title, setTitle] = useState(initialValues?.title ?? '');
  const [description, setDescription] = useState(
    initialValues?.description ?? '',
  );
  const [leadId, setLeadId] = useState(initialValues?.leadId ?? '');
  const [contactId, setContactId] = useState(initialValues?.contactId ?? '');
  const [assignedToUserId, setAssignedToUserId] = useState(
    initialValues?.assignedToUserId ?? '',
  );
  const [status, setStatus] = useState<TaskStatus>(
    initialValues?.status ?? 'TODO',
  );
  const [priority, setPriority] = useState<Priority>(
    initialValues?.priority ?? 'MEDIUM',
  );
  const [importanceLevel, setImportanceLevel] = useState<ImportanceLevel>(
    initialValues?.importanceLevel ?? 'MEDIUM',
  );
  const [dueDate, setDueDate] = useState(
    initialValues?.dueDate?.slice(0, 10) ?? '',
  );

    useEffect(() => {
    if (initialValues) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const leadIdParam = params.get('leadId');
    const contactIdParam = params.get('contactId');

    if (leadIdParam) {
      setLeadId(leadIdParam);
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
      leadId: cleanOptionalValue(leadId),
      contactId: cleanOptionalValue(contactId),
      assignedToUserId: cleanOptionalValue(assignedToUserId),
      status,
      priority,
      importanceLevel,
      dueDate: cleanOptionalDate(dueDate),
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
            htmlFor="task-title"
            className="text-sm font-medium text-slate-700"
          >
            Task title
          </label>
          <input
            id="task-title"
            type="text"
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            placeholder="Follow up with client"
          />
        </div>

        <div>
          <label
            htmlFor="task-lead"
            className="text-sm font-medium text-slate-700"
          >
            Lead
          </label>
          <select
            id="task-lead"
            value={leadId}
            onChange={(event) => setLeadId(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          >
            <option value="">No lead</option>
            {leads.map((lead) => (
              <option key={lead.id} value={lead.id}>
                {lead.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="task-contact"
            className="text-sm font-medium text-slate-700"
          >
            Contact
          </label>
          <select
            id="task-contact"
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
            htmlFor="task-status"
            className="text-sm font-medium text-slate-700"
          >
            Status
          </label>
          <select
            id="task-status"
            value={status}
            onChange={(event) => setStatus(event.target.value as TaskStatus)}
            className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          >
            {taskStatusOptions.map((option) => (
              <option key={option} value={option}>
                {formatEnumLabel(option)}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            Moving a task to Completed will let the backend set completedAt.
          </p>
        </div>

        <div>
          <label
            htmlFor="task-priority"
            className="text-sm font-medium text-slate-700"
          >
            Priority
          </label>
          <select
            id="task-priority"
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
            htmlFor="task-importance"
            className="text-sm font-medium text-slate-700"
          >
            Importance
          </label>
          <select
            id="task-importance"
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
            htmlFor="task-due-date"
            className="text-sm font-medium text-slate-700"
          >
            Due date
          </label>
          <input
            id="task-due-date"
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          />
        </div>

        <div>
          <label
            htmlFor="task-assignee"
            className="text-sm font-medium text-slate-700"
          >
            Assignee
          </label>
          <select
            id="task-assignee"
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
            htmlFor="task-description"
            className="text-sm font-medium text-slate-700"
          >
            Description
          </label>
          <textarea
            id="task-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={5}
            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            placeholder="Describe the task..."
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