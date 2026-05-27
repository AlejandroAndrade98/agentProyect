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
}

