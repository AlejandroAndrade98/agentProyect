import { apiRequest } from '@/lib/api/core';
import type {
  CreateLeadInput,
  Lead,
  LeadDetail,
  LeadIncludeQuery,
  PaginatedResponse,
  QueryLeadsParams,
  UpdateLeadInput,
} from '@/types/crm';

export function getLeads(token: string, query?: QueryLeadsParams) {
  return apiRequest<PaginatedResponse<Lead>>('/leads', {
    token,
    query,
  });
}

export function getLeadById(
  token: string,
  id: string,
  query?: LeadIncludeQuery,
) {
  return apiRequest<LeadDetail>(`/leads/${id}`, {
    token,
    query,
  });
}

export function createLead(token: string, input: CreateLeadInput) {
  return apiRequest<Lead>('/leads', {
    method: 'POST',
    token,
    body: input,
  });
}

export function updateLead(token: string, id: string, input: UpdateLeadInput) {
  return apiRequest<Lead>(`/leads/${id}`, {
    method: 'PATCH',
    token,
    body: input,
  });
}

export function deleteLead(token: string, id: string) {
  return apiRequest<Lead>(`/leads/${id}`, {
    method: 'DELETE',
    token,
  });
}