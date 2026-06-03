'use client';

import { useI18n } from '@/i18n/useI18n';
import { formatDateTime } from '@/lib/formatters';
import type { AiSuggestion } from '@/types/ai-suggestions';

function formatBooleanFlag(value: unknown, t: (key: string) => string) {
  if (value === true) {
    return t('common.labels.yes');
  }

  if (value === false) {
    return t('common.labels.no');
  }

  return t('common.emptyStates.notSet');
}

function getTechnicalMetadataJson(suggestion: AiSuggestion) {
  return JSON.stringify(
    {
      suggestionId: suggestion.id,
      organizationId: suggestion.organizationId,
      userId: suggestion.userId,
      entityType: suggestion.entityType,
      entityId: suggestion.entityId,
      companyId: suggestion.companyId,
      contactId: suggestion.contactId,
      leadId: suggestion.leadId,
      taskId: suggestion.taskId,
      noteId: suggestion.noteId,
      externalEmailMessageId: suggestion.externalEmailMessageId,
      externalCalendarEventId: suggestion.externalCalendarEventId,
      metadataJson: suggestion.metadataJson,
    },
    null,
    2,
  );
}

export function AiAdvancedMetadataSection({
  suggestion,
  outputLanguageLabel,
}: {
  suggestion: AiSuggestion;
  outputLanguageLabel: string;
}) {
  const { t } = useI18n();

  return (
    <aside>
      <details className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
          <span>
            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('aiSuggestions.detail.technicalDetails')}
            </span>
            <span className="mt-1 block font-semibold text-slate-950">
              {t('aiSuggestions.detail.advancedMetadata')}
            </span>
            <span className="mt-2 block text-sm leading-6 text-slate-500">
              {t('aiSuggestions.detail.advancedMetadataDescription')}
            </span>
          </span>
          <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition group-open:bg-slate-100">
            {t('aiSuggestions.detail.expandTechnicalDetails')}
          </span>
        </summary>

        <dl className="mt-5 space-y-3 border-t border-slate-100 pt-4 text-sm">
          <div>
            <dt className="text-slate-500">
              {t('aiSuggestions.detail.created')}
            </dt>
            <dd className="font-medium text-slate-800">
              {formatDateTime(suggestion.createdAt)}
            </dd>
          </div>

          <div>
            <dt className="text-slate-500">
              {t('aiSuggestions.detail.expires')}
            </dt>
            <dd className="font-medium text-slate-800">
              {formatDateTime(suggestion.expiresAt)}
            </dd>
          </div>

          <div>
            <dt className="text-slate-500">
              {t('aiSuggestions.detail.reviewedAt')}
            </dt>
            <dd className="font-medium text-slate-800">
              {formatDateTime(suggestion.reviewedAt)}
            </dd>
          </div>

          <div>
            <dt className="text-slate-500">
              {t('aiSuggestions.detail.reviewedBy')}
            </dt>
            <dd className="font-medium text-slate-800">
              {suggestion.reviewedBy?.name ??
                t('aiSuggestions.detail.notReviewed')}
            </dd>
          </div>

          <div>
            <dt className="text-slate-500">
              {t('aiSuggestions.labels.provider')}
            </dt>
            <dd className="font-medium text-slate-800">
              {suggestion.provider}
            </dd>
          </div>

          <div>
            <dt className="text-slate-500">
              {t('aiSuggestions.labels.model')}
            </dt>
            <dd className="font-medium text-slate-800">
              {suggestion.metadataJson?.model ?? t('common.emptyStates.notSet')}
            </dd>
          </div>

          <div>
            <dt className="text-slate-500">
              {t('aiSuggestions.detail.outputLanguage')}
            </dt>
            <dd className="font-medium text-slate-800">
              {outputLanguageLabel}
            </dd>
          </div>

          <div>
            <dt className="text-slate-500">
              {t('aiSuggestions.detail.tokens')}
            </dt>
            <dd className="font-medium text-slate-800">
              {t('common.labels.input')} {suggestion.tokensInput ?? 0} -{' '}
              {t('common.labels.output')} {suggestion.tokensOutput ?? 0}
            </dd>
          </div>

          <div>
            <dt className="text-slate-500">
              {t('aiSuggestions.detail.cost')}
            </dt>
            <dd className="font-medium text-slate-800">
              ${suggestion.estimatedCostUsd ?? 0}
            </dd>
          </div>

          <div>
            <dt className="text-slate-500">
              {t('aiSuggestions.detail.humanApprovalRequired')}
            </dt>
            <dd className="font-medium text-slate-800">
              {formatBooleanFlag(
                suggestion.metadataJson?.humanApprovalRequired ?? true,
                t,
              )}
            </dd>
          </div>

          <div>
            <dt className="text-slate-500">
              {t('aiSuggestions.detail.canApplyAutomatically')}
            </dt>
            <dd className="font-medium text-slate-800">
              {formatBooleanFlag(
                suggestion.metadataJson?.canApplyAutomatically ?? false,
                t,
              )}
            </dd>
          </div>

          <div>
            <dt className="text-slate-500">
              {t('aiSuggestions.detail.canSendEmailAutomatically')}
            </dt>
            <dd className="font-medium text-slate-800">
              {formatBooleanFlag(
                suggestion.metadataJson?.canSendEmailAutomatically ?? false,
                t,
              )}
            </dd>
          </div>

          <div>
            <dt className="text-slate-500">
              {t('aiSuggestions.detail.externalEmailMessageId')}
            </dt>
            <dd className="break-all font-medium text-slate-800">
              {suggestion.externalEmailMessageId ??
                t('common.emptyStates.notSet')}
            </dd>
          </div>

          <div>
            <dt className="text-slate-500">
              {t('aiSuggestions.detail.externalProviderMessageId')}
            </dt>
            <dd className="break-all font-medium text-slate-800">
              {String(
                suggestion.externalEmailMessage?.externalMessageId ??
                  suggestion.metadataJson?.externalMessageId ??
                  t('common.emptyStates.notSet'),
              )}
            </dd>
          </div>

          <div>
            <dt className="text-slate-500">
              {t('aiSuggestions.detail.externalThreadId')}
            </dt>
            <dd className="break-all font-medium text-slate-800">
              {String(
                suggestion.externalEmailMessage?.externalThreadId ??
                  suggestion.metadataJson?.externalThreadId ??
                  t('common.emptyStates.notSet'),
              )}
            </dd>
          </div>

          <div>
            <dt className="text-slate-500">
              {t('aiSuggestions.detail.externalCalendarEventId')}
            </dt>
            <dd className="break-all font-medium text-slate-800">
              {suggestion.externalCalendarEventId ??
                t('common.emptyStates.notSet')}
            </dd>
          </div>

          <div>
            <dt className="text-slate-500">
              {t('aiSuggestions.detail.externalCalendarId')}
            </dt>
            <dd className="break-all font-medium text-slate-800">
              {String(
                suggestion.externalCalendarEvent?.externalCalendarId ??
                  suggestion.metadataJson?.externalCalendarId ??
                  t('common.emptyStates.notSet'),
              )}
            </dd>
          </div>

          <div>
            <dt className="text-slate-500">
              {t('aiSuggestions.detail.externalEventId')}
            </dt>
            <dd className="break-all font-medium text-slate-800">
              {String(
                suggestion.externalCalendarEvent?.externalEventId ??
                  suggestion.metadataJson?.externalEventId ??
                  t('common.emptyStates.notSet'),
              )}
            </dd>
          </div>

          <div>
            <dt className="text-slate-500">
              {t('aiSuggestions.detail.connectedAccountId')}
            </dt>
            <dd className="break-all font-medium text-slate-800">
              {String(
                suggestion.metadataJson?.connectedAccountId ??
                  t('common.emptyStates.notSet'),
              )}
            </dd>
          </div>

          <div>
            <dt className="text-slate-500">
              {t('aiSuggestions.detail.analysisScope')}
            </dt>
            <dd className="font-medium text-slate-800">
              {String(
                suggestion.metadataJson?.aiAnalysisScope ??
                  t('common.emptyStates.notSet'),
              )}
            </dd>
          </div>

          <div>
            <dt className="text-slate-500">
              {t('aiSuggestions.detail.bodyStored')}
            </dt>
            <dd className="font-medium text-slate-800">
              {formatBooleanFlag(suggestion.metadataJson?.bodyStored, t)}
            </dd>
          </div>

          <div>
            <dt className="text-slate-500">
              {t('aiSuggestions.detail.crmRecordsCreated')}
            </dt>
            <dd className="font-medium text-slate-800">
              {formatBooleanFlag(
                suggestion.metadataJson?.crmRecordsCreated,
                t,
              )}
            </dd>
          </div>

          <div>
            <dt className="text-slate-500">
              {t('aiSuggestions.detail.emailSentAutomatically')}
            </dt>
            <dd className="font-medium text-slate-800">
              {formatBooleanFlag(
                suggestion.metadataJson?.emailSentAutomatically,
                t,
              )}
            </dd>
          </div>
        </dl>

        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-950 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">
            {t('aiSuggestions.detail.fullTechnicalMetadata')}
          </p>
          <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-slate-100">
            {getTechnicalMetadataJson(suggestion)}
          </pre>
        </div>

        {suggestion.outputText ? (
          <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('aiSuggestions.detail.originalAiOutput')}
            </p>
            <p className="mt-3 max-h-80 overflow-auto whitespace-pre-line break-words text-sm leading-7 text-slate-700">
              {suggestion.outputText}
            </p>
          </div>
        ) : null}
      </details>
    </aside>
  );
}
