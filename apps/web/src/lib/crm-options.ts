import type {
  ImportanceLevel,
  LeadStatus,
  Priority,
  Source,
  TaskStatus,
} from '@/types/crm';

export const importanceOptions: ImportanceLevel[] = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
];

export const priorityOptions: Priority[] = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
];

export const sourceOptions: Source[] = [
  'MANUAL',
  'AI_SUGGESTION',
  'IMPORT',
  'EMAIL',
  'MEETING',
  'OTHER',
];

export const leadStatusOptions: LeadStatus[] = [
  'NEW',
  'CONTACTED',
  'MEETING_SCHEDULED',
  'PROPOSAL_SENT',
  'NEGOTIATION',
  'WON',
  'LOST',
  'ARCHIVED',
];

export const taskStatusOptions: TaskStatus[] = [
  'TODO',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'ARCHIVED',
];