import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ActivityEventType,
  AiSuggestionStatus,
  AiSuggestionType,
  EntityType,
  Prisma,
  Source,
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

type AiSuggestionReviewStatus = Extract<
  AiSuggestionStatus,
  'ACCEPTED' | 'REJECTED'
>;

type AiSuggestionReviewActivityType = Extract<
  ActivityEventType,
  'AI_SUGGESTION_ACCEPTED' | 'AI_SUGGESTION_REJECTED'
>;

@Injectable()
export class AiSuggestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityEventsService: ActivityEventsService,
    private readonly leadAiContextService: LeadAiContextService,
    private readonly aiSuggestionProviderService: AiSuggestionProviderService,
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