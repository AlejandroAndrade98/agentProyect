import { Injectable, NotFoundException } from '@nestjs/common';
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

  private hashInput(inputText: string) {
    return createHash('sha256').update(inputText).digest('hex');
  }

  private getDefaultExpirationDate() {
    const expirationDate = new Date();

    expirationDate.setDate(expirationDate.getDate() + 14);

    return expirationDate;
  }
}