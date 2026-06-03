'use client';

import { useI18n } from '@/i18n/useI18n';
import { formatDateTime } from '@/lib/formatters';
import type { AiSuggestion } from '@/types/ai-suggestions';

import { InfoTile, SectionIntro } from './DetailPrimitives';

function getArrayCount(value: unknown) {
  return Array.isArray(value) ? value.length : null;
}

export function AiSourceContextSection({
  suggestion,
  isLeadNextStepsSuggestion,
  isExternalEmailSuggestion,
  isExternalEmailReplyDraftSuggestion,
  isExternalCalendarSuggestion,
  replyDraftSubject,
}: {
  suggestion: AiSuggestion;
  isLeadNextStepsSuggestion: boolean;
  isExternalEmailSuggestion: boolean;
  isExternalEmailReplyDraftSuggestion: boolean;
  isExternalCalendarSuggestion: boolean;
  replyDraftSubject: string;
}) {
  const { t } = useI18n();

  return (
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <SectionIntro
            eyebrow={t('aiSuggestions.detail.sourceContext')}
            title={
              isLeadNextStepsSuggestion
                ? t('aiSuggestions.detail.leadSuggestionContext')
                : isExternalEmailReplyDraftSuggestion
                  ? t('aiSuggestions.detail.originalEmailAndReplyDraft')
                  : isExternalEmailSuggestion
                    ? t('aiSuggestions.detail.emailContext')
                    : isExternalCalendarSuggestion
                      ? t('aiSuggestions.detail.syncedCalendarMetadata')
                      : t('aiSuggestions.detail.suggestionSource')
            }
            description={t('aiSuggestions.detail.sourceDescription')}
          />

          {isLeadNextStepsSuggestion ? (
            <div className="grid gap-4 md:grid-cols-3">
              <InfoTile
                label={t('aiSuggestions.detail.leadIdLabel')}
                value={suggestion.leadId ?? t('aiSuggestions.detail.notLinked')}
              />
              <InfoTile
                label={t('aiSuggestions.detail.entityType')}
                value={suggestion.entityType ?? t('aiSuggestions.detail.lead')}
              />
              <InfoTile
                label={t('aiSuggestions.detail.entityId')}
                value={suggestion.entityId ?? t('common.emptyStates.notSet')}
              />
            </div>
          ) : null}

          {isExternalEmailSuggestion || isExternalEmailReplyDraftSuggestion ? (
            <div className="grid gap-4 md:grid-cols-2">
              <InfoTile
                label={t('aiSuggestions.detail.emailSubject')}
                value={
                  suggestion.externalEmailMessage?.subject ??
                  t('common.emptyStates.noSubject')
                }
              />
              <InfoTile
                label={t('aiSuggestions.labels.sender')}
                value={
                  suggestion.externalEmailMessage?.fromName ||
                  suggestion.externalEmailMessage?.fromEmail ||
                  t('common.emptyStates.unknownSender')
                }
              />
              <InfoTile
                label={t('aiSuggestions.detail.internalDate')}
                value={
                  suggestion.externalEmailMessage?.internalDate
                    ? formatDateTime(suggestion.externalEmailMessage.internalDate)
                    : t('common.emptyStates.notSet')
                }
              />
              <InfoTile
                label={t('aiSuggestions.detail.syncedAt')}
                value={
                  suggestion.externalEmailMessage?.syncedAt
                    ? formatDateTime(suggestion.externalEmailMessage.syncedAt)
                    : t('common.emptyStates.notSet')
                }
              />
              {isExternalEmailReplyDraftSuggestion ? (
                <InfoTile
                  label={t('aiSuggestions.labels.suggestedSubject')}
                  value={replyDraftSubject}
                />
              ) : null}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t('aiSuggestions.detail.snippet')}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  {suggestion.externalEmailMessage?.snippet ??
                    t('common.emptyStates.noSnippet')}
                </p>
              </div>
            </div>
          ) : null}

          {isExternalCalendarSuggestion ? (
            <div className="grid gap-4 md:grid-cols-2">
              <InfoTile
                label={t('aiSuggestions.detail.calendarEvent')}
                value={
                  suggestion.externalCalendarEvent?.summary ??
                  t('common.emptyStates.noTitle')
                }
              />
              <InfoTile
                label={t('aiSuggestions.labels.organizer')}
                value={
                  suggestion.externalCalendarEvent?.organizerName ||
                  suggestion.externalCalendarEvent?.organizerEmail ||
                  t('common.emptyStates.unknownOrganizer')
                }
              />
              <InfoTile
                label={t('externalSync.labels.start')}
                value={
                  suggestion.externalCalendarEvent?.startAt
                    ? formatDateTime(suggestion.externalCalendarEvent.startAt)
                    : t('common.emptyStates.notSet')
                }
              />
              <InfoTile
                label={t('externalSync.labels.end')}
                value={
                  suggestion.externalCalendarEvent?.endAt
                    ? formatDateTime(suggestion.externalCalendarEvent.endAt)
                    : t('common.emptyStates.notSet')
                }
              />
              <InfoTile
                label={t('aiSuggestions.labels.attendees')}
                value={String(
                  getArrayCount(suggestion.externalCalendarEvent?.attendeesJson) ??
                    t('common.emptyStates.notSet'),
                )}
              />
              <InfoTile label={t('aiSuggestions.detail.calendarLink')}>
                {suggestion.externalCalendarEvent?.htmlLink ? (
                  <a
                    href={suggestion.externalCalendarEvent.htmlLink}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex text-sm font-medium text-blue-700 hover:text-blue-900"
                  >
                    {t('aiSuggestions.detail.openEvent')}
                  </a>
                ) : (
                  <p className="mt-2 text-sm font-medium text-slate-900">
                    {t('common.emptyStates.notSet')}
                  </p>
                )}
              </InfoTile>
            </div>
          ) : null}
        </article>
  );
}
