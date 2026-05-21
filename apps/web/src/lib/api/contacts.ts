import { apiRequest } from '@/lib/api/core';
import type {
  Contact,
  ContactDetail,
  ContactIncludeQuery,
  CreateContactInput,
  PaginatedResponse,
  QueryContactsParams,
  UpdateContactInput,
} from '@/types/crm';

export function getContacts(token: string, query?: QueryContactsParams) {
  return apiRequest<PaginatedResponse<Contact>>('/contacts', {
    token,
    query,
  });
}

export function getContactById(
  token: string,
  id: string,
  query?: ContactIncludeQuery,
) {
  return apiRequest<ContactDetail>(`/contacts/${id}`, {
    token,
    query,
  });
}

export function createContact(token: string, input: CreateContactInput) {
  return apiRequest<Contact>('/contacts', {
    method: 'POST',
    token,
    body: input,
  });
}

export function updateContact(
  token: string,
  id: string,
  input: UpdateContactInput,
) {
  return apiRequest<Contact>(`/contacts/${id}`, {
    method: 'PATCH',
    token,
    body: input,
  });
}

export function deleteContact(token: string, id: string) {
  return apiRequest<Contact>(`/contacts/${id}`, {
    method: 'DELETE',
    token,
  });
}