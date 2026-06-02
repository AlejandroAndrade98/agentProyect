import type { AiSuggestion } from '@/types/ai-suggestions';
import type {
  ExternalEmailMessage,
  GmailSearchPreviewInput,
  GmailSearchPreviewResult,
  ImportSelectedExternalEmailMessagesInput,
  ImportSelectedExternalEmailMessagesResult,
  PaginatedExternalCalendarEvents,
  PaginatedExternalEmailMessages,
  QueryExternalCalendarEventsParams,
  QueryExternalEmailMessagesParams,
  SyncExternalCalendarEventsResult,
  SyncExternalEmailMessagesResult,
} from '@/types/external-sync';

import { apiRequest } from './core';

export function getExternalEmailMessages(
  token: string,
  params: QueryExternalEmailMessagesParams = {},
) {
  return apiRequest<PaginatedExternalEmailMessages>(
    '/external-sync/email-messages',
    {
      token,
      query: params,
    },
  );
}

export function getExternalCalendarEvents(
  token: string,
  params: QueryExternalCalendarEventsParams = {},
) {
  return apiRequest<PaginatedExternalCalendarEvents>(
    '/external-sync/calendar-events',
    {
      token,
      query: params,
    },
  );
}

export function syncExternalEmailMessages(token: string) {
  return apiRequest<SyncExternalEmailMessagesResult>(
    '/external-sync/email-messages/sync',
    {
      method: 'POST',
      token,
    },
  );
}

export function dismissExternalEmailMessage(
  token: string,
  emailMessageId: string,
  reason?: string,
) {
  return apiRequest<ExternalEmailMessage>(
    `/external-sync/email-messages/${emailMessageId}/dismiss`,
    {
      method: 'PATCH',
      token,
      body: reason ? { reason } : {},
    },
  );
}

export function restoreExternalEmailMessage(
  token: string,
  emailMessageId: string,
) {
  return apiRequest<ExternalEmailMessage>(
    `/external-sync/email-messages/${emailMessageId}/restore`,
    {
      method: 'PATCH',
      token,
    },
  );
}

export function searchGmailMessagesPreview(
  token: string,
  input: GmailSearchPreviewInput,
) {
  return apiRequest<GmailSearchPreviewResult>(
    '/external-sync/email-messages/gmail-search-preview',
    {
      method: 'POST',
      token,
      body: input,
    },
  );
}

export function importSelectedExternalEmailMessages(
  token: string,
  input: ImportSelectedExternalEmailMessagesInput,
) {
  return apiRequest<ImportSelectedExternalEmailMessagesResult>(
    '/external-sync/email-messages/import-selected',
    {
      method: 'POST',
      token,
      body: input,
    },
  );
}

export function syncExternalCalendarEvents(token: string) {
  return apiRequest<SyncExternalCalendarEventsResult>(
    '/external-sync/calendar-events/sync',
    {
      method: 'POST',
      token,
    },
  );
}

export function analyzeExternalEmailMessage(
  token: string,
  emailMessageId: string,
) {
  return apiRequest<AiSuggestion>(
    `/ai-suggestions/external-sync/email-messages/${emailMessageId}/analyze`,
    {
      method: 'POST',
      token,
    },
  );
}

export function analyzeExternalCalendarEvent(
  token: string,
  calendarEventId: string,
) {
  return apiRequest<AiSuggestion>(
    `/ai-suggestions/external-sync/calendar-events/${calendarEventId}/analyze`,
    {
      method: 'POST',
      token,
    },
  );
}

export function generateExternalEmailReplyDraft(
  token: string,
  emailMessageId: string,
) {
  return apiRequest<AiSuggestion>(
    `/ai-suggestions/external-sync/email-messages/${emailMessageId}/generate-reply-draft`,
    {
      method: 'POST',
      token,
    },
  );
}
