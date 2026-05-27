import { Injectable } from '@nestjs/common';

import { LeadNextStepsContext } from './lead-ai-context.service';

export type LeadNextStepsSuggestionOutput = {
  summary: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  recommendedNextStep: string;
  suggestedTasks: Array<{
    title: string;
    description: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    dueInDays: number;
  }>;
  suggestedNote: string;
  reasoningSummary: string;
  confidenceScore: number;
  humanApprovalRequired: true;
};

export type GeneratedAiSuggestion<TOutput = unknown> = {
  provider: string;
  model: string;
  title: string;
  outputJson: TOutput;
  outputText: string;
  confidenceScore: number;
  tokensInput: number;
  tokensOutput: number;
  estimatedCostUsd: number;
};

export type ExternalEmailMetadataForAi = {
  id: string;
  connectedAccountId: string;
  provider: string;
  externalMessageId: string;
  externalThreadId: string | null;
  subject: string | null;
  snippet: string | null;
  fromEmail: string | null;
  fromName: string | null;
  toEmailsJson: unknown;
  ccEmailsJson: unknown;
  bccEmailsJson: unknown;
  labelIdsJson: unknown;
  internalDate: Date | null;
  syncedAt: Date;
};

export type ExternalEmailAnalysisOutput = {
  summary: string;
  importanceLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  suggestedReviewAction:
    | 'IGNORE'
    | 'FOLLOW_UP'
    | 'CREATE_CONTACT_CANDIDATE'
    | 'CREATE_LEAD_CANDIDATE'
    | 'LINK_TO_EXISTING_RECORD'
    | 'CREATE_NOTE_CANDIDATE';
  detectedSignals: string[];
  suggestedTasks: Array<{
    title: string;
    description: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    dueInDays: number;
  }>;
  suggestedNote: string;
  reasoningSummary: string;
  confidenceScore: number;
  humanApprovalRequired: true;
  noAutomaticCrmChanges: true;
  noAutomaticEmailSending: true;
};

export type ExternalCalendarEventMetadataForAi = {
  id: string;
  connectedAccountId: string;
  provider: string;
  externalCalendarId: string;
  externalEventId: string;
  iCalUid: string | null;
  status: string | null;
  summary: string | null;
  description: string | null;
  location: string | null;
  startAt: Date | null;
  endAt: Date | null;
  isAllDay: boolean;
  organizerEmail: string | null;
  organizerName: string | null;
  attendeesJson: unknown;
  htmlLink: string | null;
  syncedAt: Date;
};

export type ExternalCalendarEventAnalysisOutput = {
  summary: string;
  importanceLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  suggestedReviewAction:
    | 'IGNORE'
    | 'FOLLOW_UP'
    | 'CREATE_TASK_CANDIDATE'
    | 'CREATE_NOTE_CANDIDATE'
    | 'LINK_TO_EXISTING_RECORD'
    | 'PREPARE_MEETING_BRIEF';
  detectedSignals: string[];
  suggestedTasks: Array<{
    title: string;
    description: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    dueInDays: number;
  }>;
  suggestedNote: string;
  reasoningSummary: string;
  confidenceScore: number;
  humanApprovalRequired: true;
  noAutomaticCrmChanges: true;
  noAutomaticEmailSending: true;
};

