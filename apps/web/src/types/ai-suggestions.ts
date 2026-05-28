// FILE: apps/web/src/types/ai-suggestions.ts
import type { PaginatedResponse } from './crm';

export type AiSuggestionStatus =
  | 'PENDING_REVIEW'
  | 'ACCEPTED'
  | 'EDITED_AND_ACCEPTED'
  | 'REJECTED'
  | 'EXPIRED';

export type AiSuggestionType =
  | 'ANALYZE_MESSAGE'
  | 'GENERATE_REPLY'
  | 'EXTRACT_IMPORTANT_DATA'
  | 'SUMMARIZE_LEAD'
  | 'SUGGEST_NEXT_STEPS'
  | 'GENERATE_EMAIL_REPLY_DRAFT'
  | 'ANALYZE_EXTERNAL_EMAIL'
  | 'ANALYZE_EXTERNAL_CALENDAR_EVENT';

export type AiSuggestionEntityType =
  | 'COMPANY'
  | 'CONTACT'
  | 'LEAD'
  | 'TASK'
  | 'NOTE'
  | 'CONNECTED_ACCOUNT'
  | 'EXTERNAL_EMAIL_MESSAGE'
  | 'EXTERNAL_CALENDAR_EVENT';

export type AiSuggestionUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  organizationId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type LeadNextStepsSuggestionOutput = {
  summary: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  recommendedNextStep: string;
  suggestedTasks: Array<{
    title: string;
    description: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    dueInDays: number;
  }>;
  suggestedNote: string;
  reasoningSummary: string;
  confidenceScore: number;
  humanApprovalRequired: true;
};

export type ExternalEmailAnalysisOutput = {
  summary: string;
  importanceLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  suggestedReviewAction:
    | 'IGNORE'
    | 'FOLLOW_UP'
    | 'CREATE_CONTACT_CANDIDATE'
    | 'CREATE_LEAD_CANDIDATE'
    | 'LINK_TO_EXISTING_RECORD'
    | 'CREATE_NOTE_CANDIDATE';
  detectedSignals: string[];
  suggestedTasks: Array<{
    title: string;
    description: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    dueInDays: number;
  }>;
  suggestedNote: string;
  reasoningSummary: string;
  confidenceScore: number;
  humanApprovalRequired: true;
  noAutomaticCrmChanges: true;
  noAutomaticEmailSending: true;
};

export type ExternalEmailReplyDraftOutput = {
  suggestedSubject: string;
  replyText: string;
  tone: 'PROFESSIONAL' | 'FRIENDLY' | 'CONCISE' | 'FORMAL';
  confidence: number;
  reasoning: string;
  humanApprovalRequired: true;
  canApplyAutomatically: false;
  canSendEmailAutomatically: false;
  emailSentAutomatically: false;
  draftCreatedAutomatically: false;
  aiAnalysisScope: 'metadata_only';
};

export type ExternalCalendarEventAnalysisOutput = {
  summary: string;
  importanceLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  suggestedReviewAction:
    | 'IGNORE'
    | 'FOLLOW_UP'
    | 'CREATE_TASK_CANDIDATE'
    | 'CREATE_NOTE_CANDIDATE'
    | 'LINK_TO_EXISTING_RECORD'
    | 'PREPARE_MEETING_BRIEF';
  detectedSignals: string[];
  suggestedTasks: Array<{
    title: string;
    description: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    dueInDays: number;
  }>;
  suggestedNote: string;
  reasoningSummary: string;
  confidenceScore: number;
  humanApprovalRequired: true;
  noAutomaticCrmChanges: true;
  noAutomaticEmailSending: true;
};

export type AiSuggestionOutput =
  | LeadNextStepsSuggestionOutput
  | ExternalEmailAnalysisOutput
  | ExternalEmailReplyDraftOutput
  | ExternalCalendarEventAnalysisOutput;

export type AiSuggestionExternalEmailMessage = {
  id: string;
  provider: string;
  externalMessageId: string;
  externalThreadId: string | null;
  subject: string | null;
  snippet: string | null;
  fromEmail: string | null;
  fromName: string | null;
  toEmailsJson: unknown;
  ccEmailsJson: unknown;
  labelIdsJson: unknown;
  internalDate: string | null;
  syncedAt: string;
};

