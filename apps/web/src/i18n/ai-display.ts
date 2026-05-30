import { formatEnumLabel } from '@/lib/formatters';
import type {
  AiSuggestionStatus,
  AiSuggestionType,
} from '@/types/ai-suggestions';

export type Translate = (key: string) => string;

const statusKeys: Record<AiSuggestionStatus, string> = {
  PENDING_REVIEW: 'common.statuses.pendingReview',
  ACCEPTED: 'common.statuses.accepted',
  EDITED_AND_ACCEPTED: 'common.statuses.editedAndAccepted',
  REJECTED: 'common.statuses.rejected',
  EXPIRED: 'common.statuses.expired',
};

const typeKeys: Partial<Record<AiSuggestionType, string>> = {
  SUGGEST_NEXT_STEPS: 'common.types.leadNextSteps',
  ANALYZE_EXTERNAL_EMAIL: 'common.types.emailAnalysis',
  GENERATE_EMAIL_REPLY_DRAFT: 'common.types.emailReplyDraft',
  ANALYZE_EXTERNAL_CALENDAR_EVENT: 'common.types.calendarAnalysis',
  ANALYZE_MESSAGE: 'common.types.messageAnalysis',
  GENERATE_REPLY: 'common.types.replyGeneration',
  EXTRACT_IMPORTANT_DATA: 'common.types.dataExtraction',
  SUMMARIZE_LEAD: 'common.types.leadSummary',
};

const appliedActionKeys: Record<string, string> = {
  UPDATE_LEAD_NEXT_STEP: 'aiSuggestions.completedActions.nextStepApplied',
  CREATE_TASK: 'aiSuggestions.completedActions.taskCreated',
  CREATE_TASK_FROM_EXTERNAL_EMAIL: 'aiSuggestions.completedActions.taskCreated',
  CREATE_TASK_FROM_EXTERNAL_CALENDAR:
    'aiSuggestions.completedActions.taskCreated',
  CREATE_TASK_FROM_EXTERNAL_CALENDAR_EVENT:
    'aiSuggestions.completedActions.taskCreated',
  CREATE_NOTE: 'aiSuggestions.completedActions.noteCreated',
  CREATE_NOTE_FROM_EXTERNAL_EMAIL: 'aiSuggestions.completedActions.noteCreated',
  CREATE_NOTE_FROM_EXTERNAL_CALENDAR:
    'aiSuggestions.completedActions.noteCreated',
  CREATE_NOTE_FROM_EXTERNAL_CALENDAR_EVENT:
    'aiSuggestions.completedActions.noteCreated',
  CREATE_LEAD_FROM_EXTERNAL_EMAIL: 'aiSuggestions.completedActions.leadCreated',
  CREATE_LEAD_FROM_EXTERNAL_CALENDAR:
    'aiSuggestions.completedActions.leadCreated',
  CREATE_LEAD_FROM_EXTERNAL_CALENDAR_EVENT:
    'aiSuggestions.completedActions.leadCreated',
  CREATE_GMAIL_DRAFT_FROM_EMAIL_REPLY_SUGGESTION:
    'aiSuggestions.completedActions.gmailDraftCreated',
};

const priorityKeys: Record<string, string> = {
  LOW: 'common.priorities.low',
  MEDIUM: 'common.priorities.medium',
  HIGH: 'common.priorities.high',
  CRITICAL: 'common.priorities.critical',
};

const taskStatusKeys: Record<string, string> = {
  TODO: 'common.taskStatuses.todo',
  IN_PROGRESS: 'common.taskStatuses.inProgress',
  COMPLETED: 'common.taskStatuses.completed',
  CANCELLED: 'common.taskStatuses.cancelled',
  ARCHIVED: 'common.taskStatuses.archived',
};

const sourceKeys: Record<string, string> = {
  MANUAL: 'crm.enums.sources.manual',
  AI_SUGGESTION: 'crm.enums.sources.aiSuggestion',
  IMPORT: 'crm.enums.sources.import',
  EMAIL: 'crm.enums.sources.email',
  MEETING: 'crm.enums.sources.meeting',
  OTHER: 'crm.enums.sources.other',
};

