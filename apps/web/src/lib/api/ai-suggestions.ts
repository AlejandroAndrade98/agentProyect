import type {
  AiSuggestion,
  PaginatedAiSuggestions,
  QueryAiSuggestionsParams,
  ReviewAiSuggestionInput,
  ApplyLeadNextStepInput,
  ApplyLeadNextStepResponse,
  ApplySuggestedNoteInput,
  ApplySuggestedNoteResponse,
  ApplySuggestedTaskInput,
  ApplySuggestedTaskResponse,
} from '@/types/ai-suggestions';

import { apiRequest } from './core';

export function getAiSuggestions(
  token: string,
  params: QueryAiSuggestionsParams = {},
) {
  return apiRequest<PaginatedAiSuggestions>('/ai-suggestions', {
    token,
    query: params,
  });
}

export function getAiSuggestion(token: string, id: string) {
  return apiRequest<AiSuggestion>(`/ai-suggestions/${id}`, {
    token,
  });
}

export function generateLeadNextStepsSuggestion(token: string, leadId: string) {
  return apiRequest<AiSuggestion>(`/ai-suggestions/leads/${leadId}/next-steps`, {
    method: 'POST',
    token,
  });
}

export function acceptAiSuggestion(
  token: string,
  id: string,
  input: ReviewAiSuggestionInput = {},
) {
  return apiRequest<AiSuggestion>(`/ai-suggestions/${id}/accept`, {
    method: 'PATCH',
    token,
    body: input,
  });
}

export function rejectAiSuggestion(
  token: string,
  id: string,
  input: ReviewAiSuggestionInput = {},
) {
  return apiRequest<AiSuggestion>(`/ai-suggestions/${id}/reject`, {
    method: 'PATCH',
    token,
    body: input,
  });
}

export function applyAiSuggestionLeadNextStep(
  token: string,
  id: string,
  input: ApplyLeadNextStepInput = {},
) {
  return apiRequest<ApplyLeadNextStepResponse>(
    `/ai-suggestions/${id}/apply/lead-next-step`,
    {
      method: 'PATCH',
      token,
      body: input,
    },
  );
}

export function applyAiSuggestionTask(
  token: string,
  id: string,
  input: ApplySuggestedTaskInput = {},
) {
  return apiRequest<ApplySuggestedTaskResponse>(
    `/ai-suggestions/${id}/apply/task`,
    {
      method: 'POST',
      token,
      body: input,
    },
  );
}

export function applyAiSuggestionNote(
  token: string,
  id: string,
  input: ApplySuggestedNoteInput = {},
) {
  return apiRequest<ApplySuggestedNoteResponse>(
    `/ai-suggestions/${id}/apply/note`,
    {
      method: 'POST',
      token,
      body: input,
    },
  );
}