import type { AiSuggestion } from '@/types/ai-suggestions';
import type {
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
