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
