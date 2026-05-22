import type {
  AiSuggestion,
  PaginatedAiSuggestions,
  QueryAiSuggestionsParams,
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