@Injectable()
export class AiSuggestionProviderService {
  generateLeadNextSteps(
    context: LeadNextStepsContext,
    inputText: string,
  ): GeneratedAiSuggestion {
    const hasNextStep = Boolean(context.lead.nextStep);
    const hasPendingTasks = context.tasks.some(
      (task) => task.status !== 'COMPLETED' && task.status !== 'CANCELLED',
    );
    const hasRecentNotes = context.notes.length > 0;
    const isHighPriority =
      context.lead.priority === 'HIGH' || context.lead.priority === 'CRITICAL';

    const riskLevel: LeadNextStepsSuggestionOutput['riskLevel'] =
      isHighPriority && !hasNextStep
        ? 'HIGH'
        : !hasNextStep || !hasPendingTasks
          ? 'MEDIUM'
          : 'LOW';

    const recommendedNextStep = hasNextStep
      ? `Continue with the current next step: ${context.lead.nextStep}`
      : `Define a concrete follow-up for ${context.lead.title} and move the conversation toward the next commercial milestone.`;

    const taskPriority = isHighPriority ? 'HIGH' : 'MEDIUM';

    const outputJson: LeadNextStepsSuggestionOutput = {
      summary: `${context.lead.title} is currently in ${context.lead.status} with ${context.lead.priority} priority. ${
        hasRecentNotes
          ? 'There is recent CRM context available.'
          : 'There are no recent notes linked to this lead.'
      }`,
      riskLevel,
      recommendedNextStep,
      suggestedTasks: [
        {
          title: `Follow up on ${context.lead.title}`,
          description:
            'Review the latest CRM context, confirm the customer need, and agree on the next concrete step.',
          priority: taskPriority,
          dueInDays: riskLevel === 'HIGH' ? 1 : 2,
        },
      ],
      suggestedNote:
        'AI suggested reviewing this lead context and confirming the next commercial action before updating CRM records.',
      reasoningSummary:
        'This suggestion was generated from lead status, priority, current next step, linked tasks, notes, company/contact context, and recent activity. It must be reviewed by a human before any CRM data is changed.',
      confidenceScore: hasRecentNotes ? 0.78 : 0.68,
      humanApprovalRequired: true,
    };

    return {
      provider: 'mock-ai-provider',
      model: 'mock-lead-next-steps-v1',
      title: `AI next steps suggestion: ${context.lead.title}`,
      outputJson,
      outputText: [
        outputJson.summary,
        '',
        `Recommended next step: ${outputJson.recommendedNextStep}`,
        '',
        `Risk level: ${outputJson.riskLevel}`,
        '',
        `Reasoning: ${outputJson.reasoningSummary}`,
      ].join('\n'),
      confidenceScore: outputJson.confidenceScore,
      tokensInput: Math.ceil(inputText.length / 4),
      tokensOutput: 180,
      estimatedCostUsd: 0,
    };
  }

