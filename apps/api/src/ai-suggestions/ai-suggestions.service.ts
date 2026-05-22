import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ActivityEventType,
  AiSuggestionStatus,
  AiSuggestionType,
  AiUsageFeature,
  EntityType,
  ImportanceLevel,
  Prisma,
  Priority,
  Source,
  TaskStatus,
} from '@prisma/client';
import { createHash } from 'crypto';

import { CurrentUser } from '../auth/interfaces/current-user.interface';
import { PrismaService } from '../database/prisma.service';
import {
  buildPaginatedResult,
  getPaginationParams,
  normalizeSearch,
} from '../common/utils/pagination.util';
import { ActivityEventsService } from '../activity-events/activity-events.service';

import { AiSuggestionProviderService } from './ai-suggestion-provider.service';
import { LeadAiContextService } from './lead-ai-context.service';
import { QueryAiSuggestionsDto } from './dto/query-ai-suggestions.dto';
import { ReviewAiSuggestionDto } from './dto/review-ai-suggestion.dto';

import { ApplyLeadNextStepDto } from './dto/apply-lead-next-step.dto';
import { ApplySuggestedNoteDto } from './dto/apply-suggested-note.dto';
import { ApplySuggestedTaskDto } from './dto/apply-suggested-task.dto';
import { AiUsageService } from '../ai-usage/ai-usage.service';

type AiSuggestionReviewStatus = Extract<
  AiSuggestionStatus,
  'ACCEPTED' | 'REJECTED'
>;

type AiSuggestionReviewActivityType = Extract<
  ActivityEventType,
  'AI_SUGGESTION_ACCEPTED' | 'AI_SUGGESTION_REJECTED'
>;

type SuggestedTaskOutput = {
  title?: string;
  description?: string;
  priority?: Priority;
  dueInDays?: number;
};

type LeadNextStepsOutput = {
  recommendedNextStep?: string;
  suggestedTasks?: SuggestedTaskOutput[];
  suggestedNote?: string;
};

type AppliedActionName =
  | 'UPDATE_LEAD_NEXT_STEP'
  | 'CREATE_TASK'
  | 'CREATE_NOTE';

