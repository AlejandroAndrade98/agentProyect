// FILE: apps/web/src/app/dashboard/ai-suggestions/[id]/page.tsx
'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import { useAuth } from '@/hooks/useAuth';
import {
  getAiStatusLabel,
  getAiTypeLabel,
  getPriorityLabel,
  type Translate,
} from '@/i18n/ai-display';
import { useI18n } from '@/i18n/useI18n';
import {
  acceptAiSuggestion,
  ApiClientError,
  applyAiSuggestionExternalCalendarLead,
  applyAiSuggestionExternalCalendarNote,
  applyAiSuggestionExternalCalendarTask,
  applyAiSuggestionExternalEmailLead,
  applyAiSuggestionExternalEmailNote,
  applyAiSuggestionExternalEmailTask,
  applyAiSuggestionLeadNextStep,
  applyAiSuggestionNote,
  applyAiSuggestionTask,
  createGmailDraftFromAiSuggestion,
  getAiSuggestion,
  rejectAiSuggestion,
} from '@/lib/api-client';
import { formatDateTime, formatEnumLabel } from '@/lib/formatters';
import type {
  AiSuggestion,
  AiSuggestionStatus,
  ExternalCalendarEventAnalysisOutput,
  ExternalEmailAnalysisOutput,
  ExternalEmailReplyDraftOutput,
  LeadNextStepsSuggestionOutput,
} from '@/types/ai-suggestions';
import { canUpdateCrm } from '@/lib/permissions';

function getStatusClasses(status: AiSuggestionStatus) {
  const classes: Record<AiSuggestionStatus, string> = {
    PENDING_REVIEW: 'bg-amber-50 text-amber-700 ring-amber-200',
    ACCEPTED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    EDITED_AND_ACCEPTED: 'bg-blue-50 text-blue-700 ring-blue-200',
    REJECTED: 'bg-rose-50 text-rose-700 ring-rose-200',
    EXPIRED: 'bg-slate-100 text-slate-700 ring-slate-200',
  };

  return classes[status];
}

function formatConfidence(value: number | null, t: Translate) {
  if (value === null) {
    return t('common.emptyStates.notSet');
  }

  return `${Math.round(value * 100)}%`;
}

function formatMetadataConfidence(
  value: unknown,
  fallback: number | null,
  t: Translate,
) {
  if (typeof value === 'number') {
    return formatConfidence(value, t);
  }

  return formatConfidence(fallback, t);
}

function isLeadNextStepsOutput(
  output: AiSuggestion['outputJson'],
): output is LeadNextStepsSuggestionOutput {
  return Boolean(
    output &&
      'recommendedNextStep' in output &&
      'riskLevel' in output &&
      'suggestedTasks' in output,
  );
}

function isExternalEmailAnalysisOutput(
  output: AiSuggestion['outputJson'],
): output is ExternalEmailAnalysisOutput {
  return Boolean(
    output &&
      'suggestedReviewAction' in output &&
      'importanceLevel' in output &&
      'detectedSignals' in output,
  );
}

function isExternalEmailReplyDraftOutput(
  output: AiSuggestion['outputJson'],
): output is ExternalEmailReplyDraftOutput {
  return Boolean(
    output &&
      'suggestedSubject' in output &&
      'replyText' in output &&
      'tone' in output &&
      'reasoning' in output,
  );
}

function isExternalCalendarEventAnalysisOutput(
  output: AiSuggestion['outputJson'],
): output is ExternalCalendarEventAnalysisOutput {
  return Boolean(
    output &&
      'suggestedReviewAction' in output &&
      'importanceLevel' in output &&
      'detectedSignals' in output,
  );
}

function formatBooleanFlag(value: unknown, t: Translate) {
  if (value === true) {
    return t('common.labels.yes');
  }

  if (value === false) {
    return t('common.labels.no');
  }

  return t('common.emptyStates.notSet');
}

function getMetadataString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getArrayCount(value: unknown) {
  return Array.isArray(value) ? value.length : null;
}

type AppliedActionName =
  | 'UPDATE_LEAD_NEXT_STEP'
  | 'CREATE_TASK'
  | 'CREATE_NOTE'
  | 'CREATE_NOTE_FROM_EXTERNAL_EMAIL'
  | 'CREATE_TASK_FROM_EXTERNAL_EMAIL'
  | 'CREATE_LEAD_FROM_EXTERNAL_EMAIL'
  | 'CREATE_TASK_FROM_EXTERNAL_CALENDAR_EVENT'
  | 'CREATE_TASK_FROM_EXTERNAL_CALENDAR'
  | 'CREATE_NOTE_FROM_EXTERNAL_CALENDAR_EVENT'
  | 'CREATE_NOTE_FROM_EXTERNAL_CALENDAR'
  | 'CREATE_LEAD_FROM_EXTERNAL_CALENDAR_EVENT'
  | 'CREATE_LEAD_FROM_EXTERNAL_CALENDAR'
  | 'CREATE_GMAIL_DRAFT_FROM_EMAIL_REPLY_SUGGESTION';

function SectionIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-5">
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
        {title}
      </h2>
      {description ? (
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          {description}
        </p>
      ) : null}
    </div>
  );
}

function InfoTile({
  label,
  value,
  children,
}: {
  label: string;
  value?: string | null;
  children?: ReactNode;
}) {
  const { t } = useI18n();

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      {children ?? (
        <p className="mt-2 break-words text-sm font-medium text-slate-900">
          {value || t('aiSuggestions.labels.notSet')}
        </p>
      )}
    </div>
  );
}

