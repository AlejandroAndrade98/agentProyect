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

export type GeneratedAiSuggestion = {
  provider: string;
  model: string;
  title: string;
  outputJson: LeadNextStepsSuggestionOutput;
  outputText: string;
  confidenceScore: number;
  tokensInput: number;
  tokensOutput: number;
  estimatedCostUsd: number;
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
}