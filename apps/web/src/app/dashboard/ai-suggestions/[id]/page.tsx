// FILE: apps/web/src/app/dashboard/ai-suggestions/[id]/page.tsx
'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import { useAuth } from '@/hooks/useAuth';
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

function formatConfidence(value: number | null) {
  if (value === null) {
    return 'Not set';
  }

  return `${Math.round(value * 100)}%`;
}

function formatMetadataConfidence(value: unknown, fallback: number | null) {
  if (typeof value === 'number') {
    return formatConfidence(value);
  }

  return formatConfidence(fallback);
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

function formatBooleanFlag(value: unknown) {
  if (value === true) {
    return 'Yes';
  }

  if (value === false) {
    return 'No';
  }

  return 'Not set';
}

function getMetadataString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

type AppliedActionName =
  | 'UPDATE_LEAD_NEXT_STEP'
  | 'CREATE_TASK'
  | 'CREATE_NOTE'
  | 'CREATE_NOTE_FROM_EXTERNAL_EMAIL'
  | 'CREATE_TASK_FROM_EXTERNAL_EMAIL'
  | 'CREATE_LEAD_FROM_EXTERNAL_EMAIL'
  | 'CREATE_TASK_FROM_EXTERNAL_CALENDAR'
  | 'CREATE_NOTE_FROM_EXTERNAL_CALENDAR'
  | 'CREATE_LEAD_FROM_EXTERNAL_CALENDAR'
  | 'CREATE_GMAIL_DRAFT_FROM_EMAIL_REPLY_SUGGESTION';

export default function AiSuggestionDetailPage() {
  const params = useParams<{ id: string }>();
  const { token, user } = useAuth();

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
        setErrorMessage('Could not load AI suggestion.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [params.id, token]);

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

      setNoteTitleDraft('AI suggested note');
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

      setNoteTitleDraft('AI suggested email review note');
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

      setNoteTitleDraft('AI suggested calendar review note');
      setNoteContentDraft(suggestion.outputJson.suggestedNote ?? '');
    }
  }, [suggestion]);

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
          ? 'Suggestion accepted for review. No CRM changes were applied.'
          : 'Suggestion rejected. No CRM changes were applied.',
      );
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Could not review AI suggestion.');
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
    setApplyMessage('Next step applied to the lead.');
  } catch (error) {
    if (error instanceof ApiClientError) {
      setErrorMessage(error.message);
    } else if (error instanceof Error) {
      setErrorMessage(error.message);
    } else {
      setErrorMessage('Could not apply next step.');
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
    setApplyMessage('Task created from AI suggestion.');
  } catch (error) {
    if (error instanceof ApiClientError) {
      setErrorMessage(error.message);
    } else if (error instanceof Error) {
      setErrorMessage(error.message);
    } else {
      setErrorMessage('Could not create task from suggestion.');
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
    setApplyMessage('Note created from AI suggestion.');
  } catch (error) {
    if (error instanceof ApiClientError) {
      setErrorMessage(error.message);
    } else if (error instanceof Error) {
      setErrorMessage(error.message);
    } else {
      setErrorMessage('Could not create note from suggestion.');
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
      `CRM note created from external email review. Note ID: ${response.note.id}. No email was sent.`,
    );
  } catch (error) {
    if (error instanceof ApiClientError) {
      setErrorMessage(error.message);
    } else if (error instanceof Error) {
      setErrorMessage(error.message);
    } else {
      setErrorMessage('Could not create note from external email suggestion.');
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
      `CRM task created from external email review. Task ID: ${response.task.id}. No email was sent.`,
    );
  } catch (error) {
    if (error instanceof ApiClientError) {
      setErrorMessage(error.message);
    } else if (error instanceof Error) {
      setErrorMessage(error.message);
    } else {
      setErrorMessage('Could not create task from external email suggestion.');
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
      `CRM lead created from external email review. Lead ID: ${response.lead.id}. No email was sent.`,
    );
  } catch (error) {
    if (error instanceof ApiClientError) {
      setErrorMessage(error.message);
    } else if (error instanceof Error) {
      setErrorMessage(error.message);
    } else {
      setErrorMessage('Could not create lead from external email suggestion.');
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
      `CRM task created from external calendar review. Task ID: ${response.task.id}. No email was sent.`,
    );
  } catch (error) {
    if (error instanceof ApiClientError) {
      setErrorMessage(error.message);
    } else if (error instanceof Error) {
      setErrorMessage(error.message);
    } else {
      setErrorMessage('Could not create task from external calendar suggestion.');
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
      `CRM note created from external calendar review. Note ID: ${response.note.id}. No email was sent.`,
    );
  } catch (error) {
    if (error instanceof ApiClientError) {
      setErrorMessage(error.message);
    } else if (error instanceof Error) {
      setErrorMessage(error.message);
    } else {
      setErrorMessage('Could not create note from external calendar suggestion.');
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
      `CRM lead created from external calendar review. Lead ID: ${response.lead.id}. No email was sent.`,
    );
  } catch (error) {
    if (error instanceof ApiClientError) {
      setErrorMessage(error.message);
    } else if (error instanceof Error) {
      setErrorMessage(error.message);
    } else {
      setErrorMessage('Could not create lead from external calendar suggestion.');
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
      `Gmail draft created. Draft ID: ${response.gmailDraftId}. Email not sent automatically.`,
    );
  } catch (error) {
    if (error instanceof ApiClientError) {
      const lowerMessage = error.message.toLowerCase();

      if (error.status === 409) {
        setErrorMessage(
          'A Gmail draft has already been created for this suggestion.',
        );
      } else if (
        lowerMessage.includes('reconnect') ||
        lowerMessage.includes('not authorized') ||
        lowerMessage.includes('draft permissions') ||
        lowerMessage.includes('scope')
      ) {
        setErrorMessage(
          'Google needs to be reconnected with Gmail draft permissions before creating this draft.',
        );
      } else {
        setErrorMessage(error.message);
      }
    } else if (error instanceof Error) {
      setErrorMessage(error.message);
    } else {
      setErrorMessage('Could not create Gmail draft from suggestion.');
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
  'Not set';
const replyDraftTone =
  replyDraftOutput?.tone ?? getMetadataString(suggestion?.metadataJson?.tone);
const replyDraftConfidence = replyDraftOutput
  ? formatConfidence(replyDraftOutput.confidence)
  : formatMetadataConfidence(
      suggestion?.metadataJson?.confidence,
      suggestion?.confidenceScore ?? null,
    );
const replyDraftReasoning =
  replyDraftOutput?.reasoning ??
  getMetadataString(suggestion?.metadataJson?.reasoning) ??
  'No reasoning available.';
const replyDraftRecipientName = getMetadataString(
  suggestion?.externalEmailMessage?.fromName,
);
const replyDraftRecipientEmail = getMetadataString(
  suggestion?.externalEmailMessage?.fromEmail,
);
const replyDraftRecipient =
  replyDraftRecipientName && replyDraftRecipientEmail
    ? `${replyDraftRecipientName} <${replyDraftRecipientEmail}>`
    : replyDraftRecipientEmail ?? replyDraftRecipientName ?? 'Unknown recipient';

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
const externalCalendarTaskApplied = hasAppliedAction(
  suggestion,
  'CREATE_TASK_FROM_EXTERNAL_CALENDAR',
);
const externalCalendarNoteApplied = hasAppliedAction(
  suggestion,
  'CREATE_NOTE_FROM_EXTERNAL_CALENDAR',
);
const externalCalendarLeadApplied = hasAppliedAction(
  suggestion,
  'CREATE_LEAD_FROM_EXTERNAL_CALENDAR',
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
        title={suggestion?.title ?? 'AI Suggestion'}
        description="Review the AI-generated recommendation before applying any CRM changes."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/ai-suggestions"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Back to suggestions
            </Link>

            {suggestion?.leadId ? (
              <Link
                href={`/dashboard/leads/${suggestion.leadId}`}
                className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
              >
                View lead
              </Link>
            ) : null}
          </div>
        }
      />

      {isLoading ? <LoadingSkeleton rows={8} /> : null}

      {!isLoading && errorMessage ? <ErrorState message={errorMessage} /> : null}

      {!isLoading && !errorMessage && suggestion ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <section className="space-y-6">
            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex flex-wrap gap-2">
                <Badge className={getStatusClasses(suggestion.status)}>
                  {formatEnumLabel(suggestion.status)}
                </Badge>

                <Badge className="bg-indigo-50 text-indigo-700 ring-indigo-200">
                  {formatEnumLabel(suggestion.type)}
                </Badge>

                <Badge className="bg-slate-100 text-slate-700 ring-slate-200">
                  Confidence: {formatConfidence(suggestion.confidenceScore)}
                </Badge>
              </div>

              <h2 className="text-lg font-semibold text-slate-950">
                Suggested output
              </h2>

              <p className="mt-4 whitespace-pre-line text-sm leading-7 text-slate-700">
                {suggestion.outputText ?? 'No output text available.'}
              </p>
            </article>

              {suggestion.outputJson && isLeadNextStepsOutput(suggestion.outputJson) ? (
                <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-semibold text-slate-950">
                    Structured recommendation
                  </h2>

                  <div className="mt-5 space-y-5 text-sm text-slate-700">
                    <div>
                      <p className="font-medium text-slate-950">Summary</p>
                      <p className="mt-1 leading-6">{suggestion.outputJson.summary}</p>
                    </div>

                    <div>
                      <p className="font-medium text-slate-950">Recommended next step</p>
                      <p className="mt-1 leading-6">
                        {suggestion.outputJson.recommendedNextStep}
                      </p>
                    </div>

                    <div>
                      <p className="font-medium text-slate-950">Suggested note</p>
                      <p className="mt-1 leading-6">{suggestion.outputJson.suggestedNote}</p>
                    </div>

                    <div>
                      <p className="font-medium text-slate-950">Suggested tasks</p>

                      <div className="mt-2 space-y-3">
                        {suggestion.outputJson.suggestedTasks.map((task) => (
                          <div
                            key={`${task.title}-${task.dueInDays}`}
                            className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                          >
                            <p className="font-medium text-slate-950">{task.title}</p>
                            <p className="mt-1 leading-6">{task.description}</p>
                            <p className="mt-2 text-xs text-slate-500">
                              Priority: {formatEnumLabel(task.priority)} · Due in{' '}
                              {task.dueInDays} day(s)
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="font-medium text-slate-950">Reasoning summary</p>
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
                    External email metadata
                  </h2>

                  <div className="mt-5 grid gap-4 text-sm md:grid-cols-2">
                    {suggestion.externalEmailMessage ? (
                      <>
                        <div>
                          <p className="font-medium text-slate-950">Subject</p>
                          <p className="mt-1 text-slate-600">
                            {suggestion.externalEmailMessage.subject ?? 'No subject'}
                          </p>
                        </div>

                        <div>
                          <p className="font-medium text-slate-950">From</p>
                          <p className="mt-1 text-slate-600">
                            {suggestion.externalEmailMessage.fromName ||
                              suggestion.externalEmailMessage.fromEmail ||
                              'Unknown sender'}
                          </p>
                          {suggestion.externalEmailMessage.fromEmail ? (
                            <p className="mt-1 break-all text-xs text-slate-500">
                              {suggestion.externalEmailMessage.fromEmail}
                            </p>
                          ) : null}
                        </div>

                        <div className="md:col-span-2">
                          <p className="font-medium text-slate-950">Snippet</p>
                          <p className="mt-1 leading-6 text-slate-600">
                            {suggestion.externalEmailMessage.snippet ??
                              'No snippet available'}
                          </p>
                        </div>

                        <div>
                          <p className="font-medium text-slate-950">Internal date</p>
                          <p className="mt-1 text-slate-600">
                            {suggestion.externalEmailMessage.internalDate
                              ? formatDateTime(suggestion.externalEmailMessage.internalDate)
                              : 'Not set'}
                          </p>
                        </div>

                        <div>
                          <p className="font-medium text-slate-950">Synced at</p>
                          <p className="mt-1 text-slate-600">
                            {formatDateTime(suggestion.externalEmailMessage.syncedAt)}
                          </p>
                        </div>
                      </>
                    ) : (
                      <div className="md:col-span-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-slate-500">
                        Email metadata relation was not loaded.
                      </div>
                    )}

                    <div>
                      <p className="font-medium text-slate-950">External email message ID</p>
                      <p className="mt-1 break-all text-slate-600">
                        {suggestion.externalEmailMessageId ?? 'Not linked'}
                      </p>
                    </div>

                    <div>
                      <p className="font-medium text-slate-950">
                        External provider message ID
                      </p>
                      <p className="mt-1 break-all text-slate-600">
                        {String(suggestion.metadataJson?.externalMessageId ?? 'Not set')}
                      </p>
                    </div>

                    <div>
                      <p className="font-medium text-slate-950">External thread ID</p>
                      <p className="mt-1 break-all text-slate-600">
                        {String(suggestion.metadataJson?.externalThreadId ?? 'Not set')}
                      </p>
                    </div>

                    <div>
                      <p className="font-medium text-slate-950">Connected account ID</p>
                      <p className="mt-1 break-all text-slate-600">
                        {String(suggestion.metadataJson?.connectedAccountId ?? 'Not set')}
                      </p>
                    </div>

                    <div>
                      <p className="font-medium text-slate-950">Analysis scope</p>
                      <p className="mt-1 text-slate-600">
                        {String(suggestion.metadataJson?.aiAnalysisScope ?? 'metadata_only')}
                      </p>
                    </div>

                    <div>
                      <p className="font-medium text-slate-950">Body stored</p>
                      <p className="mt-1 text-slate-600">
                        {formatBooleanFlag(suggestion.metadataJson?.bodyStored)}
                      </p>
                    </div>

                    <div>
                      <p className="font-medium text-slate-950">CRM records created</p>
                      <p className="mt-1 text-slate-600">
                        {formatBooleanFlag(suggestion.metadataJson?.crmRecordsCreated)}
                      </p>
                    </div>

                    <div>
                      <p className="font-medium text-slate-950">Email sent automatically</p>
                      <p className="mt-1 text-slate-600">
                        {formatBooleanFlag(suggestion.metadataJson?.emailSentAutomatically)}
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
                        Email draft preview
                      </p>
                      <h2 className="mt-1 text-lg font-semibold text-slate-950">
                        Review suggested reply
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        Review the suggested reply before creating anything in Gmail.
                        Creating a Gmail draft requires your explicit action, and no
                        email is sent automatically.
                      </p>
                    </div>

                    <Badge
                      className={
                        gmailDraftApplied
                          ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                          : 'bg-amber-50 text-amber-700 ring-amber-200'
                      }
                    >
                      {gmailDraftApplied ? 'Gmail draft created' : 'Review only'}
                    </Badge>
                  </div>

                  <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
                    <div className="space-y-3 border-b border-slate-200 bg-slate-50 p-4 text-sm">
                      <div className="grid gap-1 md:grid-cols-[96px_1fr]">
                        <p className="font-medium text-slate-500">To</p>
                        <p className="break-words font-medium text-slate-950">
                          {replyDraftRecipient}
                        </p>
                      </div>

                      <div className="grid gap-1 md:grid-cols-[96px_1fr]">
                        <p className="font-medium text-slate-500">Subject</p>
                        <p className="break-words font-medium text-slate-950">
                          {replyDraftSubject}
                        </p>
                      </div>
                    </div>

                    <div className="bg-white p-5">
                      <p className="whitespace-pre-line text-sm leading-7 text-slate-700">
                        {suggestion.outputText ?? 'No reply draft available.'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-medium text-slate-950">Tone</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {replyDraftTone ? formatEnumLabel(replyDraftTone) : 'Not set'}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-medium text-slate-950">
                        Confidence
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {replyDraftConfidence}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-medium text-slate-950">
                        Analysis scope
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
                    <p className="text-sm font-medium text-slate-950">Reasoning</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {replyDraftReasoning}
                    </p>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    {[
                      'Human review required',
                      'Metadata-only analysis',
                      'No automatic email sending',
                      'No automatic CRM changes',
                      'Gmail draft creation requires explicit user action',
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
                        <p className="font-semibold">Gmail draft created</p>
                        <p className="mt-2 leading-6">
                          A Gmail draft was created. The email was NOT sent automatically.
                        </p>

                        <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                          <div>
                            <p className="font-medium">Gmail draft ID</p>
                            <p className="mt-1 break-all text-emerald-800">
                              {gmailDraftId ?? 'Created'}
                            </p>
                          </div>

                          {gmailThreadId ? (
                            <div>
                              <p className="font-medium">Gmail thread ID</p>
                              <p className="mt-1 break-all text-emerald-800">
                                {gmailThreadId}
                              </p>
                            </div>
                          ) : null}

                          {gmailDraftCreatedAt ? (
                            <div>
                              <p className="font-medium">Created at</p>
                              <p className="mt-1 text-emerald-800">
                                {formatDateTime(gmailDraftCreatedAt)}
                              </p>
                            </div>
                          ) : null}

                          {gmailDraftCreatedByUserId ? (
                            <div>
                              <p className="font-medium">Created by user ID</p>
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
                          Open Gmail Drafts
                        </a>
                      </div>
                    ) : null}

                    {canCreateGmailDraft ? (
                      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                        <p className="text-sm font-semibold text-blue-900">
                          Create a Gmail draft
                        </p>
                        <p className="mt-1 text-sm leading-6 text-blue-800">
                          A Gmail draft will be created, but no email will be sent automatically.
                        </p>

                        <button
                          type="button"
                          onClick={handleCreateGmailDraft}
                          disabled={isApplying !== null}
                          className="mt-3 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isApplying === 'gmail-draft'
                            ? 'Creating Gmail draft...'
                            : 'Create Gmail draft'}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </article>
              ) : null}

              {isExternalCalendarSuggestion ? (
  <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
    <h2 className="text-lg font-semibold text-slate-950">
      External calendar metadata
    </h2>

    <div className="mt-5 grid gap-4 text-sm md:grid-cols-2">
      {suggestion.externalCalendarEvent ? (
        <>
          <div>
            <p className="font-medium text-slate-950">Summary</p>
            <p className="mt-1 text-slate-600">
              {suggestion.externalCalendarEvent.summary ?? 'No title'}
            </p>
          </div>

          <div>
            <p className="font-medium text-slate-950">Status</p>
            <p className="mt-1 text-slate-600">
              {suggestion.externalCalendarEvent.status
                ? formatEnumLabel(suggestion.externalCalendarEvent.status)
                : 'Not set'}
            </p>
          </div>

          <div>
            <p className="font-medium text-slate-950">Start</p>
            <p className="mt-1 text-slate-600">
              {suggestion.externalCalendarEvent.startAt
                ? formatDateTime(suggestion.externalCalendarEvent.startAt)
                : 'Not set'}
            </p>
          </div>

          <div>
            <p className="font-medium text-slate-950">End</p>
            <p className="mt-1 text-slate-600">
              {suggestion.externalCalendarEvent.endAt
                ? formatDateTime(suggestion.externalCalendarEvent.endAt)
                : 'Not set'}
            </p>
          </div>

          <div>
            <p className="font-medium text-slate-950">All day</p>
            <p className="mt-1 text-slate-600">
              {suggestion.externalCalendarEvent.isAllDay ? 'Yes' : 'No'}
            </p>
          </div>

          <div>
            <p className="font-medium text-slate-950">Organizer</p>
            <p className="mt-1 text-slate-600">
              {suggestion.externalCalendarEvent.organizerName ||
                suggestion.externalCalendarEvent.organizerEmail ||
                'Unknown organizer'}
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
              {suggestion.externalCalendarEvent.iCalUid ?? 'Not set'}
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
              <p className="font-medium text-slate-950">Location</p>
              <p className="mt-1 text-slate-600">
                {suggestion.externalCalendarEvent.location}
              </p>
            </div>
          ) : null}

          {suggestion.externalCalendarEvent.htmlLink ? (
            <div>
              <p className="font-medium text-slate-950">Google Calendar link</p>
              <a
                href={suggestion.externalCalendarEvent.htmlLink}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex text-blue-700 hover:text-blue-800"
              >
                Open event
              </a>
            </div>
          ) : null}
        </>
      ) : (
        <div className="md:col-span-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-slate-500">
          Calendar metadata relation was not loaded.
        </div>
      )}

      <div>
        <p className="font-medium text-slate-950">External calendar event ID</p>
        <p className="mt-1 break-all text-slate-600">
          {suggestion.externalCalendarEventId ?? 'Not linked'}
        </p>
      </div>

      <div>
        <p className="font-medium text-slate-950">External calendar ID</p>
        <p className="mt-1 break-all text-slate-600">
          {String(suggestion.metadataJson?.externalCalendarId ?? 'Not set')}
        </p>
      </div>

      <div>
        <p className="font-medium text-slate-950">External event ID</p>
        <p className="mt-1 break-all text-slate-600">
          {String(suggestion.metadataJson?.externalEventId ?? 'Not set')}
        </p>
      </div>

      <div>
        <p className="font-medium text-slate-950">Connected account ID</p>
        <p className="mt-1 break-all text-slate-600">
          {String(suggestion.metadataJson?.connectedAccountId ?? 'Not set')}
        </p>
      </div>

      <div>
        <p className="font-medium text-slate-950">Analysis scope</p>
        <p className="mt-1 text-slate-600">
          {String(suggestion.metadataJson?.aiAnalysisScope ?? 'metadata_only')}
        </p>
      </div>

      <div>
        <p className="font-medium text-slate-950">CRM records created</p>
        <p className="mt-1 text-slate-600">
          {formatBooleanFlag(suggestion.metadataJson?.crmRecordsCreated)}
        </p>
      </div>

      <div>
        <p className="font-medium text-slate-950">Email sent automatically</p>
        <p className="mt-1 text-slate-600">
          {formatBooleanFlag(suggestion.metadataJson?.emailSentAutomatically)}
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
                        External calendar review
                      </p>
                      <h2 className="mt-1 text-lg font-semibold text-slate-950">
                        Synced calendar metadata analysis
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        This recommendation was generated from synced calendar metadata only.
                        It does not create CRM records, tasks, notes, or emails automatically.
                      </p>
                    </div>

                    <Badge className="bg-blue-50 text-blue-700 ring-blue-200">
                      {formatEnumLabel(suggestion.outputJson.suggestedReviewAction)}
                    </Badge>
                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-medium text-slate-950">Importance</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {formatEnumLabel(suggestion.outputJson.importanceLevel)}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-medium text-slate-950">Suggested action</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {formatEnumLabel(suggestion.outputJson.suggestedReviewAction)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 space-y-5 text-sm text-slate-700">
                    <div>
                      <p className="font-medium text-slate-950">Summary</p>
                      <p className="mt-1 leading-6">{suggestion.outputJson.summary}</p>
                    </div>

                    <div>
                      <p className="font-medium text-slate-950">Detected signals</p>

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
                        <p className="mt-1 leading-6 text-slate-500">No signals detected.</p>
                      )}
                    </div>

                    <div>
                      <p className="font-medium text-slate-950">Suggested note</p>
                      <p className="mt-1 leading-6">{suggestion.outputJson.suggestedNote}</p>
                    </div>

                    <div>
                      <p className="font-medium text-slate-950">Suggested tasks</p>

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
                                Priority: {formatEnumLabel(task.priority)} · Due in{' '}
                                {task.dueInDays} day(s)
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-1 leading-6 text-slate-500">
                          No task candidate suggested.
                        </p>
                      )}
                    </div>

                    <div>
                      <p className="font-medium text-slate-950">Reasoning summary</p>
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
                        External email review
                      </p>
                      <h2 className="mt-1 text-lg font-semibold text-slate-950">
                        Synced email metadata analysis
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        This recommendation was generated from synced email metadata/snippet
                        only. It does not create CRM records or send emails automatically.
                      </p>
                    </div>

                    <Badge className="bg-blue-50 text-blue-700 ring-blue-200">
                      {formatEnumLabel(suggestion.outputJson.suggestedReviewAction)}
                    </Badge>
                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-medium text-slate-950">Importance</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {formatEnumLabel(suggestion.outputJson.importanceLevel)}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-medium text-slate-950">Suggested action</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {formatEnumLabel(suggestion.outputJson.suggestedReviewAction)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 space-y-5 text-sm text-slate-700">
                    <div>
                      <p className="font-medium text-slate-950">Summary</p>
                      <p className="mt-1 leading-6">{suggestion.outputJson.summary}</p>
                    </div>

                    <div>
                      <p className="font-medium text-slate-950">Detected signals</p>

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
                        <p className="mt-1 leading-6 text-slate-500">No signals detected.</p>
                      )}
                    </div>

                    <div>
                      <p className="font-medium text-slate-950">Suggested note</p>
                      <p className="mt-1 leading-6">{suggestion.outputJson.suggestedNote}</p>
                    </div>

                    <div>
                      <p className="font-medium text-slate-950">Suggested tasks</p>

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
                                Priority: {formatEnumLabel(task.priority)} · Due in{' '}
                                {task.dueInDays} day(s)
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-1 leading-6 text-slate-500">
                          No task candidate suggested.
                        </p>
                      )}
                    </div>

                    <div>
                      <p className="font-medium text-slate-950">Reasoning summary</p>
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
                Human review action
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
            <p className="text-sm font-medium text-blue-700">Apply to CRM</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">
              Convert reviewed suggestion into official CRM data
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              These actions require an explicit human click. Nothing is applied
              automatically, and no email is sent.
            </p>
          </div>

          <div className="mt-6 space-y-6">
            <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                <div>
                  <h3 className="font-semibold text-slate-950">
                    Apply recommended next step
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Updates the official lead nextStep field.
                  </p>
                </div>

                {nextStepApplied ? (
                  <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200">
                    Applied
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
                  ? 'Applying...'
                  : nextStepApplied
                    ? 'Next step applied'
                    : 'Apply next step'}
              </button>
            </section>

            <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                <div>
                  <h3 className="font-semibold text-slate-950">
                    Create suggested task
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Creates an official task linked to this lead.
                  </p>
                </div>

                {taskApplied ? (
                  <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200">
                    Applied
                  </Badge>
                ) : null}
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="space-y-2 md:col-span-2">
                  <span className="text-sm font-medium text-slate-700">Title</span>
                  <input
                    value={taskTitleDraft}
                    onChange={(event) => setTaskTitleDraft(event.target.value)}
                    disabled={taskApplied || !canApplySuggestion}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </label>

                <label className="space-y-2 md:col-span-2">
                  <span className="text-sm font-medium text-slate-700">
                    Description
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
                    Priority
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
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">
                    Due date optional
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
                  ? 'Creating...'
                  : taskApplied
                    ? 'Task created'
                    : 'Create task'}
              </button>
            </section>

            <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                <div>
                  <h3 className="font-semibold text-slate-950">
                    Create suggested note
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Creates an official note linked to this lead.
                  </p>
                </div>

                {noteApplied ? (
                  <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200">
                    Applied
                  </Badge>
                ) : null}
              </div>

              <div className="mt-4 space-y-3">
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-700">Title</span>
                  <input
                    value={noteTitleDraft}
                    onChange={(event) => setNoteTitleDraft(event.target.value)}
                    disabled={noteApplied || !canApplySuggestion}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-700">Content</span>
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
                  ? 'Creating...'
                  : noteApplied
                    ? 'Note created'
                    : 'Create note'}
              </button>
            </section>
          </div>
        </article>
      ) : null}

        {canApplyExternalCalendarTask && !externalCalendarTaskApplied ? (
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <p className="text-sm font-medium text-blue-700">
              External calendar action
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">
              Create CRM task from reviewed calendar event
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              This creates one official CRM task from the accepted calendar
              review. It requires this explicit human click and does not send an
              email.
            </p>
          </div>

          <section className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
              <div>
                <h3 className="font-semibold text-slate-950">
                  Create CRM task
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  The task will include safe synced calendar metadata, AI
                  summary, reasoning, event identifiers, and a human approval
                  notice. No company, contact, lead, or email will be created.
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
                ? 'Creating...'
                : externalCalendarTaskApplied
                  ? 'CRM task created'
                  : 'Create CRM task'}
            </button>
          </section>
        </article>
      ) : null}

        {canApplyExternalCalendarNote && !externalCalendarNoteApplied ? (
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <p className="text-sm font-medium text-blue-700">
              External calendar action
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">
              Create CRM note from reviewed calendar event
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              This creates one official CRM note from the accepted calendar
              review. It requires this explicit human click and does not send an
              email.
            </p>
          </div>

          <section className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
              <div>
                <h3 className="font-semibold text-slate-950">
                  Create CRM note
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  The note will include safe synced calendar metadata, AI
                  summary, reasoning, event identifiers, and a human approval
                  notice. No company, contact, lead, task, or email will be
                  created.
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
                ? 'Creating...'
                : externalCalendarNoteApplied
                  ? 'CRM note created'
                  : 'Create CRM note'}
            </button>
          </section>
        </article>
      ) : null}

        {canApplyExternalCalendarLead && !externalCalendarLeadApplied ? (
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <p className="text-sm font-medium text-blue-700">
              External calendar action
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">
              Create CRM lead from reviewed calendar event
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              This creates one official CRM lead from the accepted calendar
              review. It requires this explicit human click and does not send an
              email.
            </p>
          </div>

          <section className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
              <div>
                <h3 className="font-semibold text-slate-950">
                  Create CRM lead
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  The lead will include safe synced calendar metadata, AI
                  summary, reasoning, event identifiers, and a human approval
                  notice. Existing company or contact links are reused only if
                  already present on the suggestion.
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
                ? 'Creating...'
                : externalCalendarLeadApplied
                  ? 'CRM lead created'
                  : 'Create CRM lead'}
            </button>
          </section>
        </article>
      ) : null}

        {canApplyExternalEmailLead && !externalEmailLeadApplied ? (
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <p className="text-sm font-medium text-blue-700">
              External email action
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">
              Create CRM lead from reviewed email
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              This creates one official CRM lead from the accepted email review.
              It requires this explicit human click and does not send an email.
            </p>
          </div>

          <section className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
              <div>
                <h3 className="font-semibold text-slate-950">
                  Create CRM lead
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  The lead will include safe synced email metadata, AI summary,
                  reasoning, external identifiers, and a human approval notice.
                  Existing company or contact links are reused only if already
                  present on the suggestion.
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
                ? 'Creating...'
                : externalEmailLeadApplied
                  ? 'CRM lead created'
                  : 'Create CRM lead'}
            </button>
          </section>
        </article>
      ) : null}

        {canApplyExternalEmailTask && !externalEmailTaskApplied ? (
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <p className="text-sm font-medium text-blue-700">
              External email action
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">
              Create CRM task from reviewed email
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              This creates one official CRM task from the accepted email review.
              It requires this explicit human click and does not send an email.
            </p>
          </div>

          <section className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
              <div>
                <h3 className="font-semibold text-slate-950">
                  Create CRM task
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  The task will include safe synced email metadata, AI summary,
                  reasoning, and a human approval notice. No contact, lead, or
                  email will be created.
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-slate-700">Title</span>
                <input
                  value={taskTitleDraft}
                  onChange={(event) => setTaskTitleDraft(event.target.value)}
                  disabled={externalEmailTaskApplied || !canApplyExternalEmailTask}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-slate-700">
                  Description
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
                  Priority
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
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  Due date optional
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
                ? 'Creating...'
                : externalEmailTaskApplied
                  ? 'CRM task created'
                  : 'Create CRM task'}
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
              External email action
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">
              Create CRM note from reviewed email
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              This creates one official CRM note from the accepted email review.
              It requires this explicit human click and does not send an email.
            </p>
          </div>

          <section className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
              <div>
                <h3 className="font-semibold text-slate-950">
                  Create CRM note
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  The note will include safe synced email metadata and the AI
                  suggested note. No contact, lead, task, or email will be
                  created.
                </p>
              </div>

              {externalEmailNoteApplied ? (
                <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200">
                  Applied
                </Badge>
              ) : null}
            </div>

            <div className="mt-4 space-y-3">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">Title</span>
                <input
                  value={noteTitleDraft}
                  onChange={(event) => setNoteTitleDraft(event.target.value)}
                  disabled={externalEmailNoteApplied || !canApplyExternalEmailNote}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">Content</span>
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
                ? 'Creating...'
                : externalEmailNoteApplied
                  ? 'CRM note created'
                  : 'Create CRM note'}
            </button>
          </section>
        </article>
      ) : null}

              {suggestion.status === 'PENDING_REVIEW' ? (
                <div className="mt-4 space-y-4">
                  <p className="text-sm leading-6 text-slate-600">
                    Accepting or rejecting this suggestion only records a human
                    review decision. It does not update CRM records, create tasks,
                    create notes, create leads, or send emails.
                  </p>

                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-slate-700">
                      Review note optional
                    </span>

                    <textarea
                      value={reviewNote}
                      onChange={(event) => setReviewNote(event.target.value)}
                      rows={4}
                      maxLength={1000}
                      placeholder="Add context about why you accept or reject this suggestion..."
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
                          {isReviewing ? 'Saving...' : 'Accept review'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleReview('reject')}
                          disabled={isReviewing}
                          className="rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isReviewing ? 'Saving...' : 'Reject suggestion'}
                        </button>
                      </>
                    ) : (
                      <p className="text-sm text-slate-500">
                        You do not have permission to review this suggestion.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  This suggestion has already been reviewed as{' '}
                  <span className="font-semibold">
                    {formatEnumLabel(suggestion.status)}
                  </span>
                  . No CRM changes were applied automatically.
                </div>
              )}
            </article>
          </section>



          <aside className="space-y-4">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-slate-950">Suggestion info</h2>

              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-slate-500">Created</dt>
                  <dd className="font-medium text-slate-800">
                    {formatDateTime(suggestion.createdAt)}
                  </dd>
                </div>

                <div>
                  <dt className="text-slate-500">Expires</dt>
                  <dd className="font-medium text-slate-800">
                    {formatDateTime(suggestion.expiresAt)}
                  </dd>
                </div>

                                <div>
                  <dt className="text-slate-500">Reviewed at</dt>
                  <dd className="font-medium text-slate-800">
                    {formatDateTime(suggestion.reviewedAt)}
                  </dd>
                </div>

                <div>
                  <dt className="text-slate-500">Reviewed by</dt>
                  <dd className="font-medium text-slate-800">
                    {suggestion.reviewedBy?.name ?? 'Not reviewed'}
                  </dd>
                </div>

                <div>
                  <dt className="text-slate-500">Provider</dt>
                  <dd className="font-medium text-slate-800">
                    {suggestion.provider}
                  </dd>
                </div>

                <div>
                  <dt className="text-slate-500">Model</dt>
                  <dd className="font-medium text-slate-800">
                    {suggestion.metadataJson?.model ?? 'Not set'}
                  </dd>
                </div>

                <div>
                  <dt className="text-slate-500">Tokens</dt>
                  <dd className="font-medium text-slate-800">
                    Input {suggestion.tokensInput ?? 0} · Output{' '}
                    {suggestion.tokensOutput ?? 0}
                  </dd>
                </div>

                <div>
                  <dt className="text-slate-500">Cost</dt>
                  <dd className="font-medium text-slate-800">
                    ${suggestion.estimatedCostUsd ?? 0}
                  </dd>
                </div>
              </dl>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-slate-950">Safety flags</h2>

              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-slate-500">Human approval required</dt>
                  <dd className="font-medium text-slate-800">
                    {String(
                      suggestion.metadataJson?.humanApprovalRequired ?? true,
                    )}
                  </dd>
                </div>

                <div>
                  <dt className="text-slate-500">Can apply automatically</dt>
                  <dd className="font-medium text-slate-800">
                    {String(
                      suggestion.metadataJson?.canApplyAutomatically ?? false,
                    )}
                  </dd>
                </div>

                <div>
                  <dt className="text-slate-500">Can send email automatically</dt>
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
      ) : null}
    </div>
  );
}