  generateExternalEmailAnalysis(
    email: ExternalEmailMetadataForAi,
    inputText: string,
  ): GeneratedAiSuggestion<ExternalEmailAnalysisOutput> {
    const subject = email.subject?.trim() || '(No subject)';
    const snippet = email.snippet?.trim() || '';
    const sender = email.fromName || email.fromEmail || 'Unknown sender';

    const combinedText = `${subject} ${snippet}`.toLowerCase();

    const detectedSignals: string[] = [];

    if (
      combinedText.includes('meeting') ||
      combinedText.includes('demo') ||
      combinedText.includes('call') ||
      combinedText.includes('schedule')
    ) {
      detectedSignals.push('MEETING_OR_CALL_SIGNAL');
    }

    if (
      combinedText.includes('price') ||
      combinedText.includes('pricing') ||
      combinedText.includes('quote') ||
      combinedText.includes('proposal') ||
      combinedText.includes('budget')
    ) {
      detectedSignals.push('COMMERCIAL_INTENT_SIGNAL');
    }

    if (
      combinedText.includes('urgent') ||
      combinedText.includes('asap') ||
      combinedText.includes('important')
    ) {
      detectedSignals.push('URGENCY_SIGNAL');
    }

    if (
      combinedText.includes('interested') ||
      combinedText.includes('we are looking') ||
      combinedText.includes('need help') ||
      combinedText.includes('information')
    ) {
      detectedSignals.push('INTEREST_SIGNAL');
    }

    const hasCommercialIntent = detectedSignals.includes(
      'COMMERCIAL_INTENT_SIGNAL',
    );
    const hasMeetingSignal = detectedSignals.includes('MEETING_OR_CALL_SIGNAL');
    const hasUrgencySignal = detectedSignals.includes('URGENCY_SIGNAL');
    const hasInterestSignal = detectedSignals.includes('INTEREST_SIGNAL');

    const importanceLevel: ExternalEmailAnalysisOutput['importanceLevel'] =
      hasUrgencySignal
        ? 'HIGH'
        : hasCommercialIntent || hasMeetingSignal
          ? 'MEDIUM'
          : 'LOW';

    const suggestedReviewAction: ExternalEmailAnalysisOutput['suggestedReviewAction'] =
      hasCommercialIntent || hasInterestSignal
        ? 'CREATE_LEAD_CANDIDATE'
        : hasMeetingSignal
          ? 'FOLLOW_UP'
          : detectedSignals.length === 0
            ? 'IGNORE'
            : 'CREATE_NOTE_CANDIDATE';

    const suggestedTasks =
      suggestedReviewAction === 'IGNORE'
        ? []
        : [
            {
              title: `Review email from ${sender}`,
              description:
                'Review this synced email metadata and decide whether it should become an official CRM action.',
              priority: importanceLevel,
              dueInDays: importanceLevel === 'HIGH' ? 1 : 2,
            },
          ];

    const outputJson: ExternalEmailAnalysisOutput = {
      summary: `Email "${subject}" from ${sender} may require CRM review based on synced metadata.`,
      importanceLevel,
      suggestedReviewAction,
      detectedSignals,
      suggestedTasks,
      suggestedNote:
        'AI reviewed synced email metadata only. A human should verify the context before creating any CRM record.',
      reasoningSummary:
        'This suggestion was generated from email metadata such as subject, snippet, sender, recipients, labels and internal date. Email body was not stored or analyzed. No CRM record or email draft was created automatically.',
      confidenceScore: detectedSignals.length > 0 ? 0.72 : 0.58,
      humanApprovalRequired: true,
      noAutomaticCrmChanges: true,
      noAutomaticEmailSending: true,
    };

    return {
      provider: 'mock-ai-provider',
      model: 'mock-external-email-analysis-v1',
      title: `AI email review suggestion: ${subject}`,
      outputJson,
      outputText: [
        outputJson.summary,
        '',
        `Suggested review action: ${outputJson.suggestedReviewAction}`,
        '',
        `Importance: ${outputJson.importanceLevel}`,
        '',
        `Detected signals: ${
          outputJson.detectedSignals.length > 0
            ? outputJson.detectedSignals.join(', ')
            : 'None'
        }`,
        '',
        `Reasoning: ${outputJson.reasoningSummary}`,
      ].join('\n'),
      confidenceScore: outputJson.confidenceScore,
      tokensInput: Math.ceil(inputText.length / 4),
      tokensOutput: 220,
      estimatedCostUsd: 0,
    };
  }

