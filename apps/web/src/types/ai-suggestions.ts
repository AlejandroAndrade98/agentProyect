import type { PaginatedResponse } from './crm';

export type AiSuggestionStatus =
  | 'PENDING_REVIEW'
  | 'ACCEPTED'
  | 'EDITED_AND_ACCEPTED'
  | 'REJECTED'
  | 'EXPIRED';

export type AiSuggestionType = 'SUGGEST_NEXT_STEPS';

export type AiSuggestionEntityType =
  | 'COMPANY'
  | 'CONTACT'
  | 'LEAD'
  | 'TASK'
  | 'NOTE'
  | 'PRODUCT'
  | 'USER'
  | 'ORGANIZATION';

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

  inputText: string;
  inputHash: string;
  outputJson: LeadNextStepsSuggestionOutput | null;
  outputText: string | null;
  confidenceScore: number | null;
  metadataJson: {
    model?: string;
    generatedFor?: string;
    humanApprovalRequired?: boolean;
    canApplyAutomatically?: boolean;
    canSendEmailAutomatically?: boolean;
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