@Injectable()
export class AiSuggestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityEventsService: ActivityEventsService,
    private readonly leadAiContextService: LeadAiContextService,
    private readonly aiSuggestionProviderService: AiSuggestionProviderService,
    private readonly aiUsageService: AiUsageService,
  ) {}

  async findAll(currentUser: CurrentUser, query: QueryAiSuggestionsDto) {
    const { page, pageSize, skip, take } = getPaginationParams(query);
    const search = normalizeSearch(query.search);

    const where: Prisma.AiSuggestionWhereInput = {
      organizationId: currentUser.organizationId,
      ...(query.status && {
        status: query.status,
      }),
      ...(query.type && {
        type: query.type,
      }),
      ...(query.entityType && {
        entityType: query.entityType,
      }),
      ...(query.entityId && {
        entityId: query.entityId,
      }),
      ...(query.companyId && {
        companyId: query.companyId,
      }),
      ...(query.contactId && {
        contactId: query.contactId,
      }),
      ...(query.leadId && {
        leadId: query.leadId,
      }),
      ...(query.taskId && {
        taskId: query.taskId,
      }),
      ...(query.noteId && {
        noteId: query.noteId,
      }),
      ...(query.userId && {
        userId: query.userId,
      }),
      ...(search && {
        OR: [
          {
            title: {
              contains: search,
              mode: 'insensitive',
            },
          },
          {
            inputText: {
              contains: search,
              mode: 'insensitive',
            },
          },
          {
            outputText: {
              contains: search,
              mode: 'insensitive',
            },
          },
        ],
      }),
    };

    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';

    const orderBy: Prisma.AiSuggestionOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.aiSuggestion.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              organizationId: true,
              isActive: true,
              createdAt: true,
              updatedAt: true,
            },
          },
          reviewedBy: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              organizationId: true,
              isActive: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      }),
      this.prisma.aiSuggestion.count({
        where,
      }),
    ]);

    return buildPaginatedResult(data, total, page, pageSize);
  }

  async findOne(id: string, currentUser: CurrentUser) {
    const suggestion = await this.prisma.aiSuggestion.findFirst({
      where: {
        id,
        organizationId: currentUser.organizationId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            organizationId: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        reviewedBy: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            organizationId: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!suggestion) {
      throw new NotFoundException('AI suggestion not found');
    }

    return suggestion;
  }

  async generateLeadNextSteps(leadId: string, currentUser: CurrentUser) {
    const context =
      await this.leadAiContextService.buildLeadNextStepsContext(
        leadId,
        currentUser,
      );

    const inputText = this.leadAiContextService.buildInputText(context);
    const inputHash = this.hashInput(inputText);

    const estimatedCreditsRequired =
  this.aiUsageService.estimateCreditsFromText(inputText, 250);

  await this.aiUsageService.assertCanUseAi(currentUser, {
    feature: AiUsageFeature.LEAD_NEXT_STEPS,
    estimatedCreditsRequired,
    metadataJson: {
      leadId: context.lead.id,
      feature: AiUsageFeature.LEAD_NEXT_STEPS,
      estimatedCreditsRequired,
    },
  });

    const generated =
      this.aiSuggestionProviderService.generateLeadNextSteps(
        context,
        inputText,
      );

    return this.prisma.$transaction(async (tx) => {
      const suggestion = await tx.aiSuggestion.create({
        data: {
          organizationId: currentUser.organizationId,
          userId: currentUser.id,
          provider: generated.provider,
          type: AiSuggestionType.SUGGEST_NEXT_STEPS,
          status: AiSuggestionStatus.PENDING_REVIEW,
          title: generated.title,
          entityType: EntityType.LEAD,
          entityId: context.lead.id,
          companyId: context.lead.companyId,
          contactId: context.lead.contactId,
          leadId: context.lead.id,
          inputText,
          inputHash,
          outputJson: generated.outputJson as Prisma.InputJsonValue,
          outputText: generated.outputText,
          confidenceScore: generated.confidenceScore,
          metadataJson: {
            model: generated.model,
            humanApprovalRequired: true,
            canApplyAutomatically: false,
            canSendEmailAutomatically: false,
            generatedFor: 'lead_next_steps',
          },
          tokensInput: generated.tokensInput,
          tokensOutput: generated.tokensOutput,
          estimatedCostUsd: generated.estimatedCostUsd,
          expiresAt: this.getDefaultExpirationDate(),
        },
      });

      await this.aiUsageService.recordSuccessfulUsage(tx, currentUser, {
        feature: AiUsageFeature.LEAD_NEXT_STEPS,
        provider: generated.provider,
        model: generated.model,
        tokensInput: generated.tokensInput,
        tokensOutput: generated.tokensOutput,
        estimatedCostUsd: generated.estimatedCostUsd,
        aiSuggestionId: suggestion.id,
        metadataJson: {
          leadId: context.lead.id,
          aiSuggestionId: suggestion.id,
          aiSuggestionType: suggestion.type,
          estimatedCreditsRequired,
        },
      });

      await tx.activityEvent.create({
        data: this.activityEventsService.buildCreateData(currentUser, {
          type: ActivityEventType.AI_SUGGESTION_CREATED,
          entityType: EntityType.LEAD,
          entityId: context.lead.id,
          title: `AI suggestion created: ${context.lead.title}`,
          description:
            'AI generated a lead next steps suggestion. Human review is required before applying any CRM changes.',
          source: Source.AI_SUGGESTION,
          companyId: context.lead.companyId ?? undefined,
          contactId: context.lead.contactId ?? undefined,
          leadId: context.lead.id,
          occurredAt: suggestion.createdAt,
          metadataJson: {
            aiSuggestionId: suggestion.id,
            aiSuggestionType: suggestion.type,
            aiSuggestionStatus: suggestion.status,
            humanApprovalRequired: true,
            canApplyAutomatically: false,
            canSendEmailAutomatically: false,
          },
        }),
      });

      return suggestion;
    });
  }

    async accept(
    id: string,
    currentUser: CurrentUser,
    dto: ReviewAiSuggestionDto,
  ) {
    return this.reviewSuggestion({
      id,
      currentUser,
      reviewStatus: AiSuggestionStatus.ACCEPTED,
      activityType: ActivityEventType.AI_SUGGESTION_ACCEPTED,
      reviewNote: dto.reviewNote,
    });
  }

  async reject(
    id: string,
    currentUser: CurrentUser,
    dto: ReviewAiSuggestionDto,
  ) {
    return this.reviewSuggestion({
      id,
      currentUser,
      reviewStatus: AiSuggestionStatus.REJECTED,
      activityType: ActivityEventType.AI_SUGGESTION_REJECTED,
      reviewNote: dto.reviewNote,
    });
  }

    async applyLeadNextStep(
    id: string,
    currentUser: CurrentUser,
    dto: ApplyLeadNextStepDto,
  ) {
    const { suggestion, lead, output } = await this.getApplicableSuggestion(
      id,
      currentUser,
    );

    if (this.hasAppliedAction(suggestion.metadataJson, 'UPDATE_LEAD_NEXT_STEP')) {
      throw new ConflictException('Lead next step was already applied');
    }

    const nextStep = dto.nextStep?.trim() || output.recommendedNextStep?.trim();

    if (!nextStep) {
      throw new ConflictException('Suggestion does not include a next step');
    }

    const appliedAt = new Date();

    return this.prisma.$transaction(async (tx) => {
      const updatedLead = await tx.lead.update({
        where: {
          id: lead.id,
        },
        data: {
          nextStep,
        },
      });

      const updatedSuggestion = await tx.aiSuggestion.update({
        where: {
          id: suggestion.id,
        },
        data: {
          metadataJson: this.buildAppliedMetadata({
            metadataJson: suggestion.metadataJson,
            action: 'UPDATE_LEAD_NEXT_STEP',
            currentUser,
            appliedAt,
            recordType: EntityType.LEAD,
            recordId: lead.id,
            details: {
              nextStep,
            },
          }),
        },
        include: this.getSuggestionInclude(),
      });

      await tx.activityEvent.create({
        data: this.activityEventsService.buildCreateData(currentUser, {
          type: ActivityEventType.AI_SUGGESTION_APPLIED,
          entityType: EntityType.LEAD,
          entityId: lead.id,
          title: `AI suggestion applied: lead next step`,
          description:
            'A human applied an AI suggested next step to the lead. No email was sent automatically.',
          source: Source.AI_SUGGESTION,
          companyId: lead.companyId ?? undefined,
          contactId: lead.contactId ?? undefined,
          leadId: lead.id,
          occurredAt: appliedAt,
          metadataJson: {
            aiSuggestionId: suggestion.id,
            aiSuggestionType: suggestion.type,
            appliedAction: 'UPDATE_LEAD_NEXT_STEP',
            appliedToCrm: true,
            canApplyAutomatically: false,
            canSendEmailAutomatically: false,
            nextStep,
          },
        }),
      });

      return {
        suggestion: updatedSuggestion,
        lead: updatedLead,
      };
    });
  }

  async createTaskFromSuggestion(
    id: string,
    currentUser: CurrentUser,
    dto: ApplySuggestedTaskDto,
  ) {
    const { suggestion, lead, output } = await this.getApplicableSuggestion(
      id,
      currentUser,
    );

    const taskIndex = dto.taskIndex ?? 0;

    if (this.hasAppliedAction(suggestion.metadataJson, 'CREATE_TASK', taskIndex)) {
      throw new ConflictException('Suggested task was already applied');
    }

    const suggestedTask = output.suggestedTasks?.[taskIndex];

    if (!suggestedTask) {
      throw new ConflictException('Suggested task not found');
    }

    const title = dto.title?.trim() || suggestedTask.title?.trim();

    if (!title) {
      throw new ConflictException('Suggested task title is required');
    }

    const description =
      dto.description?.trim() || suggestedTask.description?.trim() || null;

    const priority = dto.priority ?? suggestedTask.priority ?? Priority.MEDIUM;

    const dueDate = dto.dueDate
      ? new Date(dto.dueDate)
      : this.buildDueDateFromDays(suggestedTask.dueInDays ?? 2);

    const appliedAt = new Date();

    return this.prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          organizationId: currentUser.organizationId,
          title,
          description,
          leadId: lead.id,
          contactId: lead.contactId,
          assignedToUserId: currentUser.id,
          status: TaskStatus.TODO,
          priority,
          importanceLevel: ImportanceLevel.MEDIUM,
          dueDate,
          boardPosition: 0,
          statusChangedAt: appliedAt,
        },
      });

      const updatedSuggestion = await tx.aiSuggestion.update({
        where: {
          id: suggestion.id,
        },
        data: {
          metadataJson: this.buildAppliedMetadata({
            metadataJson: suggestion.metadataJson,
            action: 'CREATE_TASK',
            currentUser,
            appliedAt,
            recordType: EntityType.TASK,
            recordId: task.id,
            taskIndex,
            details: {
              title,
              priority,
              dueDate: dueDate.toISOString(),
            },
          }),
        },
        include: this.getSuggestionInclude(),
      });

      await tx.activityEvent.create({
        data: this.activityEventsService.buildCreateData(currentUser, {
          type: ActivityEventType.TASK_CREATED,
          entityType: EntityType.TASK,
          entityId: task.id,
          title: `Task created: ${task.title}`,
          description:
            'Task was created from an AI suggestion after human approval.',
          source: Source.AI_SUGGESTION,
          contactId: task.contactId ?? undefined,
          leadId: task.leadId ?? undefined,
          taskId: task.id,
          occurredAt: task.createdAt,
          metadataJson: {
            aiSuggestionId: suggestion.id,
            createdFromAiSuggestion: true,
            humanApprovalRequired: true,
          },
        }),
      });

      await tx.activityEvent.create({
        data: this.activityEventsService.buildCreateData(currentUser, {
          type: ActivityEventType.AI_SUGGESTION_APPLIED,
          entityType: EntityType.TASK,
          entityId: task.id,
          title: `AI suggestion applied: task created`,
          description:
            'A human created a task from an AI suggestion. No email was sent automatically.',
          source: Source.AI_SUGGESTION,
          contactId: task.contactId ?? undefined,
          leadId: task.leadId ?? undefined,
          taskId: task.id,
          occurredAt: appliedAt,
          metadataJson: {
            aiSuggestionId: suggestion.id,
            aiSuggestionType: suggestion.type,
            appliedAction: 'CREATE_TASK',
            taskIndex,
            appliedToCrm: true,
            canApplyAutomatically: false,
            canSendEmailAutomatically: false,
            taskId: task.id,
          },
        }),
      });

      return {
        suggestion: updatedSuggestion,
        task,
      };
    });
  }

  async createNoteFromSuggestion(
    id: string,
    currentUser: CurrentUser,
    dto: ApplySuggestedNoteDto,
  ) {
    const { suggestion, lead, output } = await this.getApplicableSuggestion(
      id,
      currentUser,
    );

    if (this.hasAppliedAction(suggestion.metadataJson, 'CREATE_NOTE')) {
      throw new ConflictException('Suggested note was already applied');
    }

    const content = dto.content?.trim() || output.suggestedNote?.trim();

    if (!content) {
      throw new ConflictException('Suggestion does not include a note');
    }

    const title = dto.title?.trim() || `AI suggested note: ${lead.title}`;
    const appliedAt = new Date();

    return this.prisma.$transaction(async (tx) => {
      const note = await tx.note.create({
        data: {
          organizationId: currentUser.organizationId,
          title,
          content,
          source: Source.AI_SUGGESTION,
          importanceLevel: ImportanceLevel.MEDIUM,
          createdByUserId: currentUser.id,
          companyId: lead.companyId,
          contactId: lead.contactId,
          leadId: lead.id,
        },
      });

      const updatedSuggestion = await tx.aiSuggestion.update({
        where: {
          id: suggestion.id,
        },
        data: {
          metadataJson: this.buildAppliedMetadata({
            metadataJson: suggestion.metadataJson,
            action: 'CREATE_NOTE',
            currentUser,
            appliedAt,
            recordType: EntityType.NOTE,
            recordId: note.id,
            details: {
              title,
            },
          }),
        },
        include: this.getSuggestionInclude(),
      });

      await tx.activityEvent.create({
        data: this.activityEventsService.buildCreateData(currentUser, {
          type: ActivityEventType.NOTE_CREATED,
          entityType: EntityType.NOTE,
          entityId: note.id,
          title: `Note created: ${note.title ?? note.id}`,
          description:
            'Note was created from an AI suggestion after human approval.',
          source: Source.AI_SUGGESTION,
          companyId: note.companyId ?? undefined,
          contactId: note.contactId ?? undefined,
          leadId: note.leadId ?? undefined,
          noteId: note.id,
          occurredAt: note.createdAt,
          metadataJson: {
            aiSuggestionId: suggestion.id,
            createdFromAiSuggestion: true,
            humanApprovalRequired: true,
          },
        }),
      });

      await tx.activityEvent.create({
        data: this.activityEventsService.buildCreateData(currentUser, {
          type: ActivityEventType.AI_SUGGESTION_APPLIED,
          entityType: EntityType.NOTE,
          entityId: note.id,
          title: `AI suggestion applied: note created`,
          description:
            'A human created a note from an AI suggestion. No email was sent automatically.',
          source: Source.AI_SUGGESTION,
          companyId: note.companyId ?? undefined,
          contactId: note.contactId ?? undefined,
          leadId: note.leadId ?? undefined,
          noteId: note.id,
          occurredAt: appliedAt,
          metadataJson: {
            aiSuggestionId: suggestion.id,
            aiSuggestionType: suggestion.type,
            appliedAction: 'CREATE_NOTE',
            appliedToCrm: true,
            canApplyAutomatically: false,
            canSendEmailAutomatically: false,
            noteId: note.id,
          },
        }),
      });

      return {
        suggestion: updatedSuggestion,
        note,
      };
    });
  }

    private async getApplicableSuggestion(id: string, currentUser: CurrentUser) {
    const suggestion = await this.prisma.aiSuggestion.findFirst({
      where: {
        id,
        organizationId: currentUser.organizationId,
      },
    });

    if (!suggestion) {
      throw new NotFoundException('AI suggestion not found');
    }

    if (
      suggestion.status !== AiSuggestionStatus.ACCEPTED &&
      suggestion.status !== AiSuggestionStatus.EDITED_AND_ACCEPTED
    ) {
      throw new ConflictException(
        'Only accepted AI suggestions can be applied to CRM',
      );
    }

    if (suggestion.type !== AiSuggestionType.SUGGEST_NEXT_STEPS) {
      throw new ConflictException('Unsupported AI suggestion type');
    }

    if (!suggestion.leadId) {
      throw new ConflictException('AI suggestion is not linked to a lead');
    }

    const lead = await this.prisma.lead.findFirst({
      where: {
        id: suggestion.leadId,
        organizationId: currentUser.organizationId,
        deletedAt: null,
      },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    const output = this.parseLeadNextStepsOutput(suggestion.outputJson);

    return {
      suggestion,
      lead,
      output,
    };
  }

  private parseLeadNextStepsOutput(
    outputJson: Prisma.JsonValue | null,
  ): LeadNextStepsOutput {
    if (!outputJson || typeof outputJson !== 'object' || Array.isArray(outputJson)) {
      throw new ConflictException('AI suggestion output is not structured');
    }

    return outputJson as LeadNextStepsOutput;
  }

  private buildDueDateFromDays(days: number) {
    const dueDate = new Date();

    dueDate.setDate(dueDate.getDate() + days);

    return dueDate;
  }

  private hasAppliedAction(
    metadataJson: Prisma.JsonValue | null,
    action: AppliedActionName,
    taskIndex?: number,
  ) {
    const metadata = this.asMetadataObject(metadataJson);
    const appliedActions = Array.isArray(metadata.appliedActions)
      ? metadata.appliedActions
      : [];

    return appliedActions.some((appliedAction) => {
      if (
        !appliedAction ||
        typeof appliedAction !== 'object' ||
        Array.isArray(appliedAction)
      ) {
        return false;
      }

      const appliedActionRecord = appliedAction as Record<string, unknown>;

      if (appliedActionRecord.action !== action) {
        return false;
      }

      if (action === 'CREATE_TASK') {
        return appliedActionRecord.taskIndex === taskIndex;
      }

      return true;
    });
  }

  private buildAppliedMetadata({
    metadataJson,
    action,
    currentUser,
    appliedAt,
    recordType,
    recordId,
    taskIndex,
    details,
  }: {
    metadataJson: Prisma.JsonValue | null;
    action: AppliedActionName;
    currentUser: CurrentUser;
    appliedAt: Date;
    recordType: EntityType;
    recordId: string;
    taskIndex?: number;
    details?: Record<string, unknown>;
  }): Prisma.InputJsonValue {
    const metadata = this.asMetadataObject(metadataJson);
    const appliedActions = Array.isArray(metadata.appliedActions)
      ? metadata.appliedActions
      : [];

    return {
      ...metadata,
      appliedToCrm: true,
      humanApprovalRequired: true,
      canApplyAutomatically: false,
      canSendEmailAutomatically: false,
      appliedActions: [
        ...appliedActions,
        {
          action,
          taskIndex: taskIndex ?? null,
          recordType,
          recordId,
          appliedByUserId: currentUser.id,
          appliedAt: appliedAt.toISOString(),
          details: details ?? {},
        },
      ],
    };
  }

  private asMetadataObject(metadataJson: Prisma.JsonValue | null) {
    if (
      metadataJson &&
      typeof metadataJson === 'object' &&
      !Array.isArray(metadataJson)
    ) {
      return metadataJson as Record<string, unknown>;
    }

    return {};
  }

  private async reviewSuggestion({
    id,
    currentUser,
    reviewStatus,
    activityType,
    reviewNote,
  }: {
    id: string;
    currentUser: CurrentUser;
    reviewStatus: AiSuggestionReviewStatus;
    activityType: AiSuggestionReviewActivityType;
    reviewNote?: string;
  }) {
    const suggestion = await this.prisma.aiSuggestion.findFirst({
      where: {
        id,
        organizationId: currentUser.organizationId,
      },
    });

    if (!suggestion) {
      throw new NotFoundException('AI suggestion not found');
    }

    if (suggestion.status !== AiSuggestionStatus.PENDING_REVIEW) {
      throw new ConflictException(
        'Only pending AI suggestions can be reviewed',
      );
    }

    const reviewedAt = new Date();

    return this.prisma.$transaction(async (tx) => {
      const updatedSuggestion = await tx.aiSuggestion.update({
        where: {
          id: suggestion.id,
        },
        data: {
          status: reviewStatus,
          reviewedByUserId: currentUser.id,
          reviewedAt,
          metadataJson: this.buildReviewedMetadata({
            metadataJson: suggestion.metadataJson,
            reviewStatus,
            reviewNote,
            currentUser,
            reviewedAt,
          }),
        },
        include: this.getSuggestionInclude(),
      });

      await tx.activityEvent.create({
        data: this.activityEventsService.buildCreateData(currentUser, {
          type: activityType,
          entityType: suggestion.entityType ?? EntityType.LEAD,
          entityId: suggestion.entityId ?? suggestion.leadId ?? suggestion.id,
          title:
            reviewStatus === AiSuggestionStatus.ACCEPTED
              ? `AI suggestion accepted: ${suggestion.title ?? suggestion.id}`
              : `AI suggestion rejected: ${suggestion.title ?? suggestion.id}`,
          description:
            reviewStatus === AiSuggestionStatus.ACCEPTED
              ? 'A human accepted this AI suggestion for review. No CRM data was changed automatically.'
              : 'A human rejected this AI suggestion. No CRM data was changed.',
          source: Source.AI_SUGGESTION,
          companyId: suggestion.companyId ?? undefined,
          contactId: suggestion.contactId ?? undefined,
          leadId: suggestion.leadId ?? undefined,
          taskId: suggestion.taskId ?? undefined,
          noteId: suggestion.noteId ?? undefined,
          occurredAt: reviewedAt,
          metadataJson: {
            aiSuggestionId: suggestion.id,
            aiSuggestionType: suggestion.type,
            previousStatus: suggestion.status,
            newStatus: reviewStatus,
            reviewNote: reviewNote ?? null,
            humanApprovalRequired: true,
            appliedToCrm: false,
            canApplyAutomatically: false,
            canSendEmailAutomatically: false,
          },
        }),
      });

      return updatedSuggestion;
    });
  }

  private getSuggestionInclude() {
    return {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          organizationId: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      reviewedBy: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          organizationId: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    };
  }

  private buildReviewedMetadata({
    metadataJson,
    reviewStatus,
    reviewNote,
    currentUser,
    reviewedAt,
  }: {
    metadataJson: Prisma.JsonValue | null;
    reviewStatus: AiSuggestionReviewStatus;
    reviewNote?: string;
    currentUser: CurrentUser;
    reviewedAt: Date;
  }): Prisma.InputJsonValue {
    const currentMetadata =
      metadataJson &&
      typeof metadataJson === 'object' &&
      !Array.isArray(metadataJson)
        ? (metadataJson as Record<string, unknown>)
        : {};

    return {
      ...currentMetadata,
      review: {
        status: reviewStatus,
        note: reviewNote ?? null,
        reviewedByUserId: currentUser.id,
        reviewedAt: reviewedAt.toISOString(),
        appliedToCrm: false,
        canApplyAutomatically: false,
        canSendEmailAutomatically: false,
      },
    };
  }

  private hashInput(inputText: string) {
    return createHash('sha256').update(inputText).digest('hex');
  }

  private getDefaultExpirationDate() {
    const expirationDate = new Date();

    expirationDate.setDate(expirationDate.getDate() + 14);

    return expirationDate;
  }
}