    generateExternalCalendarEventAnalysis(
    event: ExternalCalendarEventMetadataForAi,
    inputText: string,
  ): GeneratedAiSuggestion<ExternalCalendarEventAnalysisOutput> {
    const eventSummary = event.summary?.trim() || '(No title)';
    const description = event.description?.trim() || '';
    const location = event.location?.trim() || '';
    const organizer =
      event.organizerName || event.organizerEmail || 'Unknown organizer';

    const combinedText =
      `${eventSummary} ${description} ${location} ${organizer}`.toLowerCase();

    const detectedSignals: string[] = [];

    if (
      combinedText.includes('demo') ||
      combinedText.includes('discovery') ||
      combinedText.includes('sales') ||
      combinedText.includes('proposal') ||
      combinedText.includes('pricing') ||
      combinedText.includes('quote')
    ) {
      detectedSignals.push('COMMERCIAL_MEETING_SIGNAL');
    }

    if (
      combinedText.includes('follow up') ||
      combinedText.includes('follow-up') ||
      combinedText.includes('review') ||
      combinedText.includes('sync') ||
      combinedText.includes('check in') ||
      combinedText.includes('check-in')
    ) {
      detectedSignals.push('FOLLOW_UP_SIGNAL');
    }

    if (
      combinedText.includes('urgent') ||
      combinedText.includes('important') ||
      combinedText.includes('deadline')
    ) {
      detectedSignals.push('URGENCY_SIGNAL');
    }

    if (event.startAt) {
      detectedSignals.push('SCHEDULED_EVENT_SIGNAL');
    }

    if (event.attendeesJson) {
      detectedSignals.push('ATTENDEES_AVAILABLE_SIGNAL');
    }

    const hasCommercialSignal = detectedSignals.includes(
      'COMMERCIAL_MEETING_SIGNAL',
    );
    const hasFollowUpSignal = detectedSignals.includes('FOLLOW_UP_SIGNAL');
    const hasUrgencySignal = detectedSignals.includes('URGENCY_SIGNAL');
    const hasScheduledSignal = detectedSignals.includes(
      'SCHEDULED_EVENT_SIGNAL',
    );

    const importanceLevel: ExternalCalendarEventAnalysisOutput['importanceLevel'] =
      hasUrgencySignal
        ? 'HIGH'
        : hasCommercialSignal || hasFollowUpSignal
          ? 'MEDIUM'
          : 'LOW';

    const suggestedReviewAction: ExternalCalendarEventAnalysisOutput['suggestedReviewAction'] =
      hasCommercialSignal
        ? 'PREPARE_MEETING_BRIEF'
        : hasFollowUpSignal
          ? 'FOLLOW_UP'
          : hasScheduledSignal
            ? 'CREATE_NOTE_CANDIDATE'
            : 'IGNORE';

    const suggestedTasks =
      suggestedReviewAction === 'IGNORE'
        ? []
        : [
            {
              title: `Review calendar event: ${eventSummary}`,
              description:
                'Review this synced calendar event metadata and decide whether it should become an official CRM task, note, or follow-up action.',
              priority: importanceLevel,
              dueInDays: importanceLevel === 'HIGH' ? 0 : 1,
            },
          ];

    const outputJson: ExternalCalendarEventAnalysisOutput = {
      summary: `Calendar event "${eventSummary}" organized by ${organizer} may require CRM review based on synced calendar metadata.`,
      importanceLevel,
      suggestedReviewAction,
      detectedSignals,
      suggestedTasks,
      suggestedNote:
        'AI reviewed synced calendar metadata only. A human should verify the meeting context before creating any CRM record.',
      reasoningSummary:
        'This suggestion was generated from calendar metadata such as title, description, location, organizer, attendees, and start/end time. No CRM record, task, note, lead, or email was created automatically.',
      confidenceScore: detectedSignals.length > 0 ? 0.74 : 0.56,
      humanApprovalRequired: true,
      noAutomaticCrmChanges: true,
      noAutomaticEmailSending: true,
    };

    return {
      provider: 'mock-ai-provider',
      model: 'mock-external-calendar-analysis-v1',
      title: `AI calendar review suggestion: ${eventSummary}`,
      outputJson,
      outputText: [
        outputJson.summary,
        '',
        `Suggested review action: ${outputJson.suggestedReviewAction}`,
        '',
        `Importance: ${outputJson.importanceLevel}`,
        '',
        `Detected signals: ${
          outputJson.detectedSignals.length > 0
            ? outputJson.detectedSignals.join(', ')
            : 'None'
        }`,
        '',
        `Reasoning: ${outputJson.reasoningSummary}`,
      ].join('\n'),
      confidenceScore: outputJson.confidenceScore,
      tokensInput: Math.ceil(inputText.length / 4),
      tokensOutput: 240,
      estimatedCostUsd: 0,
    };
  }
}