function SafetyPanel({
  isMetadataOnly,
}: {
  isMetadataOnly: boolean;
}) {
  const { t } = useI18n();
  const items = [
    t('common.safety.humanReviewRequired'),
    t('common.safety.noAutomaticEmailSending'),
    t('common.safety.noAutomaticCrmRecords'),
    t('common.safety.explicitDraftAction'),
    isMetadataOnly ? t('common.safety.metadataOnly') : null,
  ].filter((item): item is string => Boolean(item));

  return (
    <article className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
            {t('aiSuggestions.detail.safety')}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-blue-950">
            {t('aiSuggestions.detail.humanControlled')}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-900">
            {t('aiSuggestions.detail.safetyDescription')}
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[420px]">
          {items.map((item) => (
            <div
              key={item}
              className="rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm font-medium text-blue-900"
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

export default function AiSuggestionDetailPage() {
  const params = useParams<{ id: string }>();
  const { token, user } = useAuth();
  const { t } = useI18n();

  const [suggestion, setSuggestion] = useState<AiSuggestion | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reviewNote, setReviewNote] = useState('');
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);

  const loadSuggestion = useCallback(async () => {
    if (!token || !params.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await getAiSuggestion(token, params.id);
      setSuggestion(response);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage(t('aiSuggestions.detail.loadFailed'));
      }
    } finally {
      setIsLoading(false);
    }
  }, [params.id, t, token]);

  useEffect(() => {
    loadSuggestion();
  }, [loadSuggestion]);

  useEffect(() => {
    if (!suggestion?.outputJson) {
      return;
    }

    if (isLeadNextStepsOutput(suggestion.outputJson)) {
      setNextStepDraft(suggestion.outputJson.recommendedNextStep ?? '');

      const firstTask = suggestion.outputJson.suggestedTasks[0];

      if (firstTask) {
        setTaskTitleDraft(firstTask.title ?? '');
        setTaskDescriptionDraft(firstTask.description ?? '');
        setTaskPriorityDraft(firstTask.priority ?? 'MEDIUM');
      }

      setNoteTitleDraft(t('aiSuggestions.detail.aiSuggestedNoteTitle'));
      setNoteContentDraft(suggestion.outputJson.suggestedNote ?? '');
      return;
    }

      if (
        suggestion.type === 'ANALYZE_EXTERNAL_EMAIL' &&
        isExternalEmailAnalysisOutput(suggestion.outputJson)
      ) {

      const firstTask = suggestion.outputJson.suggestedTasks[0];

      if (firstTask) {
        setTaskTitleDraft(firstTask.title ?? '');
        setTaskDescriptionDraft(firstTask.description ?? '');
        setTaskPriorityDraft(firstTask.priority ?? 'MEDIUM');
      } else {
        setTaskTitleDraft('');
        setTaskDescriptionDraft('');
        setTaskPriorityDraft('MEDIUM');
      }

      setNoteTitleDraft(t('aiSuggestions.detail.aiSuggestedEmailReviewNoteTitle'));
      setNoteContentDraft(suggestion.outputJson.suggestedNote ?? '');
    }

    if (
      suggestion.type === 'ANALYZE_EXTERNAL_CALENDAR_EVENT' &&
      isExternalCalendarEventAnalysisOutput(suggestion.outputJson)
    ) {
      setNextStepDraft('');

      const firstTask = suggestion.outputJson.suggestedTasks[0];

      if (firstTask) {
        setTaskTitleDraft(firstTask.title ?? '');
        setTaskDescriptionDraft(firstTask.description ?? '');
        setTaskPriorityDraft(firstTask.priority ?? 'MEDIUM');
      } else {
        setTaskTitleDraft('');
        setTaskDescriptionDraft('');
        setTaskPriorityDraft('MEDIUM');
      }

      setNoteTitleDraft(
        t('aiSuggestions.detail.aiSuggestedCalendarReviewNoteTitle'),
      );
      setNoteContentDraft(suggestion.outputJson.suggestedNote ?? '');
    }
  }, [suggestion, t]);

    async function handleReview(action: 'accept' | 'reject') {
    if (!token || !suggestion || suggestion.status !== 'PENDING_REVIEW') {
      return;
    }

    setIsReviewing(true);
    setErrorMessage(null);
    setReviewMessage(null);

    try {
      const input = {
        reviewNote: reviewNote.trim() || undefined,
      };

      const updatedSuggestion =
        action === 'accept'
          ? await acceptAiSuggestion(token, suggestion.id, input)
          : await rejectAiSuggestion(token, suggestion.id, input);

      setSuggestion(updatedSuggestion);
      setReviewNote('');
      setReviewMessage(
        action === 'accept'
          ? t('aiSuggestions.detail.reviewAccepted')
          : t('aiSuggestions.detail.reviewRejected'),
      );
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage(t('aiSuggestions.detail.reviewFailed'));
      }
    } finally {
      setIsReviewing(false);
    }
  }

  async function handleApplyNextStep() {
  if (!token || !suggestion) {
    return;
  }

  setIsApplying('lead-next-step');
  setErrorMessage(null);
  setApplyMessage(null);

  try {
    const response = await applyAiSuggestionLeadNextStep(token, suggestion.id, {
      nextStep: nextStepDraft.trim() || undefined,
    });

    setSuggestion(response.suggestion);
    setApplyMessage(t('aiSuggestions.detail.nextStepAppliedSuccess'));
  } catch (error) {
    if (error instanceof ApiClientError) {
      setErrorMessage(error.message);
    } else if (error instanceof Error) {
      setErrorMessage(error.message);
    } else {
      setErrorMessage(t('aiSuggestions.detail.applyNextStepFailed'));
    }
  } finally {
    setIsApplying(null);
  }
}

async function handleCreateTask() {
  if (!token || !suggestion) {
    return;
  }

  setIsApplying('task');
  setErrorMessage(null);
  setApplyMessage(null);

  try {
    const response = await applyAiSuggestionTask(token, suggestion.id, {
      taskIndex: 0,
      title: taskTitleDraft.trim() || undefined,
      description: taskDescriptionDraft.trim() || undefined,
      priority: taskPriorityDraft,
      dueDate: taskDueDateDraft
      ? new Date(taskDueDateDraft).toISOString()
      : undefined,
    });

    setSuggestion(response.suggestion);
    setApplyMessage(t('aiSuggestions.detail.taskCreatedSuccess'));
  } catch (error) {
    if (error instanceof ApiClientError) {
      setErrorMessage(error.message);
    } else if (error instanceof Error) {
      setErrorMessage(error.message);
    } else {
      setErrorMessage(t('aiSuggestions.detail.createTaskFailed'));
    }
  } finally {
    setIsApplying(null);
  }
}

async function handleCreateNote() {
  if (!token || !suggestion) {
    return;
  }

  setIsApplying('note');
  setErrorMessage(null);
  setApplyMessage(null);

  try {
    const response = await applyAiSuggestionNote(token, suggestion.id, {
      title: noteTitleDraft.trim() || undefined,
      content: noteContentDraft.trim() || undefined,
    });

    setSuggestion(response.suggestion);
    setApplyMessage(t('aiSuggestions.detail.noteCreatedSuccess'));
  } catch (error) {
    if (error instanceof ApiClientError) {
      setErrorMessage(error.message);
    } else if (error instanceof Error) {
      setErrorMessage(error.message);
    } else {
      setErrorMessage(t('aiSuggestions.detail.createNoteFailed'));
    }
  } finally {
    setIsApplying(null);
  }
}

async function handleCreateExternalEmailNote() {
  if (!token || !suggestion) {
    return;
  }

  setIsApplying('external-email-note');
  setErrorMessage(null);
  setApplyMessage(null);

  try {
    const response = await applyAiSuggestionExternalEmailNote(
      token,
      suggestion.id,
      {
        title: noteTitleDraft.trim() || undefined,
        content: noteContentDraft.trim() || undefined,
      },
    );

    setSuggestion(response.suggestion);
    setApplyMessage(
      `${t('aiSuggestions.detail.emailNoteCreatedSuccess')} ${response.note.id}. ${t('aiSuggestions.detail.noEmailSent')}.`,
    );
  } catch (error) {
    if (error instanceof ApiClientError) {
      setErrorMessage(error.message);
    } else if (error instanceof Error) {
      setErrorMessage(error.message);
    } else {
      setErrorMessage(t('aiSuggestions.detail.createExternalEmailNoteFailed'));
    }
  } finally {
    setIsApplying(null);
  }
}

async function handleCreateExternalEmailTask() {
  if (!token || !suggestion) {
    return;
  }

  setIsApplying('external-email-task');
  setErrorMessage(null);
  setApplyMessage(null);

  try {
    const response = await applyAiSuggestionExternalEmailTask(
      token,
      suggestion.id,
      {
        taskIndex: 0,
        title: taskTitleDraft.trim() || undefined,
        description: taskDescriptionDraft.trim() || undefined,
        priority: taskPriorityDraft,
        dueDate: taskDueDateDraft
          ? new Date(taskDueDateDraft).toISOString()
          : undefined,
      },
    );

    setSuggestion(response.suggestion);
    setApplyMessage(
      `${t('aiSuggestions.detail.emailTaskCreatedSuccess')} ${response.task.id}. ${t('aiSuggestions.detail.noEmailSent')}.`,
    );
  } catch (error) {
    if (error instanceof ApiClientError) {
      setErrorMessage(error.message);
    } else if (error instanceof Error) {
      setErrorMessage(error.message);
    } else {
      setErrorMessage(t('aiSuggestions.detail.createExternalEmailTaskFailed'));
    }
  } finally {
    setIsApplying(null);
  }
}

async function handleCreateExternalEmailLead() {
  if (!token || !suggestion) {
    return;
  }

  setIsApplying('external-email-lead');
  setErrorMessage(null);
  setApplyMessage(null);

  try {
    const response = await applyAiSuggestionExternalEmailLead(
      token,
      suggestion.id,
    );

    setSuggestion(response.suggestion);
    setApplyMessage(
      `${t('aiSuggestions.detail.emailLeadCreatedSuccess')} ${response.lead.id}. ${t('aiSuggestions.detail.noEmailSent')}.`,
    );
  } catch (error) {
    if (error instanceof ApiClientError) {
      setErrorMessage(error.message);
    } else if (error instanceof Error) {
      setErrorMessage(error.message);
    } else {
      setErrorMessage(t('aiSuggestions.detail.createExternalEmailLeadFailed'));
    }
  } finally {
    setIsApplying(null);
  }
}

async function handleCreateExternalCalendarTask() {
  if (!token || !suggestion) {
    return;
  }

  setIsApplying('external-calendar-task');
  setErrorMessage(null);
  setApplyMessage(null);

  try {
    const response = await applyAiSuggestionExternalCalendarTask(
      token,
      suggestion.id,
    );

    setSuggestion(response.suggestion);
    setApplyMessage(
      `${t('aiSuggestions.detail.calendarTaskCreatedSuccess')} ${response.task.id}. ${t('aiSuggestions.detail.noEmailSent')}.`,
    );
  } catch (error) {
    if (error instanceof ApiClientError) {
      setErrorMessage(error.message);
    } else if (error instanceof Error) {
      setErrorMessage(error.message);
    } else {
      setErrorMessage(t('aiSuggestions.detail.createExternalCalendarTaskFailed'));
    }
  } finally {
    setIsApplying(null);
  }
}

async function handleCreateExternalCalendarNote() {
  if (!token || !suggestion) {
    return;
  }

  setIsApplying('external-calendar-note');
  setErrorMessage(null);
  setApplyMessage(null);

  try {
    const response = await applyAiSuggestionExternalCalendarNote(
      token,
      suggestion.id,
    );

    setSuggestion(response.suggestion);
    setApplyMessage(
      `${t('aiSuggestions.detail.calendarNoteCreatedSuccess')} ${response.note.id}. ${t('aiSuggestions.detail.noEmailSent')}.`,
    );
  } catch (error) {
    if (error instanceof ApiClientError) {
      setErrorMessage(error.message);
    } else if (error instanceof Error) {
      setErrorMessage(error.message);
    } else {
      setErrorMessage(t('aiSuggestions.detail.createExternalCalendarNoteFailed'));
    }
  } finally {
    setIsApplying(null);
  }
}

async function handleCreateExternalCalendarLead() {
  if (!token || !suggestion) {
    return;
  }

  setIsApplying('external-calendar-lead');
  setErrorMessage(null);
  setApplyMessage(null);

  try {
    const response = await applyAiSuggestionExternalCalendarLead(
      token,
      suggestion.id,
    );

    setSuggestion(response.suggestion);
    setApplyMessage(
      `${t('aiSuggestions.detail.calendarLeadCreatedSuccess')} ${response.lead.id}. ${t('aiSuggestions.detail.noEmailSent')}.`,
    );
  } catch (error) {
    if (error instanceof ApiClientError) {
      setErrorMessage(error.message);
    } else if (error instanceof Error) {
      setErrorMessage(error.message);
    } else {
      setErrorMessage(t('aiSuggestions.detail.createExternalCalendarLeadFailed'));
    }
  } finally {
    setIsApplying(null);
  }
}

async function handleCreateGmailDraft() {
  if (!token || !suggestion) {
    return;
  }

  setIsApplying('gmail-draft');
  setErrorMessage(null);
  setApplyMessage(null);

  try {
    const response = await createGmailDraftFromAiSuggestion(
      token,
      suggestion.id,
    );

    setSuggestion(response.suggestion);
    setApplyMessage(
      `${t('aiSuggestions.detail.gmailDraftCreatedSuccess')} ${response.gmailDraftId}. ${t('aiSuggestions.detail.noEmailSent')}.`,
    );
  } catch (error) {
    if (error instanceof ApiClientError) {
      const lowerMessage = error.message.toLowerCase();

      if (error.status === 409) {
        setErrorMessage(
          t('aiSuggestions.detail.gmailDraftAlreadyCreated'),
        );
      } else if (
        lowerMessage.includes('reconnect') ||
        lowerMessage.includes('not authorized') ||
        lowerMessage.includes('draft permissions') ||
        lowerMessage.includes('scope')
      ) {
        setErrorMessage(
          t('aiSuggestions.detail.gmailReconnectRequired'),
        );
      } else {
        setErrorMessage(error.message);
      }
    } else if (error instanceof Error) {
      setErrorMessage(error.message);
    } else {
      setErrorMessage(t('aiSuggestions.detail.createGmailDraftFailed'));
    }
  } finally {
    setIsApplying(null);
  }
}

  const canReviewSuggestion =
  suggestion?.status === 'PENDING_REVIEW' && canUpdateCrm(user);

  const [nextStepDraft, setNextStepDraft] = useState('');
  const [taskTitleDraft, setTaskTitleDraft] = useState('');
  const [taskDescriptionDraft, setTaskDescriptionDraft] = useState('');
  const [taskPriorityDraft, setTaskPriorityDraft] = useState<
    'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  >('MEDIUM');
  const [taskDueDateDraft, setTaskDueDateDraft] = useState('');
  const [noteTitleDraft, setNoteTitleDraft] = useState('');
  const [noteContentDraft, setNoteContentDraft] = useState('');
  const [isApplying, setIsApplying] = useState<string | null>(null);
  const [applyMessage, setApplyMessage] = useState<string | null>(null);

  function getAppliedActions(suggestion: AiSuggestion | null) {
  const actions = suggestion?.metadataJson?.appliedActions;

  return Array.isArray(actions) ? actions : [];
}

function hasAppliedAction(
  suggestion: AiSuggestion | null,
  action: AppliedActionName,
) {
  return getAppliedActions(suggestion).some((appliedAction) => {
    if (
      !appliedAction ||
      typeof appliedAction !== 'object' ||
      Array.isArray(appliedAction)
    ) {
      return false;
    }

    return (appliedAction as Record<string, unknown>).action === action;
  });
}

function getAppliedActionRecord(
  suggestion: AiSuggestion | null,
  action: AppliedActionName,
) {
  const appliedAction = getAppliedActions(suggestion).find((candidate) => {
    if (
      !candidate ||
      typeof candidate !== 'object' ||
      Array.isArray(candidate)
    ) {
      return false;
    }

    return (candidate as Record<string, unknown>).action === action;
  });

  return appliedAction &&
    typeof appliedAction === 'object' &&
    !Array.isArray(appliedAction)
    ? (appliedAction as Record<string, unknown>)
    : null;
}

const isLeadNextStepsSuggestion = suggestion?.type === 'SUGGEST_NEXT_STEPS';
const isExternalEmailSuggestion = suggestion?.type === 'ANALYZE_EXTERNAL_EMAIL';
const isExternalEmailReplyDraftSuggestion =
  suggestion?.type === 'GENERATE_EMAIL_REPLY_DRAFT';
const isExternalCalendarSuggestion =
  suggestion?.type === 'ANALYZE_EXTERNAL_CALENDAR_EVENT';
const replyDraftOutput =
  suggestion?.outputJson && isExternalEmailReplyDraftOutput(suggestion.outputJson)
    ? suggestion.outputJson
    : null;
const replyDraftSubject =
  replyDraftOutput?.suggestedSubject ??
  getMetadataString(suggestion?.metadataJson?.suggestedSubject) ??
  t('common.emptyStates.notSet');
const replyDraftTone =
  replyDraftOutput?.tone ?? getMetadataString(suggestion?.metadataJson?.tone);
const replyDraftConfidence = replyDraftOutput
  ? formatConfidence(replyDraftOutput.confidence, t)
  : formatMetadataConfidence(
      suggestion?.metadataJson?.confidence,
      suggestion?.confidenceScore ?? null,
      t,
    );
const replyDraftReasoning =
  replyDraftOutput?.reasoning ??
  getMetadataString(suggestion?.metadataJson?.reasoning) ??
  t('aiSuggestions.detail.noReasoning');
const replyDraftRecipientName = getMetadataString(
  suggestion?.externalEmailMessage?.fromName,
);
const replyDraftRecipientEmail = getMetadataString(
  suggestion?.externalEmailMessage?.fromEmail,
);
const replyDraftRecipient =
  replyDraftRecipientName && replyDraftRecipientEmail
    ? `${replyDraftRecipientName} <${replyDraftRecipientEmail}>`
    : replyDraftRecipientEmail ??
      replyDraftRecipientName ??
      t('aiSuggestions.detail.unknownRecipient');

const canApplySuggestion =
  Boolean(isLeadNextStepsSuggestion) &&
  suggestion &&
  (suggestion.status === 'ACCEPTED' ||
    suggestion.status === 'EDITED_AND_ACCEPTED') &&
  canUpdateCrm(user);

const canApplyExternalEmailNote =
  Boolean(isExternalEmailSuggestion) &&
  suggestion &&
  (suggestion.status === 'ACCEPTED' ||
    suggestion.status === 'EDITED_AND_ACCEPTED') &&
  canUpdateCrm(user);

const canApplyExternalEmailTask = canApplyExternalEmailNote;
const canApplyExternalEmailLead = canApplyExternalEmailNote;
const canApplyExternalCalendarTask =
  Boolean(isExternalCalendarSuggestion) &&
  suggestion &&
  (suggestion.status === 'ACCEPTED' ||
    suggestion.status === 'EDITED_AND_ACCEPTED') &&
  canUpdateCrm(user);
const canApplyExternalCalendarNote = canApplyExternalCalendarTask;
const canApplyExternalCalendarLead = canApplyExternalCalendarTask;

const nextStepApplied = hasAppliedAction(suggestion, 'UPDATE_LEAD_NEXT_STEP');
const taskApplied = hasAppliedAction(suggestion, 'CREATE_TASK');
const noteApplied = hasAppliedAction(suggestion, 'CREATE_NOTE');
const externalEmailNoteApplied = hasAppliedAction(
  suggestion,
  'CREATE_NOTE_FROM_EXTERNAL_EMAIL',
);
const externalEmailTaskApplied = hasAppliedAction(
  suggestion,
  'CREATE_TASK_FROM_EXTERNAL_EMAIL',
);
const externalEmailLeadApplied = hasAppliedAction(
  suggestion,
  'CREATE_LEAD_FROM_EXTERNAL_EMAIL',
);
const externalCalendarTaskAction =
  getAppliedActionRecord(
    suggestion,
    'CREATE_TASK_FROM_EXTERNAL_CALENDAR_EVENT',
  ) ??
  getAppliedActionRecord(
    suggestion,
    'CREATE_TASK_FROM_EXTERNAL_CALENDAR',
  );
const externalCalendarTaskApplied = Boolean(externalCalendarTaskAction);
const externalCalendarTaskId =
  getMetadataString(externalCalendarTaskAction?.recordId) ??
  getMetadataString(
    (externalCalendarTaskAction?.details as Record<string, unknown> | undefined)
      ?.taskId,
  );
const externalCalendarTaskAppliedAt = getMetadataString(
  externalCalendarTaskAction?.appliedAt,
);
const externalCalendarTaskAppliedByUserId = getMetadataString(
  externalCalendarTaskAction?.appliedByUserId,
);
const externalCalendarNoteAction =
  getAppliedActionRecord(
    suggestion,
    'CREATE_NOTE_FROM_EXTERNAL_CALENDAR_EVENT',
  ) ??
  getAppliedActionRecord(
    suggestion,
    'CREATE_NOTE_FROM_EXTERNAL_CALENDAR',
  );
const externalCalendarNoteApplied = Boolean(externalCalendarNoteAction);
const externalCalendarNoteId =
  getMetadataString(externalCalendarNoteAction?.recordId) ??
  getMetadataString(
    (externalCalendarNoteAction?.details as Record<string, unknown> | undefined)
      ?.noteId,
  );
const externalCalendarNoteAppliedAt = getMetadataString(
  externalCalendarNoteAction?.appliedAt,
);
const externalCalendarNoteAppliedByUserId = getMetadataString(
  externalCalendarNoteAction?.appliedByUserId,
);
const externalCalendarLeadAction =
  getAppliedActionRecord(
    suggestion,
    'CREATE_LEAD_FROM_EXTERNAL_CALENDAR_EVENT',
  ) ??
  getAppliedActionRecord(
    suggestion,
    'CREATE_LEAD_FROM_EXTERNAL_CALENDAR',
  );
const externalCalendarLeadApplied = Boolean(externalCalendarLeadAction);
const externalCalendarLeadId =
  getMetadataString(externalCalendarLeadAction?.recordId) ??
  getMetadataString(
    (externalCalendarLeadAction?.details as Record<string, unknown> | undefined)
      ?.leadId,
  );
const externalCalendarLeadAppliedAt = getMetadataString(
  externalCalendarLeadAction?.appliedAt,
);
const externalCalendarLeadAppliedByUserId = getMetadataString(
  externalCalendarLeadAction?.appliedByUserId,
);
const gmailDraftAction = getAppliedActionRecord(
  suggestion,
  'CREATE_GMAIL_DRAFT_FROM_EMAIL_REPLY_SUGGESTION',
);
const gmailDraftId =
  getMetadataString(suggestion?.metadataJson?.gmailDraftId) ??
  getMetadataString(gmailDraftAction?.gmailDraftId);
const gmailThreadId =
  getMetadataString(suggestion?.metadataJson?.gmailThreadId) ??
  getMetadataString(gmailDraftAction?.gmailThreadId);
const gmailDraftCreatedAt =
  getMetadataString(suggestion?.metadataJson?.gmailDraftCreatedAt) ??
  getMetadataString(gmailDraftAction?.createdAt);
const gmailDraftCreatedByUserId =
  getMetadataString(suggestion?.metadataJson?.gmailDraftCreatedByUserId) ??
  getMetadataString(gmailDraftAction?.createdByUserId);
const gmailDraftApplied =
  Boolean(gmailDraftId) || Boolean(gmailDraftAction);
const canCreateGmailDraft =
  Boolean(isExternalEmailReplyDraftSuggestion) &&
  suggestion &&
  (suggestion.status === 'ACCEPTED' ||
    suggestion.status === 'EDITED_AND_ACCEPTED') &&
  !gmailDraftApplied &&
  canUpdateCrm(user);

  return (
    <div className="space-y-8">
      <PageHeader
        title={t('aiSuggestions.detail.pageTitle')}
        description={t('aiSuggestions.detail.pageSubtitle')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/ai-suggestions"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              {t('common.actions.backToSuggestions')}
            </Link>

            {suggestion?.leadId ? (
              <Link
                href={`/dashboard/leads/${suggestion.leadId}`}
                className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
              >
                {t('common.actions.viewLead')}
              </Link>
            ) : null}
          </div>
        }
      />

      {isLoading ? <LoadingSkeleton rows={8} /> : null}

      {!isLoading && errorMessage ? <ErrorState message={errorMessage} /> : null}

      {!isLoading && !errorMessage && suggestion ? (
        <>
        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50 px-6 py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="mb-3 flex flex-wrap gap-2">
                  <Badge className={getStatusClasses(suggestion.status)}>
                    {getAiStatusLabel(suggestion.status, t)}
                  </Badge>
                  <Badge className="bg-indigo-50 text-indigo-700 ring-indigo-200">
                    {getAiTypeLabel(suggestion.type, t)}
                  </Badge>
                  {suggestion.confidenceScore !== null ? (
                    <Badge className="bg-slate-100 text-slate-700 ring-slate-200">
                      {t('aiSuggestions.labels.confidence')}{' '}
                      {formatConfidence(suggestion.confidenceScore, t)}
                    </Badge>
                  ) : null}
                </div>

                <h1 className="max-w-4xl text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">
                  {suggestion.title ?? t('aiSuggestions.labels.untitled')}
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                  {t('aiSuggestions.detail.reviewOutputFirst')}
                </p>
              </div>

              <div className="grid min-w-full gap-3 text-sm sm:grid-cols-2 lg:min-w-[380px]">
                <InfoTile
                  label={t('aiSuggestions.detail.created')}
                  value={formatDateTime(suggestion.createdAt)}
                />
                <InfoTile
                  label={t('aiSuggestions.detail.reviewed')}
                  value={formatDateTime(suggestion.reviewedAt)}
                />
                <InfoTile
                  label={t('aiSuggestions.labels.provider')}
                  value={suggestion.provider}
                />
                <InfoTile
                  label={t('aiSuggestions.labels.model')}
                  value={String(
                    suggestion.metadataJson?.model ??
                      t('common.emptyStates.notSet'),
                  )}
                />
              </div>
            </div>
          </div>
        </article>

        <SafetyPanel
          isMetadataOnly={
            Boolean(isExternalEmailSuggestion) ||
            Boolean(isExternalEmailReplyDraftSuggestion) ||
            Boolean(isExternalCalendarSuggestion)
          }
        />

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <SectionIntro
            eyebrow={t('aiSuggestions.detail.sourceContext')}
            title={
              isLeadNextStepsSuggestion
                ? t('aiSuggestions.detail.leadSuggestionContext')
                : isExternalEmailReplyDraftSuggestion
                  ? t('aiSuggestions.detail.originalEmailAndReplyDraft')
                  : isExternalEmailSuggestion
                    ? t('aiSuggestions.detail.syncedEmailMetadata')
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
                value={suggestion.externalCalendarEvent?.summary ?? 'No title'}
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

        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <section className="space-y-6">
            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex flex-wrap gap-2">
                <Badge className={getStatusClasses(suggestion.status)}>
                  {getAiStatusLabel(suggestion.status, t)}
                </Badge>

                <Badge className="bg-indigo-50 text-indigo-700 ring-indigo-200">
                  {getAiTypeLabel(suggestion.type, t)}
                </Badge>

                <Badge className="bg-slate-100 text-slate-700 ring-slate-200">
                  {t('aiSuggestions.labels.confidence')}:{' '}
                  {formatConfidence(suggestion.confidenceScore, t)}
                </Badge>
              </div>

              <SectionIntro
                eyebrow={t('aiSuggestions.detail.aiOutput')}
                title={t('aiSuggestions.detail.generatedRecommendation')}
                description={t('aiSuggestions.detail.completeAiResponse')}
              />

              <p className="mt-4 whitespace-pre-line text-sm leading-7 text-slate-700">
                {suggestion.outputText ?? t('aiSuggestions.detail.noOutputText')}
              </p>
            </article>

              {suggestion.outputJson && isLeadNextStepsOutput(suggestion.outputJson) ? (
                <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-semibold text-slate-950">
                    {t('aiSuggestions.detail.structuredRecommendation')}
                  </h2>

                  <div className="mt-5 space-y-5 text-sm text-slate-700">
                    <div>
                      <p className="font-medium text-slate-950">
                        {t('aiSuggestions.detail.summary')}
                      </p>
                      <p className="mt-1 leading-6">{suggestion.outputJson.summary}</p>
                    </div>

                    <div>
                      <p className="font-medium text-slate-950">
                        {t('aiSuggestions.detail.recommendedNextStep')}
                      </p>
                      <p className="mt-1 leading-6">
                        {suggestion.outputJson.recommendedNextStep}
                      </p>
                    </div>

                    <div>
                      <p className="font-medium text-slate-950">
                        {t('aiSuggestions.detail.suggestedNote')}
                      </p>
                      <p className="mt-1 leading-6">{suggestion.outputJson.suggestedNote}</p>
                    </div>

                    <div>
                      <p className="font-medium text-slate-950">
                        {t('aiSuggestions.detail.suggestedTasks')}
                      </p>

                      <div className="mt-2 space-y-3">
                        {suggestion.outputJson.suggestedTasks.map((task) => (
                          <div
                            key={`${task.title}-${task.dueInDays}`}
                            className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                          >
                            <p className="font-medium text-slate-950">{task.title}</p>
                            <p className="mt-1 leading-6">{task.description}</p>
                            <p className="mt-2 text-xs text-slate-500">
                              {t('common.labels.priority')}:{' '}
                              {getPriorityLabel(task.priority, t)} ·{' '}
                              {t('common.labels.dueIn')} {task.dueInDays}{' '}
                              {t('common.labels.days')}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="font-medium text-slate-950">
                        {t('aiSuggestions.detail.reasoningSummary')}
                      </p>
                      <p className="mt-1 leading-6">
                        {suggestion.outputJson.reasoningSummary}
                      </p>
                    </div>
                  </div>
                </article>
              ) : null}

              {isExternalEmailSuggestion || isExternalEmailReplyDraftSuggestion ? (
                <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-semibold text-slate-950">
                    {t('aiSuggestions.detail.externalEmailMetadata')}
                  </h2>

                  <div className="mt-5 grid gap-4 text-sm md:grid-cols-2">
                    {suggestion.externalEmailMessage ? (
                      <>
                        <div>
                          <p className="font-medium text-slate-950">
                            {t('aiSuggestions.detail.subject')}
                          </p>
                          <p className="mt-1 text-slate-600">
                            {suggestion.externalEmailMessage.subject ??
                              t('common.emptyStates.noSubject')}
                          </p>
                        </div>

                        <div>
                          <p className="font-medium text-slate-950">
                            {t('externalSync.labels.from')}
                          </p>
                          <p className="mt-1 text-slate-600">
                            {suggestion.externalEmailMessage.fromName ||
                              suggestion.externalEmailMessage.fromEmail ||
                              t('common.emptyStates.unknownSender')}
                          </p>
                          {suggestion.externalEmailMessage.fromEmail ? (
                            <p className="mt-1 break-all text-xs text-slate-500">
                              {suggestion.externalEmailMessage.fromEmail}
                            </p>
                          ) : null}
                        </div>

                        <div className="md:col-span-2">
                          <p className="font-medium text-slate-950">
                            {t('aiSuggestions.detail.snippet')}
                          </p>
                          <p className="mt-1 leading-6 text-slate-600">
                            {suggestion.externalEmailMessage.snippet ??
                              t('common.emptyStates.noSnippet')}
                          </p>
                        </div>

                        <div>
                          <p className="font-medium text-slate-950">
                            {t('aiSuggestions.detail.internalDate')}
                          </p>
                          <p className="mt-1 text-slate-600">
                            {suggestion.externalEmailMessage.internalDate
                              ? formatDateTime(suggestion.externalEmailMessage.internalDate)
                              : t('common.emptyStates.notSet')}
                          </p>
                        </div>

                        <div>
                          <p className="font-medium text-slate-950">
                            {t('aiSuggestions.detail.syncedAt')}
                          </p>
                          <p className="mt-1 text-slate-600">
                            {formatDateTime(suggestion.externalEmailMessage.syncedAt)}
                          </p>
                        </div>
                      </>
                    ) : (
                      <div className="md:col-span-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-slate-500">
                        {t('aiSuggestions.detail.emailMetadataMissing')}
                      </div>
                    )}

                    <div>
                      <p className="font-medium text-slate-950">
                        {t('aiSuggestions.detail.externalEmailMessageId')}
                      </p>
                      <p className="mt-1 break-all text-slate-600">
                        {suggestion.externalEmailMessageId ?? 'Not linked'}
                      </p>
                    </div>

                    <div>
                      <p className="font-medium text-slate-950">
                        {t('aiSuggestions.detail.externalProviderMessageId')}
                      </p>
                      <p className="mt-1 break-all text-slate-600">
                        {String(
                          suggestion.metadataJson?.externalMessageId ??
                            t('common.emptyStates.notSet'),
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="font-medium text-slate-950">
                        {t('aiSuggestions.detail.externalThreadId')}
                      </p>
                      <p className="mt-1 break-all text-slate-600">
                        {String(
                          suggestion.metadataJson?.externalThreadId ??
                            t('common.emptyStates.notSet'),
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="font-medium text-slate-950">
                        {t('aiSuggestions.detail.connectedAccountId')}
                      </p>
                      <p className="mt-1 break-all text-slate-600">
                        {String(
                          suggestion.metadataJson?.connectedAccountId ??
                            t('common.emptyStates.notSet'),
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="font-medium text-slate-950">
                        {t('aiSuggestions.detail.analysisScope')}
                      </p>
                      <p className="mt-1 text-slate-600">
                        {String(suggestion.metadataJson?.aiAnalysisScope ?? 'metadata_only')}
                      </p>
                    </div>

                    <div>
                      <p className="font-medium text-slate-950">
                        {t('aiSuggestions.detail.bodyStored')}
                      </p>
                      <p className="mt-1 text-slate-600">
                        {formatBooleanFlag(suggestion.metadataJson?.bodyStored, t)}
                      </p>
                    </div>

                    <div>
                      <p className="font-medium text-slate-950">
                        {t('aiSuggestions.detail.crmRecordsCreated')}
                      </p>
                      <p className="mt-1 text-slate-600">
                        {formatBooleanFlag(suggestion.metadataJson?.crmRecordsCreated, t)}
                      </p>
                    </div>

                    <div>
                      <p className="font-medium text-slate-950">
                        {t('aiSuggestions.detail.emailSentAutomatically')}
                      </p>
                      <p className="mt-1 text-slate-600">
                        {formatBooleanFlag(
                          suggestion.metadataJson?.emailSentAutomatically,
                          t,
                        )}
                      </p>
                    </div>
                  </div>
                </article>
              ) : null}

              {isExternalEmailReplyDraftSuggestion ? (
                <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                    <div>
                      <p className="text-sm font-medium text-blue-700">
                        {t('aiSuggestions.detail.emailDraftPreview')}
                      </p>
                      <h2 className="mt-1 text-lg font-semibold text-slate-950">
                        {t('aiSuggestions.detail.reviewEmailDraft')}
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {t('aiSuggestions.detail.emailDraftSafetyDescription')}
                      </p>
                    </div>

                    <Badge
                      className={
                        gmailDraftApplied
                          ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                          : 'bg-amber-50 text-amber-700 ring-amber-200'
                      }
                    >
                      {gmailDraftApplied
                        ? t('aiSuggestions.completedActions.gmailDraftCreated')
                        : t('common.actions.review')}
                    </Badge>
                  </div>

                  <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
                    <div className="space-y-3 border-b border-slate-200 bg-slate-50 p-4 text-sm">
                      <div className="grid gap-1 md:grid-cols-[96px_1fr]">
                        <p className="font-medium text-slate-500">
                          {t('aiSuggestions.detail.to')}
                        </p>
                        <p className="break-words font-medium text-slate-950">
                          {replyDraftRecipient}
                        </p>
                      </div>

                      <div className="grid gap-1 md:grid-cols-[96px_1fr]">
                        <p className="font-medium text-slate-500">
                          {t('aiSuggestions.detail.subject')}
                        </p>
                        <p className="break-words font-medium text-slate-950">
                          {replyDraftSubject}
                        </p>
                      </div>
                    </div>

                    <div className="bg-white p-5">
                      <p className="whitespace-pre-line text-sm leading-7 text-slate-700">
                        {suggestion.outputText ?? t('common.emptyStates.notSet')}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-medium text-slate-950">
                        {t('aiSuggestions.detail.tone')}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {replyDraftTone
                          ? formatEnumLabel(replyDraftTone)
                          : t('common.emptyStates.notSet')}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-medium text-slate-950">
                        {t('aiSuggestions.labels.confidence')}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {replyDraftConfidence}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-medium text-slate-950">
                        {t('aiSuggestions.detail.analysisScope')}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {String(
                          suggestion.metadataJson?.aiAnalysisScope ??
                            'metadata_only',
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-sm font-medium text-slate-950">
                      {t('aiSuggestions.detail.reasoning')}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {replyDraftReasoning}
                    </p>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    {[
                      t('common.safety.humanReviewRequired'),
                      t('common.safety.metadataOnly'),
                      t('common.safety.noAutomaticEmailSending'),
                      t('common.safety.noAutomaticCrmChanges'),
                      t('common.safety.explicitDraftAction'),
                    ].map((label) => (
                      <div
                        key={label}
                        className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm font-medium text-blue-900"
                      >
                        {label}
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 space-y-5 text-sm text-slate-700">
                    {gmailDraftApplied ? (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
                        <p className="font-semibold">
                          {t('aiSuggestions.completedActions.gmailDraftCreated')}
                        </p>
                        <p className="mt-2 leading-6">
                          {t('aiSuggestions.detail.gmailDraftCreatedNotice')}
                        </p>

                        <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                          <div>
                            <p className="font-medium">
                              {t('aiSuggestions.detail.gmailDraftId')}
                            </p>
                            <p className="mt-1 break-all text-emerald-800">
                              {gmailDraftId ?? t('common.labels.created')}
                            </p>
                          </div>

                          {gmailThreadId ? (
                            <div>
                              <p className="font-medium">
                                {t('aiSuggestions.detail.gmailThreadId')}
                              </p>
                              <p className="mt-1 break-all text-emerald-800">
                                {gmailThreadId}
                              </p>
                            </div>
                          ) : null}

                          {gmailDraftCreatedAt ? (
                            <div>
                              <p className="font-medium">
                                {t('common.labels.createdAt')}
                              </p>
                              <p className="mt-1 text-emerald-800">
                                {formatDateTime(gmailDraftCreatedAt)}
                              </p>
                            </div>
                          ) : null}

                          {gmailDraftCreatedByUserId ? (
                            <div>
                              <p className="font-medium">
                                {t('aiSuggestions.detail.createdByUserId')}
                              </p>
                              <p className="mt-1 break-all text-emerald-800">
                                {gmailDraftCreatedByUserId}
                              </p>
                            </div>
                          ) : null}
                        </div>

                        <a
                          href="https://mail.google.com/mail/u/0/#drafts"
                          target="_blank"
                          rel="noreferrer"
                          className="mt-4 inline-flex rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-800"
                        >
                          {t('common.actions.openGmailDrafts')}
                        </a>
                      </div>
                    ) : null}

                    {canCreateGmailDraft ? (
                      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                        <p className="text-sm font-semibold text-blue-900">
                          {t('aiSuggestions.detail.createGmailDraftTitle')}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-blue-800">
                          {t('aiSuggestions.detail.createGmailDraftDescription')}
                        </p>

                        <button
                          type="button"
                          onClick={handleCreateGmailDraft}
                          disabled={isApplying !== null}
                          className="mt-3 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isApplying === 'gmail-draft'
                            ? t('aiSuggestions.detail.creatingGmailDraft')
                            : t('common.actions.createGmailDraft')}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </article>
              ) : null}

              {isExternalCalendarSuggestion ? (
  <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
    <h2 className="text-lg font-semibold text-slate-950">
      {t('aiSuggestions.detail.externalCalendarMetadata')}
    </h2>

    <div className="mt-5 grid gap-4 text-sm md:grid-cols-2">
      {suggestion.externalCalendarEvent ? (
        <>
          <div>
            <p className="font-medium text-slate-950">
              {t('aiSuggestions.detail.summary')}
            </p>
            <p className="mt-1 text-slate-600">
              {suggestion.externalCalendarEvent.summary ?? 'No title'}
            </p>
          </div>

          <div>
            <p className="font-medium text-slate-950">
              {t('aiSuggestions.list.status')}
            </p>
            <p className="mt-1 text-slate-600">
              {suggestion.externalCalendarEvent.status
                ? formatEnumLabel(suggestion.externalCalendarEvent.status)
                : t('common.emptyStates.notSet')}
            </p>
          </div>

          <div>
            <p className="font-medium text-slate-950">
              {t('externalSync.labels.start')}
            </p>
            <p className="mt-1 text-slate-600">
              {suggestion.externalCalendarEvent.startAt
                ? formatDateTime(suggestion.externalCalendarEvent.startAt)
                : t('common.emptyStates.notSet')}
            </p>
          </div>

          <div>
            <p className="font-medium text-slate-950">
              {t('externalSync.labels.end')}
            </p>
            <p className="mt-1 text-slate-600">
              {suggestion.externalCalendarEvent.endAt
                ? formatDateTime(suggestion.externalCalendarEvent.endAt)
                : t('common.emptyStates.notSet')}
            </p>
          </div>

          <div>
            <p className="font-medium text-slate-950">
              {t('aiSuggestions.detail.allDay')}
            </p>
            <p className="mt-1 text-slate-600">
              {suggestion.externalCalendarEvent.isAllDay
                ? t('common.labels.yes')
                : t('common.labels.no')}
            </p>
          </div>

          <div>
            <p className="font-medium text-slate-950">Organizer</p>
            <p className="mt-1 text-slate-600">
              {suggestion.externalCalendarEvent.organizerName ||
                suggestion.externalCalendarEvent.organizerEmail ||
                t('common.emptyStates.unknownOrganizer')}
            </p>
            {suggestion.externalCalendarEvent.organizerEmail ? (
              <p className="mt-1 break-all text-xs text-slate-500">
                {suggestion.externalCalendarEvent.organizerEmail}
              </p>
            ) : null}
          </div>

          <div>
            <p className="font-medium text-slate-950">iCal UID</p>
            <p className="mt-1 break-all text-slate-600">
              {suggestion.externalCalendarEvent.iCalUid ??
                t('common.emptyStates.notSet')}
            </p>
          </div>

          <div>
            <p className="font-medium text-slate-950">Synced at</p>
            <p className="mt-1 text-slate-600">
              {formatDateTime(suggestion.externalCalendarEvent.syncedAt)}
            </p>
          </div>

          {suggestion.externalCalendarEvent.location ? (
            <div>
              <p className="font-medium text-slate-950">
                {t('externalSync.labels.location')}
              </p>
              <p className="mt-1 text-slate-600">
                {suggestion.externalCalendarEvent.location}
              </p>
            </div>
          ) : null}

          {suggestion.externalCalendarEvent.htmlLink ? (
            <div>
              <p className="font-medium text-slate-950">
                {t('aiSuggestions.detail.googleCalendarLink')}
              </p>
              <a
                href={suggestion.externalCalendarEvent.htmlLink}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex text-blue-700 hover:text-blue-800"
              >
                {t('aiSuggestions.detail.openEvent')}
              </a>
            </div>
          ) : null}
        </>
      ) : (
        <div className="md:col-span-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-slate-500">
          {t('aiSuggestions.detail.calendarMetadataMissing')}
        </div>
      )}

      <div>
        <p className="font-medium text-slate-950">
          {t('aiSuggestions.detail.externalCalendarEventId')}
        </p>
        <p className="mt-1 break-all text-slate-600">
          {suggestion.externalCalendarEventId ?? 'Not linked'}
        </p>
      </div>

      <div>
        <p className="font-medium text-slate-950">
          {t('aiSuggestions.detail.externalCalendarId')}
        </p>
        <p className="mt-1 break-all text-slate-600">
          {String(
            suggestion.metadataJson?.externalCalendarId ??
              t('common.emptyStates.notSet'),
          )}
        </p>
      </div>

      <div>
        <p className="font-medium text-slate-950">
          {t('aiSuggestions.detail.externalEventId')}
        </p>
        <p className="mt-1 break-all text-slate-600">
          {String(
            suggestion.metadataJson?.externalEventId ??
              t('common.emptyStates.notSet'),
          )}
        </p>
      </div>

      <div>
        <p className="font-medium text-slate-950">
          {t('aiSuggestions.detail.connectedAccountId')}
        </p>
        <p className="mt-1 break-all text-slate-600">
          {String(
            suggestion.metadataJson?.connectedAccountId ??
              t('common.emptyStates.notSet'),
          )}
        </p>
      </div>

      <div>
        <p className="font-medium text-slate-950">
          {t('aiSuggestions.detail.analysisScope')}
        </p>
        <p className="mt-1 text-slate-600">
          {String(suggestion.metadataJson?.aiAnalysisScope ?? 'metadata_only')}
        </p>
      </div>

      <div>
        <p className="font-medium text-slate-950">
          {t('aiSuggestions.detail.crmRecordsCreated')}
        </p>
        <p className="mt-1 text-slate-600">
          {formatBooleanFlag(suggestion.metadataJson?.crmRecordsCreated, t)}
        </p>
      </div>

      <div>
        <p className="font-medium text-slate-950">
          {t('aiSuggestions.detail.emailSentAutomatically')}
        </p>
        <p className="mt-1 text-slate-600">
          {formatBooleanFlag(
            suggestion.metadataJson?.emailSentAutomatically,
            t,
          )}
        </p>
      </div>
    </div>
  </article>
              ) : null}

              {isExternalCalendarSuggestion &&
              suggestion.outputJson &&
              isExternalCalendarEventAnalysisOutput(suggestion.outputJson) ? (
                <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                    <div>
                      <p className="text-sm font-medium text-blue-700">
                        {t('aiSuggestions.detail.externalCalendarReview')}
                      </p>
                      <h2 className="mt-1 text-lg font-semibold text-slate-950">
                        {t('aiSuggestions.detail.syncedCalendarMetadata')}
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {t('aiSuggestions.detail.calendarReviewDescription')}
                      </p>
                    </div>

                    <Badge className="bg-blue-50 text-blue-700 ring-blue-200">
                      {formatEnumLabel(suggestion.outputJson.suggestedReviewAction)}
                    </Badge>
                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-medium text-slate-950">
                        {t('aiSuggestions.detail.importance')}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {formatEnumLabel(suggestion.outputJson.importanceLevel)}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-medium text-slate-950">
                        {t('aiSuggestions.detail.suggestedAction')}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {formatEnumLabel(suggestion.outputJson.suggestedReviewAction)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 space-y-5 text-sm text-slate-700">
                    <div>
                      <p className="font-medium text-slate-950">
                        {t('aiSuggestions.detail.summary')}
                      </p>
                      <p className="mt-1 leading-6">{suggestion.outputJson.summary}</p>
                    </div>

                    <div>
                      <p className="font-medium text-slate-950">
                        {t('aiSuggestions.detail.detectedSignals')}
                      </p>

                      {suggestion.outputJson.detectedSignals.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {suggestion.outputJson.detectedSignals.map((signal) => (
                            <Badge
                              key={signal}
                              className="bg-slate-100 text-slate-700 ring-slate-200"
                            >
                              {formatEnumLabel(signal)}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-1 leading-6 text-slate-500">
                          {t('aiSuggestions.detail.noSignalsDetected')}
                        </p>
                      )}
                    </div>

                    <div>
                      <p className="font-medium text-slate-950">
                        {t('aiSuggestions.detail.suggestedNote')}
                      </p>
                      <p className="mt-1 leading-6">{suggestion.outputJson.suggestedNote}</p>
                    </div>

                    <div>
                      <p className="font-medium text-slate-950">
                        {t('aiSuggestions.detail.suggestedTasks')}
                      </p>

                      {suggestion.outputJson.suggestedTasks.length > 0 ? (
                        <div className="mt-2 space-y-3">
                          {suggestion.outputJson.suggestedTasks.map((task) => (
                            <div
                              key={`${task.title}-${task.dueInDays}`}
                              className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                            >
                              <p className="font-medium text-slate-950">{task.title}</p>
                              <p className="mt-1 leading-6">{task.description}</p>
                              <p className="mt-2 text-xs text-slate-500">
                                {t('common.labels.priority')}:{' '}
                                {getPriorityLabel(task.priority, t)} ·{' '}
                                {t('common.labels.dueIn')} {task.dueInDays}{' '}
                                {t('common.labels.days')}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-1 leading-6 text-slate-500">
                          {t('aiSuggestions.detail.noTaskCandidate')}
                        </p>
                      )}
                    </div>

                    <div>
                      <p className="font-medium text-slate-950">
                        {t('aiSuggestions.detail.reasoningSummary')}
                      </p>
                      <p className="mt-1 leading-6">
                        {suggestion.outputJson.reasoningSummary}
                      </p>
                    </div>
                  </div>
                </article>
              ) : null}

              {isExternalEmailSuggestion &&
                suggestion.outputJson &&
                isExternalEmailAnalysisOutput(suggestion.outputJson) ? (
                <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                    <div>
                      <p className="text-sm font-medium text-blue-700">
                        {t('aiSuggestions.detail.externalEmailReview')}
                      </p>
                      <h2 className="mt-1 text-lg font-semibold text-slate-950">
                        {t('aiSuggestions.detail.syncedEmailMetadata')}
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {t('aiSuggestions.detail.emailReviewDescription')}
                      </p>
                    </div>

                    <Badge className="bg-blue-50 text-blue-700 ring-blue-200">
                      {formatEnumLabel(suggestion.outputJson.suggestedReviewAction)}
                    </Badge>
                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-medium text-slate-950">
                        {t('aiSuggestions.detail.importance')}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {formatEnumLabel(suggestion.outputJson.importanceLevel)}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-medium text-slate-950">
                        {t('aiSuggestions.detail.suggestedAction')}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {formatEnumLabel(suggestion.outputJson.suggestedReviewAction)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 space-y-5 text-sm text-slate-700">
                    <div>
                      <p className="font-medium text-slate-950">
                        {t('aiSuggestions.detail.summary')}
                      </p>
                      <p className="mt-1 leading-6">{suggestion.outputJson.summary}</p>
                    </div>

                    <div>
                      <p className="font-medium text-slate-950">
                        {t('aiSuggestions.detail.detectedSignals')}
                      </p>

                      {suggestion.outputJson.detectedSignals.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {suggestion.outputJson.detectedSignals.map((signal) => (
                            <Badge
                              key={signal}
                              className="bg-slate-100 text-slate-700 ring-slate-200"
                            >
                              {formatEnumLabel(signal)}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-1 leading-6 text-slate-500">
                          {t('aiSuggestions.detail.noSignalsDetected')}
                        </p>
                      )}
                    </div>

                    <div>
                      <p className="font-medium text-slate-950">
                        {t('aiSuggestions.detail.suggestedNote')}
                      </p>
                      <p className="mt-1 leading-6">{suggestion.outputJson.suggestedNote}</p>
                    </div>

                    <div>
                      <p className="font-medium text-slate-950">
                        {t('aiSuggestions.detail.suggestedTasks')}
                      </p>

                      {suggestion.outputJson.suggestedTasks.length > 0 ? (
                        <div className="mt-2 space-y-3">
                          {suggestion.outputJson.suggestedTasks.map((task) => (
                            <div
                              key={`${task.title}-${task.dueInDays}`}
                              className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                            >
                              <p className="font-medium text-slate-950">{task.title}</p>
                              <p className="mt-1 leading-6">{task.description}</p>
                              <p className="mt-2 text-xs text-slate-500">
                                {t('common.labels.priority')}:{' '}
                                {getPriorityLabel(task.priority, t)} ·{' '}
                                {t('common.labels.dueIn')} {task.dueInDays}{' '}
                                {t('common.labels.days')}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-1 leading-6 text-slate-500">
                          {t('aiSuggestions.detail.noTaskCandidate')}
                        </p>
                      )}
                    </div>

                    <div>
                      <p className="font-medium text-slate-950">
                        {t('aiSuggestions.detail.reasoningSummary')}
                      </p>
                      <p className="mt-1 leading-6">
                        {suggestion.outputJson.reasoningSummary}
                      </p>
                    </div>
                  </div>
                </article>
              ) : null}

              {reviewMessage ? (
                <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm font-medium text-emerald-800">
                  {reviewMessage}
                </article>
              ) : null}

            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">
                {t('aiSuggestions.detail.reviewAction')}
              </h2>

                          {suggestion.metadataJson?.review &&
            typeof suggestion.metadataJson.review === 'object' &&
            'note' in suggestion.metadataJson.review ? (
              <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-950">
                  Review note
                </h2>

                <p className="mt-3 text-sm leading-6 text-slate-700">
                  {String(suggestion.metadataJson.review.note ?? 'No note')}
                </p>
                    </article>
                  ) : null}

                  {applyMessage ? (
        <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm font-medium text-emerald-800">
          {applyMessage}
        </article>
      ) : null}

        {isLeadNextStepsSuggestion &&
        (suggestion.status === 'ACCEPTED' ||
        suggestion.status === 'EDITED_AND_ACCEPTED') ? (
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <p className="text-sm font-medium text-blue-700">
              {t('aiSuggestions.detail.applyToCrm')}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">
              {t('aiSuggestions.detail.convertToCrmData')}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {t('aiSuggestions.detail.explicitApplyDescription')}
            </p>
          </div>

          <div className="mt-6 space-y-6">
            <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                <div>
                  <h3 className="font-semibold text-slate-950">
                    {t('aiSuggestions.detail.applyRecommendedNextStep')}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {t('aiSuggestions.detail.updatesLeadNextStep')}
                  </p>
                </div>

                {nextStepApplied ? (
                  <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200">
                    {t('common.actions.applied')}
                  </Badge>
                ) : null}
              </div>

              <textarea
                value={nextStepDraft}
                onChange={(event) => setNextStepDraft(event.target.value)}
                rows={4}
                disabled={nextStepApplied || !canApplySuggestion}
                className="mt-4 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
              />

              <button
                type="button"
                onClick={handleApplyNextStep}
                disabled={
                  !canApplySuggestion ||
                  nextStepApplied ||
                  isApplying !== null ||
                  !nextStepDraft.trim()
                }
                className="mt-3 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isApplying === 'lead-next-step'
                  ? t('common.actions.applying')
                  : nextStepApplied
                    ? t('aiSuggestions.completedActions.nextStepApplied')
                    : t('common.actions.applyNextStep')}
              </button>
            </section>

            <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                <div>
                  <h3 className="font-semibold text-slate-950">
                    {t('aiSuggestions.detail.createSuggestedTask')}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {t('aiSuggestions.detail.createsOfficialTask')}
                  </p>
                </div>

                {taskApplied ? (
                  <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200">
                    {t('common.actions.applied')}
                  </Badge>
                ) : null}
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="space-y-2 md:col-span-2">
                  <span className="text-sm font-medium text-slate-700">
                    {t('aiSuggestions.detail.title')}
                  </span>
                  <input
                    value={taskTitleDraft}
                    onChange={(event) => setTaskTitleDraft(event.target.value)}
                    disabled={taskApplied || !canApplySuggestion}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </label>

                <label className="space-y-2 md:col-span-2">
                  <span className="text-sm font-medium text-slate-700">
                    {t('aiSuggestions.detail.description')}
                  </span>
                  <textarea
                    value={taskDescriptionDraft}
                    onChange={(event) =>
                      setTaskDescriptionDraft(event.target.value)
                    }
                    rows={3}
                    disabled={taskApplied || !canApplySuggestion}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">
                    {t('aiSuggestions.detail.priority')}
                  </span>
                  <select
                    value={taskPriorityDraft}
                    onChange={(event) =>
                      setTaskPriorityDraft(
                        event.target.value as
                          | 'LOW'
                          | 'MEDIUM'
                          | 'HIGH'
                          | 'CRITICAL',
                      )
                    }
                    disabled={taskApplied || !canApplySuggestion}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value="LOW">{t('aiSuggestions.detail.low')}</option>
                    <option value="MEDIUM">{t('aiSuggestions.detail.medium')}</option>
                    <option value="HIGH">{t('aiSuggestions.detail.high')}</option>
                    <option value="CRITICAL">{t('aiSuggestions.detail.critical')}</option>
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">
                    {t('aiSuggestions.detail.dueDateOptional')}
                  </span>
                  <input
                    type="datetime-local"
                    value={taskDueDateDraft}
                    onChange={(event) => setTaskDueDateDraft(event.target.value)}
                    disabled={taskApplied || !canApplySuggestion}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </label>
              </div>

              <button
                type="button"
                onClick={handleCreateTask}
                disabled={
                  !canApplySuggestion ||
                  taskApplied ||
                  isApplying !== null ||
                  !taskTitleDraft.trim()
                }
                className="mt-3 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isApplying === 'task'
                  ? t('common.actions.creating')
                  : taskApplied
                    ? t('aiSuggestions.detail.taskCreated')
                    : t('aiSuggestions.detail.createTask')}
              </button>
            </section>

            <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                <div>
                  <h3 className="font-semibold text-slate-950">
                    {t('aiSuggestions.detail.createSuggestedNote')}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {t('aiSuggestions.detail.createsOfficialNote')}
                  </p>
                </div>

                {noteApplied ? (
                  <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200">
                    {t('common.actions.applied')}
                  </Badge>
                ) : null}
              </div>

              <div className="mt-4 space-y-3">
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-700">
                    {t('aiSuggestions.detail.title')}
                  </span>
                  <input
                    value={noteTitleDraft}
                    onChange={(event) => setNoteTitleDraft(event.target.value)}
                    disabled={noteApplied || !canApplySuggestion}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-700">
                    {t('aiSuggestions.detail.content')}
                  </span>
                  <textarea
                    value={noteContentDraft}
                    onChange={(event) => setNoteContentDraft(event.target.value)}
                    rows={4}
                    disabled={noteApplied || !canApplySuggestion}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </label>
              </div>

              <button
                type="button"
                onClick={handleCreateNote}
                disabled={
                  !canApplySuggestion ||
                  noteApplied ||
                  isApplying !== null ||
                  !noteContentDraft.trim()
                }
                className="mt-3 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isApplying === 'note'
                  ? t('common.actions.creating')
                  : noteApplied
                    ? t('aiSuggestions.detail.noteCreated')
                    : t('aiSuggestions.detail.createNote')}
              </button>
            </section>
          </div>
        </article>
      ) : null}

        {isExternalCalendarSuggestion && externalCalendarTaskApplied ? (
        <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
          <div>
            <p className="text-sm font-medium text-emerald-700">
              {t('aiSuggestions.detail.externalCalendarAction')}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-emerald-950">
              {t('aiSuggestions.completedActions.taskCreated')}
            </h2>
            <p className="mt-2 text-sm leading-6 text-emerald-800">
              {t('aiSuggestions.detail.calendarTaskCompletedSafety')}
            </p>
          </div>

          <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
            <div>
              <p className="font-medium text-emerald-950">
                {t('aiSuggestions.detail.taskId')}
              </p>
              <p className="mt-1 break-all text-emerald-800">
                {externalCalendarTaskId ?? t('aiSuggestions.detail.created')}
              </p>
            </div>

            {externalCalendarTaskAppliedAt ? (
              <div>
                <p className="font-medium text-emerald-950">
                  {t('aiSuggestions.detail.appliedAt')}
                </p>
                <p className="mt-1 text-emerald-800">
                  {formatDateTime(externalCalendarTaskAppliedAt)}
                </p>
              </div>
            ) : null}

            {externalCalendarTaskAppliedByUserId ? (
              <div>
                <p className="font-medium text-emerald-950">
                  {t('aiSuggestions.detail.appliedByUserId')}
                </p>
                <p className="mt-1 break-all text-emerald-800">
                  {externalCalendarTaskAppliedByUserId}
                </p>
              </div>
            ) : null}
          </div>
        </article>
      ) : null}

        {canApplyExternalCalendarTask && !externalCalendarTaskApplied ? (
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <p className="text-sm font-medium text-blue-700">
              {t('aiSuggestions.detail.externalCalendarAction')}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">
              {t('aiSuggestions.detail.createCalendarTaskTitle')}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {t('aiSuggestions.detail.createCalendarTaskDescription')}
            </p>
          </div>

          <section className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
              <div>
                <h3 className="font-semibold text-slate-950">
                  {t('common.actions.createCrmTask')}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {t('aiSuggestions.detail.calendarTaskPayloadDescription')}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCreateExternalCalendarTask}
              disabled={
                !canApplyExternalCalendarTask ||
                externalCalendarTaskApplied ||
                isApplying !== null
              }
              className="mt-3 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isApplying === 'external-calendar-task'
                ? t('common.actions.creating')
                : externalCalendarTaskApplied
                  ? t('aiSuggestions.completedActions.taskCreated')
                  : t('common.actions.createCrmTask')}
            </button>
          </section>
        </article>
      ) : null}

        {isExternalCalendarSuggestion && externalCalendarNoteApplied ? (
        <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
          <div>
            <p className="text-sm font-medium text-emerald-700">
              {t('aiSuggestions.detail.externalCalendarAction')}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-emerald-950">
              {t('aiSuggestions.completedActions.noteCreated')}
            </h2>
            <p className="mt-2 text-sm leading-6 text-emerald-800">
              {t('aiSuggestions.detail.calendarNoteCompletedSafety')}
            </p>
          </div>

          <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
            <div>
              <p className="font-medium text-emerald-950">
                {t('aiSuggestions.detail.noteId')}
              </p>
              <p className="mt-1 break-all text-emerald-800">
                {externalCalendarNoteId ?? t('aiSuggestions.detail.created')}
              </p>
            </div>

            {externalCalendarNoteAppliedAt ? (
              <div>
                <p className="font-medium text-emerald-950">
                  {t('aiSuggestions.detail.appliedAt')}
                </p>
                <p className="mt-1 text-emerald-800">
                  {formatDateTime(externalCalendarNoteAppliedAt)}
                </p>
              </div>
            ) : null}

            {externalCalendarNoteAppliedByUserId ? (
              <div>
                <p className="font-medium text-emerald-950">
                  {t('aiSuggestions.detail.appliedByUserId')}
                </p>
                <p className="mt-1 break-all text-emerald-800">
                  {externalCalendarNoteAppliedByUserId}
                </p>
              </div>
            ) : null}
          </div>
        </article>
      ) : null}

        {canApplyExternalCalendarNote && !externalCalendarNoteApplied ? (
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <p className="text-sm font-medium text-blue-700">
              {t('aiSuggestions.detail.externalCalendarAction')}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">
              {t('aiSuggestions.detail.createCalendarNoteTitle')}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {t('aiSuggestions.detail.createCalendarNoteDescription')}
            </p>
          </div>

          <section className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
              <div>
                <h3 className="font-semibold text-slate-950">
                  {t('common.actions.createCrmNote')}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {t('aiSuggestions.detail.calendarNotePayloadDescription')}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCreateExternalCalendarNote}
              disabled={
                !canApplyExternalCalendarNote ||
                externalCalendarNoteApplied ||
                isApplying !== null
              }
              className="mt-3 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isApplying === 'external-calendar-note'
                ? t('common.actions.creating')
                : externalCalendarNoteApplied
                  ? t('aiSuggestions.completedActions.noteCreated')
                  : t('common.actions.createCrmNote')}
            </button>
          </section>
        </article>
      ) : null}

        {isExternalCalendarSuggestion && externalCalendarLeadApplied ? (
        <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
          <div>
            <p className="text-sm font-medium text-emerald-700">
              {t('aiSuggestions.detail.externalCalendarAction')}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-emerald-950">
              {t('aiSuggestions.completedActions.leadCreated')}
            </h2>
            <p className="mt-2 text-sm leading-6 text-emerald-800">
              {t('aiSuggestions.detail.calendarLeadCompletedSafety')}
            </p>
          </div>

          <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
            <div>
              <p className="font-medium text-emerald-950">
                {t('aiSuggestions.detail.leadId')}
              </p>
              <p className="mt-1 break-all text-emerald-800">
                {externalCalendarLeadId ?? t('aiSuggestions.detail.created')}
              </p>
            </div>

            {externalCalendarLeadAppliedAt ? (
              <div>
                <p className="font-medium text-emerald-950">
                  {t('aiSuggestions.detail.appliedAt')}
                </p>
                <p className="mt-1 text-emerald-800">
                  {formatDateTime(externalCalendarLeadAppliedAt)}
                </p>
              </div>
            ) : null}

            {externalCalendarLeadAppliedByUserId ? (
              <div>
                <p className="font-medium text-emerald-950">
                  {t('aiSuggestions.detail.appliedByUserId')}
                </p>
                <p className="mt-1 break-all text-emerald-800">
                  {externalCalendarLeadAppliedByUserId}
                </p>
              </div>
            ) : null}
          </div>
        </article>
      ) : null}

        {canApplyExternalCalendarLead && !externalCalendarLeadApplied ? (
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <p className="text-sm font-medium text-blue-700">
              {t('aiSuggestions.detail.externalCalendarAction')}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">
              {t('aiSuggestions.detail.createCalendarLeadTitle')}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {t('aiSuggestions.detail.createCalendarLeadDescription')}
            </p>
          </div>

          <section className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
              <div>
                <h3 className="font-semibold text-slate-950">
                  {t('common.actions.createCrmLead')}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {t('aiSuggestions.detail.calendarLeadPayloadDescription')}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCreateExternalCalendarLead}
              disabled={
                !canApplyExternalCalendarLead ||
                externalCalendarLeadApplied ||
                isApplying !== null
              }
              className="mt-3 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isApplying === 'external-calendar-lead'
                ? t('common.actions.creating')
                : externalCalendarLeadApplied
                  ? t('aiSuggestions.completedActions.leadCreated')
                  : t('common.actions.createCrmLead')}
            </button>
          </section>
        </article>
      ) : null}

        {canApplyExternalEmailLead && !externalEmailLeadApplied ? (
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <p className="text-sm font-medium text-blue-700">
              {t('aiSuggestions.detail.externalEmailAction')}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">
              {t('aiSuggestions.detail.createEmailLeadTitle')}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {t('aiSuggestions.detail.createEmailLeadDescription')}
            </p>
          </div>

          <section className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
              <div>
                <h3 className="font-semibold text-slate-950">
                  {t('common.actions.createCrmLead')}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {t('aiSuggestions.detail.emailLeadPayloadDescription')}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCreateExternalEmailLead}
              disabled={
                !canApplyExternalEmailLead ||
                externalEmailLeadApplied ||
                isApplying !== null
              }
              className="mt-3 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isApplying === 'external-email-lead'
                ? t('common.actions.creating')
                : externalEmailLeadApplied
                  ? t('aiSuggestions.completedActions.leadCreated')
                  : t('common.actions.createCrmLead')}
            </button>
          </section>
        </article>
      ) : null}

        {canApplyExternalEmailTask && !externalEmailTaskApplied ? (
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <p className="text-sm font-medium text-blue-700">
              {t('aiSuggestions.detail.externalEmailAction')}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">
              {t('aiSuggestions.detail.createEmailTaskTitle')}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {t('aiSuggestions.detail.createEmailTaskDescription')}
            </p>
          </div>

          <section className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
              <div>
                <h3 className="font-semibold text-slate-950">
                  {t('common.actions.createCrmTask')}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {t('aiSuggestions.detail.emailTaskPayloadDescription')}
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-slate-700">
                  {t('aiSuggestions.detail.title')}
                </span>
                <input
                  value={taskTitleDraft}
                  onChange={(event) => setTaskTitleDraft(event.target.value)}
                  disabled={externalEmailTaskApplied || !canApplyExternalEmailTask}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-slate-700">
                  {t('aiSuggestions.detail.description')}
                </span>
                <textarea
                  value={taskDescriptionDraft}
                  onChange={(event) => setTaskDescriptionDraft(event.target.value)}
                  rows={3}
                  disabled={externalEmailTaskApplied || !canApplyExternalEmailTask}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  {t('aiSuggestions.detail.priority')}
                </span>
                <select
                  value={taskPriorityDraft}
                  onChange={(event) =>
                    setTaskPriorityDraft(
                      event.target.value as
                        | 'LOW'
                        | 'MEDIUM'
                        | 'HIGH'
                        | 'CRITICAL',
                    )
                  }
                  disabled={externalEmailTaskApplied || !canApplyExternalEmailTask}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="LOW">{t('aiSuggestions.detail.low')}</option>
                  <option value="MEDIUM">{t('aiSuggestions.detail.medium')}</option>
                  <option value="HIGH">{t('aiSuggestions.detail.high')}</option>
                  <option value="CRITICAL">{t('aiSuggestions.detail.critical')}</option>
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  {t('aiSuggestions.detail.dueDateOptional')}
                </span>
                <input
                  type="datetime-local"
                  value={taskDueDateDraft}
                  onChange={(event) => setTaskDueDateDraft(event.target.value)}
                  disabled={externalEmailTaskApplied || !canApplyExternalEmailTask}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={handleCreateExternalEmailTask}
              disabled={
                !canApplyExternalEmailTask ||
                externalEmailTaskApplied ||
                isApplying !== null
              }
              className="mt-3 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isApplying === 'external-email-task'
                ? t('common.actions.creating')
                : externalEmailTaskApplied
                  ? t('aiSuggestions.completedActions.taskCreated')
                  : t('common.actions.createCrmTask')}
            </button>
          </section>
        </article>
      ) : null}

        {isExternalEmailSuggestion &&
        (suggestion.status === 'ACCEPTED' ||
        suggestion.status === 'EDITED_AND_ACCEPTED') &&
        !externalEmailNoteApplied ? (
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <p className="text-sm font-medium text-blue-700">
              {t('aiSuggestions.detail.externalEmailAction')}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">
              {t('aiSuggestions.detail.createEmailNoteTitle')}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {t('aiSuggestions.detail.createEmailNoteDescription')}
            </p>
          </div>

          <section className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
              <div>
                <h3 className="font-semibold text-slate-950">
                  {t('common.actions.createCrmNote')}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {t('aiSuggestions.detail.emailNotePayloadDescription')}
                </p>
              </div>

              {externalEmailNoteApplied ? (
                <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200">
                  {t('common.actions.applied')}
                </Badge>
              ) : null}
            </div>

            <div className="mt-4 space-y-3">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  {t('aiSuggestions.detail.title')}
                </span>
                <input
                  value={noteTitleDraft}
                  onChange={(event) => setNoteTitleDraft(event.target.value)}
                  disabled={externalEmailNoteApplied || !canApplyExternalEmailNote}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  {t('aiSuggestions.detail.content')}
                </span>
                <textarea
                  value={noteContentDraft}
                  onChange={(event) => setNoteContentDraft(event.target.value)}
                  rows={4}
                  disabled={externalEmailNoteApplied || !canApplyExternalEmailNote}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={handleCreateExternalEmailNote}
              disabled={
                !canApplyExternalEmailNote ||
                externalEmailNoteApplied ||
                isApplying !== null ||
                !noteContentDraft.trim()
              }
              className="mt-3 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isApplying === 'external-email-note'
                ? t('common.actions.creating')
                : externalEmailNoteApplied
                  ? t('aiSuggestions.completedActions.noteCreated')
                  : t('common.actions.createCrmNote')}
            </button>
          </section>
        </article>
      ) : null}

              {suggestion.status === 'PENDING_REVIEW' ? (
                <div className="mt-4 space-y-4">
                  <p className="text-sm leading-6 text-slate-600">
                    {t('aiSuggestions.detail.reviewDecisionDescription')}
                  </p>

                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-slate-700">
                      {t('aiSuggestions.detail.reviewNote')}
                    </span>

                    <textarea
                      value={reviewNote}
                      onChange={(event) => setReviewNote(event.target.value)}
                      rows={4}
                      maxLength={1000}
                      placeholder={t('aiSuggestions.detail.reviewNotePlaceholder')}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />
                  </label>

                  <div className="flex flex-wrap gap-2">
                    {canReviewSuggestion ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleReview('accept')}
                          disabled={isReviewing}
                          className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isReviewing
                            ? t('common.actions.saving')
                            : t('common.actions.accept')}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleReview('reject')}
                          disabled={isReviewing}
                          className="rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isReviewing
                            ? t('common.actions.saving')
                            : t('common.actions.reject')}
                        </button>
                      </>
                    ) : (
                      <p className="text-sm text-slate-500">
                        {t('aiSuggestions.detail.noReviewPermission')}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  {t('aiSuggestions.detail.alreadyReviewedPrefix')}{' '}
                  <span className="font-semibold">
                    {getAiStatusLabel(suggestion.status, t)}
                  </span>
                  . {t('aiSuggestions.detail.alreadyReviewedSuffix')}
                </div>
              )}
            </article>
          </section>



          <aside className="space-y-4">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-slate-950">
                {t('aiSuggestions.detail.suggestionInfo')}
              </h2>

              <dl className="mt-4 space-y-3 text-sm">
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
                    {suggestion.metadataJson?.model ??
                      t('common.emptyStates.notSet')}
                  </dd>
                </div>

                <div>
                  <dt className="text-slate-500">
                    {t('aiSuggestions.detail.tokens')}
                  </dt>
                  <dd className="font-medium text-slate-800">
                    {t('common.labels.input')} {suggestion.tokensInput ?? 0} ·{' '}
                    {t('common.labels.output')}{' '}
                    {suggestion.tokensOutput ?? 0}
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
              </dl>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-slate-950">
                {t('aiSuggestions.detail.safetyFlags')}
              </h2>

              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-slate-500">
                    {t('aiSuggestions.detail.humanApprovalRequired')}
                  </dt>
                  <dd className="font-medium text-slate-800">
                    {String(
                      suggestion.metadataJson?.humanApprovalRequired ?? true,
                    )}
                  </dd>
                </div>

                <div>
                  <dt className="text-slate-500">
                    {t('aiSuggestions.detail.canApplyAutomatically')}
                  </dt>
                  <dd className="font-medium text-slate-800">
                    {String(
                      suggestion.metadataJson?.canApplyAutomatically ?? false,
                    )}
                  </dd>
                </div>

                <div>
                  <dt className="text-slate-500">
                    {t('aiSuggestions.detail.canSendEmailAutomatically')}
                  </dt>
                  <dd className="font-medium text-slate-800">
                    {String(
                      suggestion.metadataJson?.canSendEmailAutomatically ??
                        false,
                    )}
                  </dd>
                </div>
              </dl>
            </article>
          </aside>
        </div>
        </>
      ) : null}
    </div>
  );
}