export type AiSuggestionExternalCalendarEvent = {
  id: string;
  provider: string;
  externalCalendarId: string;
  externalEventId: string;
  iCalUid: string | null;
  status: string | null;
  summary: string | null;
  description: string | null;
  location: string | null;
  startAt: string | null;
  endAt: string | null;
  isAllDay: boolean;
  organizerEmail: string | null;
  organizerName: string | null;
  attendeesJson: unknown;
  htmlLink: string | null;
  syncedAt: string;
};

export type AiSuggestion = {
  id: string;
  organizationId: string;
  userId: string | null;
  provider: string;
  type: AiSuggestionType;
  status: AiSuggestionStatus;

  title: string | null;
  entityType: AiSuggestionEntityType | null;
  entityId: string | null;
  companyId: string | null;
  contactId: string | null;
  leadId: string | null;
  taskId: string | null;
  noteId: string | null;
  externalEmailMessageId: string | null;
  externalCalendarEventId: string | null;
  externalEmailMessage?: AiSuggestionExternalEmailMessage | null;
  externalCalendarEvent?: AiSuggestionExternalCalendarEvent | null;

  inputText: string;
  inputHash: string;
  outputJson: AiSuggestionOutput | null;
  outputText: string | null;
  confidenceScore: number | null;
  metadataJson: {
    model?: string;
    generatedFor?: string;
    source?: string;
    suggestedSubject?: string;
    tone?: string;
    confidence?: number;
    reasoning?: string;
    humanApprovalRequired?: boolean;
    canApplyAutomatically?: boolean;
    canSendEmailAutomatically?: boolean;
    bodyStored?: boolean;
    aiAnalysisScope?: string;
    crmRecordsCreated?: boolean;
    emailSentAutomatically?: boolean;
    draftCreatedAutomatically?: boolean;
    connectedAccountId?: string;
    externalEmailMessageId?: string;
    externalCalendarEventId?: string;
    externalMessageId?: string;
    externalThreadId?: string;
    externalCalendarId?: string;
    externalEventId?: string;
    iCalUid?: string;
    review?: unknown;
    appliedActions?: unknown;
    [key: string]: unknown;
  } | null;

  tokensInput: number | null;
  tokensOutput: number | null;
  estimatedCostUsd: number | null;

  reviewedByUserId: string | null;
  reviewedBy: AiSuggestionUser | null;
  reviewedAt: string | null;
  expiresAt: string | null;

  createdAt: string;
  updatedAt: string;

  user?: AiSuggestionUser | null;
};

export type QueryAiSuggestionsParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: AiSuggestionStatus;
  type?: AiSuggestionType;
  entityType?: AiSuggestionEntityType;
  entityId?: string;
  companyId?: string;
  contactId?: string;
  leadId?: string;
  taskId?: string;
  noteId?: string;
  userId?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'reviewedAt' | 'expiresAt';
  sortOrder?: 'asc' | 'desc';
};

export type PaginatedAiSuggestions = PaginatedResponse<AiSuggestion>;

export type ReviewAiSuggestionInput = {
  reviewNote?: string;
};

export type ApplyLeadNextStepInput = {
  nextStep?: string;
};

export type ApplySuggestedTaskInput = {
  taskIndex?: number;
  title?: string;
  description?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  dueDate?: string;
};

export type ApplySuggestedNoteInput = {
  title?: string;
  content?: string;
};

export type ApplyLeadNextStepResponse = {
  suggestion: AiSuggestion;
  lead: {
    id: string;
    title: string;
    nextStep: string | null;
  };
};

export type ApplySuggestedTaskResponse = {
  suggestion: AiSuggestion;
  task: {
    id: string;
    title: string;
    status: string;
    priority: string;
    leadId: string | null;
    dueDate: string | null;
  };
};

export type ApplySuggestedNoteResponse = {
  suggestion: AiSuggestion;
  note: {
    id: string;
    title: string | null;
    source: string;
    companyId?: string | null;
    contactId?: string | null;
    leadId: string | null;
  };
};

export type ApplyExternalEmailNoteResponse = ApplySuggestedNoteResponse;

export type ApplyExternalEmailTaskResponse = ApplySuggestedTaskResponse;

export type ApplyExternalCalendarTaskResponse = ApplySuggestedTaskResponse;

export type ApplyExternalCalendarNoteResponse = ApplySuggestedNoteResponse;

export type ApplyExternalEmailLeadResponse = {
  suggestion: AiSuggestion;
  lead: {
    id: string;
    title: string;
    status: string;
    priority: string;
    importanceLevel: string;
    source: string;
    companyId: string | null;
    contactId: string | null;
  };
};

export type ApplyExternalCalendarLeadResponse = ApplyExternalEmailLeadResponse;
