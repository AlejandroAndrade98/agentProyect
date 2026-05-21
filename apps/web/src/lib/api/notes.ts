import { apiRequest } from '@/lib/api/core';
import type {
  CreateNoteInput,
  Note,
  NoteDetail,
  NoteIncludeQuery,
  PaginatedResponse,
  QueryNotesParams,
  UpdateNoteInput,
} from '@/types/crm';

export function getNotes(token: string, query?: QueryNotesParams) {
  return apiRequest<PaginatedResponse<Note>>('/notes', {
    token,
    query,
  });
}

export function getNoteById(
  token: string,
  id: string,
  query?: NoteIncludeQuery,
) {
  return apiRequest<NoteDetail>(`/notes/${id}`, {
    token,
    query,
  });
}

export function createNote(token: string, input: CreateNoteInput) {
  return apiRequest<Note>('/notes', {
    method: 'POST',
    token,
    body: input,
  });
}

export function updateNote(token: string, id: string, input: UpdateNoteInput) {
  return apiRequest<Note>(`/notes/${id}`, {
    method: 'PATCH',
    token,
    body: input,
  });
}

export function deleteNote(token: string, id: string) {
  return apiRequest<Note>(`/notes/${id}`, {
    method: 'DELETE',
    token,
  });
}