const leadStatusKeys: Record<string, string> = {
  NEW: 'crm.enums.leadStatuses.new',
  CONTACTED: 'crm.enums.leadStatuses.contacted',
  MEETING_SCHEDULED: 'crm.enums.leadStatuses.meetingScheduled',
  PROPOSAL_SENT: 'crm.enums.leadStatuses.proposalSent',
  NEGOTIATION: 'crm.enums.leadStatuses.negotiation',
  WON: 'crm.enums.leadStatuses.won',
  LOST: 'crm.enums.leadStatuses.lost',
  ARCHIVED: 'common.taskStatuses.archived',
};

const syncStatusKeys: Record<string, string> = {
  ACTIVE: 'common.syncStatuses.active',
  ERROR: 'common.syncStatuses.error',
  INITIAL_SYNC_RUNNING: 'common.syncStatuses.initialSyncRunning',
  INITIAL_SYNC_PENDING: 'common.syncStatuses.initialSyncPending',
};

const activityTypeKeys: Record<string, string> = {
  COMPANY_CREATED: 'crm.enums.activityTypes.companyCreated',
  CONTACT_CREATED: 'crm.enums.activityTypes.contactCreated',
  LEAD_CREATED: 'crm.enums.activityTypes.leadCreated',
  TASK_CREATED: 'crm.enums.activityTypes.taskCreated',
  NOTE_CREATED: 'crm.enums.activityTypes.noteCreated',
  TASK_COMPLETED: 'crm.enums.activityTypes.taskCompleted',
  LEAD_STATUS_CHANGED: 'crm.enums.activityTypes.leadStatusChanged',
  LEAD_PRIORITY_CHANGED: 'crm.enums.activityTypes.leadPriorityChanged',
  TASK_STATUS_CHANGED: 'crm.enums.activityTypes.taskStatusChanged',
  TASK_ASSIGNED: 'crm.enums.activityTypes.taskAssigned',
};

const entityTypeKeys: Record<string, string> = {
  COMPANY: 'crm.enums.entityTypes.company',
  CONTACT: 'crm.enums.entityTypes.contact',
  LEAD: 'crm.enums.entityTypes.lead',
  TASK: 'crm.enums.entityTypes.task',
  NOTE: 'crm.enums.entityTypes.note',
};

export function getAiStatusLabel(status: AiSuggestionStatus, t: Translate) {
  return t(statusKeys[status]);
}

export function getAiTypeLabel(type: AiSuggestionType, t: Translate) {
  const key = typeKeys[type];

  return key ? t(key) : formatEnumLabel(type);
}

export function getAppliedActionLabel(action: string, t: Translate) {
  const key = appliedActionKeys[action];

  return key ? t(key) : null;
}

export function getPriorityLabel(priority: string, t: Translate) {
  const key = priorityKeys[priority];

  return key ? t(key) : formatEnumLabel(priority);
}

export function getTaskStatusLabel(status: string, t: Translate) {
  const key = taskStatusKeys[status];

  return key ? t(key) : formatEnumLabel(status);
}

export function getImportanceLabel(importance: string, t: Translate) {
  return getPriorityLabel(importance, t);
}

export function getSourceLabel(source: string, t: Translate) {
  const key = sourceKeys[source];

  return key ? t(key) : formatEnumLabel(source);
}

export function getLeadStatusLabel(status: string, t: Translate) {
  const key = leadStatusKeys[status];

  return key ? t(key) : formatEnumLabel(status);
}

export function getSyncStatusLabel(status: string, t: Translate) {
  const key = syncStatusKeys[status];

  return key ? t(key) : formatEnumLabel(status);
}

export function getActivityTypeLabel(type: string, t: Translate) {
  const key = activityTypeKeys[type];

  return key ? t(key) : formatEnumLabel(type);
}

export function getEntityTypeLabel(type: string, t: Translate) {
  const key = entityTypeKeys[type];

  return key ? t(key) : formatEnumLabel(type);
}
