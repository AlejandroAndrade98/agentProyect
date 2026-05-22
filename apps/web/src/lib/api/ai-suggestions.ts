import type {
  AiSuggestion,
  PaginatedAiSuggestions,
  QueryAiSuggestionsParams,
  ReviewAiSuggestionInput,
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