import type {
  ImportanceLevel,
  LeadStatus,
  Priority,
  TaskStatus,
} from '@/types/crm';

export function getImportanceClasses(value: ImportanceLevel) {
  const classes: Record<ImportanceLevel, string> = {
    LOW: 'bg-slate-100 text-slate-700 ring-slate-200',
    MEDIUM: 'bg-blue-50 text-blue-700 ring-blue-200',
    HIGH: 'bg-amber-50 text-amber-700 ring-amber-200',
    CRITICAL: 'bg-red-50 text-red-700 ring-red-200',
  };

  return classes[value];
}

export function getPriorityClasses(value: Priority) {
  const classes: Record<Priority, string> = {
    LOW: 'bg-slate-100 text-slate-700 ring-slate-200',
    MEDIUM: 'bg-blue-50 text-blue-700 ring-blue-200',
    HIGH: 'bg-amber-50 text-amber-700 ring-amber-200',
    CRITICAL: 'bg-red-50 text-red-700 ring-red-200',
  };

  return classes[value];
}

export function getLeadStatusClasses(value: LeadStatus) {
  const classes: Record<LeadStatus, string> = {
    NEW: 'bg-slate-100 text-slate-700 ring-slate-200',
    CONTACTED: 'bg-blue-50 text-blue-700 ring-blue-200',
    MEETING_SCHEDULED: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
    PROPOSAL_SENT: 'bg-purple-50 text-purple-700 ring-purple-200',
    NEGOTIATION: 'bg-amber-50 text-amber-700 ring-amber-200',
    WON: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    LOST: 'bg-red-50 text-red-700 ring-red-200',
    ARCHIVED: 'bg-slate-100 text-slate-500 ring-slate-200',
  };

  return classes[value];
}

export function getTaskStatusClasses(value: TaskStatus) {
  const classes: Record<TaskStatus, string> = {
    TODO: 'bg-slate-100 text-slate-700 ring-slate-200',
    IN_PROGRESS: 'bg-blue-50 text-blue-700 ring-blue-200',
    COMPLETED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    CANCELLED: 'bg-red-50 text-red-700 ring-red-200',
    ARCHIVED: 'bg-slate-100 text-slate-500 ring-slate-200',
  };

  return classes[value];
}

export function getBooleanStatusClasses(isActive: boolean) {
  return isActive
    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
    : 'bg-slate-100 text-slate-600 ring-slate-200';
}