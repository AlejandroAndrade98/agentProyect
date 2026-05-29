// FILE: apps/api/src/ai-suggestions/ai-suggestions.service.ts

import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityEventType,
  AiSuggestionStatus,
  AiSuggestionType,
  AiUsageFeature,
  ConnectedAccountCapability,
  ConnectedAccountProvider,
  ConnectedAccountStatus,
  EntityType,
  ImportanceLevel,
  LeadStatus,
  Prisma,
  Priority,
  Source,
  TaskStatus,
} from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';

import { CurrentUser } from '../auth/interfaces/current-user.interface';
import { PrismaService } from '../database/prisma.service';
import {
  buildPaginatedResult,
  getPaginationParams,
  normalizeSearch,
} from '../common/utils/pagination.util';
import { ActivityEventsService } from '../activity-events/activity-events.service';

import {
  AiProviderError,
  AiSuggestionProviderService,
} from './ai-suggestion-provider.service';
import { LeadAiContextService } from './lead-ai-context.service';
import { QueryAiSuggestionsDto } from './dto/query-ai-suggestions.dto';
import { ReviewAiSuggestionDto } from './dto/review-ai-suggestion.dto';

import { ApplyLeadNextStepDto } from './dto/apply-lead-next-step.dto';
import { ApplySuggestedNoteDto } from './dto/apply-suggested-note.dto';
import { ApplySuggestedTaskDto } from './dto/apply-suggested-task.dto';
import { AiUsageService } from '../ai-usage/ai-usage.service';
import { ConnectedAccountTokenEncryptionService } from '../connected-accounts/connected-account-token-encryption.service';

const GMAIL_DRAFTS_URL =
  'https://gmail.googleapis.com/gmail/v1/users/me/drafts';

const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';

const GMAIL_COMPOSE_SCOPE =
  'https://www.googleapis.com/auth/gmail.compose';

type GoogleRefreshTokenResponse = {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

type GmailDraftCreateResponse = {
  id?: string;
  message?: {
    id?: string;
    threadId?: string;
    labelIds?: string[];
  };
  error?: {
    message?: string;
    status?: string;
  };
};

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

type ExternalEmailAnalysisApplyOutput = {
  summary?: string;
  importanceLevel?: ImportanceLevel;
  suggestedNote?: string;
  suggestedTasks?: SuggestedTaskOutput[];
  reasoningSummary?: string;
};

type ExternalCalendarEventAnalysisApplyOutput = {
  summary?: string;
  importanceLevel?: ImportanceLevel;
  suggestedNote?: string;
  suggestedTasks?: SuggestedTaskOutput[];
  reasoningSummary?: string;
};

type AppliedActionName =
  | 'UPDATE_LEAD_NEXT_STEP'
  | 'CREATE_TASK'
  | 'CREATE_NOTE'
  | 'CREATE_NOTE_FROM_EXTERNAL_EMAIL'
  | 'CREATE_TASK_FROM_EXTERNAL_EMAIL'
  | 'CREATE_LEAD_FROM_EXTERNAL_EMAIL'
  | 'CREATE_TASK_FROM_EXTERNAL_CALENDAR_EVENT'
  | 'CREATE_TASK_FROM_EXTERNAL_CALENDAR'
  | 'CREATE_NOTE_FROM_EXTERNAL_CALENDAR'
  | 'CREATE_LEAD_FROM_EXTERNAL_CALENDAR'
  | 'CREATE_GMAIL_DRAFT_FROM_EMAIL_REPLY_SUGGESTION';

@Injectable()
export class AiSuggestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityEventsService: ActivityEventsService,
    private readonly leadAiContextService: LeadAiContextService,
    private readonly aiSuggestionProviderService: AiSuggestionProviderService,
    private readonly aiUsageService: AiUsageService,
    private readonly configService: ConfigService,
    private readonly tokenEncryptionService: ConnectedAccountTokenEncryptionService,
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
          externalEmailMessage: {
            select: {
              id: true,
              subject: true,
              fromEmail: true,
              fromName: true,
              internalDate: true,
            },
          },
          externalCalendarEvent: {
            select: {
              id: true,
              summary: true,
              startAt: true,
              endAt: true,
            },
          },
          
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
      include: this.getSuggestionInclude(),
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

    const generated = await this.generateWithFailureUsage(
      currentUser,
      {
        feature: AiUsageFeature.LEAD_NEXT_STEPS,
        inputText,
        estimatedCreditsRequired,
        metadataJson: {
          leadId: context.lead.id,
          feature: AiUsageFeature.LEAD_NEXT_STEPS,
          estimatedCreditsRequired,
        },
      },
      () =>
        this.aiSuggestionProviderService.generateLeadNextSteps(
          context,
          inputText,
        ),
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

  async analyzeExternalEmailMessage(
    emailMessageId: string,
    currentUser: CurrentUser,
  ) {
    const emailMessage = await this.prisma.externalEmailMessage.findFirst({
      where: {
        id: emailMessageId,
        organizationId: currentUser.organizationId,
        deletedAt: null,
        connectedAccount: {
          userId: currentUser.id,
        },
      },
      select: {
        id: true,
        organizationId: true,
        connectedAccountId: true,
        provider: true,
        externalMessageId: true,
        externalThreadId: true,
        subject: true,
        snippet: true,
        fromEmail: true,
        fromName: true,
        toEmailsJson: true,
        ccEmailsJson: true,
        bccEmailsJson: true,
        labelIdsJson: true,
        internalDate: true,
        metadataJson: true,
        syncedAt: true,
        connectedAccount: {
          select: {
            id: true,
            provider: true,
            email: true,
            displayName: true,
            status: true,
            userId: true,
          },
        },
      },
    });

    if (!emailMessage) {
      throw new NotFoundException('External email message not found');
    }

    const existingPendingSuggestion = await this.prisma.aiSuggestion.findFirst({
      where: {
        organizationId: currentUser.organizationId,
        type: AiSuggestionType.ANALYZE_EXTERNAL_EMAIL,
        status: AiSuggestionStatus.PENDING_REVIEW,
        externalEmailMessageId: emailMessage.id,
      },
      select: {
        id: true,
      },
    });

    if (existingPendingSuggestion) {
      throw new ConflictException(
        'This email already has a pending AI review suggestion',
      );
    }

    const inputText = this.buildExternalEmailMetadataInputText(emailMessage);
    const inputHash = this.hashInput(inputText);

    const estimatedCreditsRequired =
      this.aiUsageService.estimateCreditsFromText(inputText, 220);

    await this.aiUsageService.assertCanUseAi(currentUser, {
      feature: AiUsageFeature.EXTERNAL_EMAIL_ANALYSIS,
      estimatedCreditsRequired,
      metadataJson: {
        externalEmailMessageId: emailMessage.id,
        connectedAccountId: emailMessage.connectedAccountId,
        externalMessageId: emailMessage.externalMessageId,
        feature: AiUsageFeature.EXTERNAL_EMAIL_ANALYSIS,
        estimatedCreditsRequired,
        bodyStored: false,
      },
    });

    const generated = await this.generateWithFailureUsage(
      currentUser,
      {
        feature: AiUsageFeature.EXTERNAL_EMAIL_ANALYSIS,
        inputText,
        estimatedCreditsRequired,
        metadataJson: {
          externalEmailMessageId: emailMessage.id,
          connectedAccountId: emailMessage.connectedAccountId,
          externalMessageId: emailMessage.externalMessageId,
          feature: AiUsageFeature.EXTERNAL_EMAIL_ANALYSIS,
          estimatedCreditsRequired,
          bodyStored: false,
        },
      },
      () =>
        this.aiSuggestionProviderService.generateExternalEmailAnalysis(
        {
          id: emailMessage.id,
          connectedAccountId: emailMessage.connectedAccountId,
          provider: emailMessage.provider,
          externalMessageId: emailMessage.externalMessageId,
          externalThreadId: emailMessage.externalThreadId,
          subject: emailMessage.subject,
          snippet: emailMessage.snippet,
          fromEmail: emailMessage.fromEmail,
          fromName: emailMessage.fromName,
          toEmailsJson: emailMessage.toEmailsJson,
          ccEmailsJson: emailMessage.ccEmailsJson,
          bccEmailsJson: emailMessage.bccEmailsJson,
          labelIdsJson: emailMessage.labelIdsJson,
          internalDate: emailMessage.internalDate,
          syncedAt: emailMessage.syncedAt,
        },
        inputText,
        ),
    );

    return this.prisma.$transaction(async (tx) => {
      const suggestion = await tx.aiSuggestion.create({
        data: {
          organizationId: currentUser.organizationId,
          userId: currentUser.id,
          provider: generated.provider,
          type: AiSuggestionType.ANALYZE_EXTERNAL_EMAIL,
          status: AiSuggestionStatus.PENDING_REVIEW,
          title: generated.title,
          entityType: EntityType.EXTERNAL_EMAIL_MESSAGE,
          entityId: emailMessage.id,
          externalEmailMessageId: emailMessage.id,
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
            generatedFor: 'external_email_review',
            source: 'external_sync',
            connectedAccountId: emailMessage.connectedAccountId,
            externalEmailMessageId: emailMessage.id,
            externalMessageId: emailMessage.externalMessageId,
            externalThreadId: emailMessage.externalThreadId,
            bodyStored: false,
            aiAnalysisScope: 'metadata_only',
            crmRecordsCreated: false,
            emailSentAutomatically: false,
          },
          tokensInput: generated.tokensInput,
          tokensOutput: generated.tokensOutput,
          estimatedCostUsd: generated.estimatedCostUsd,
          expiresAt: this.getDefaultExpirationDate(),
        },
      });

      await this.aiUsageService.recordSuccessfulUsage(tx, currentUser, {
        feature: AiUsageFeature.EXTERNAL_EMAIL_ANALYSIS,
        provider: generated.provider,
        model: generated.model,
        tokensInput: generated.tokensInput,
        tokensOutput: generated.tokensOutput,
        estimatedCostUsd: generated.estimatedCostUsd,
        aiSuggestionId: suggestion.id,
        metadataJson: {
          aiSuggestionId: suggestion.id,
          aiSuggestionType: suggestion.type,
          externalEmailMessageId: emailMessage.id,
          connectedAccountId: emailMessage.connectedAccountId,
          externalMessageId: emailMessage.externalMessageId,
          estimatedCreditsRequired,
          bodyStored: false,
          crmRecordsCreated: false,
        },
      });

      await tx.activityEvent.create({
        data: this.activityEventsService.buildCreateData(currentUser, {
          type: ActivityEventType.AI_SUGGESTION_CREATED,
          entityType: EntityType.EXTERNAL_EMAIL_MESSAGE,
          entityId: emailMessage.id,
          title: `AI email review suggestion created`,
          description:
            'AI generated a review suggestion from synced email metadata. Human review is required before creating any CRM record.',
          source: Source.AI_SUGGESTION,
          occurredAt: suggestion.createdAt,
          metadataJson: {
            aiSuggestionId: suggestion.id,
            aiSuggestionType: suggestion.type,
            aiSuggestionStatus: suggestion.status,
            externalEmailMessageId: emailMessage.id,
            connectedAccountId: emailMessage.connectedAccountId,
            externalMessageId: emailMessage.externalMessageId,
            humanApprovalRequired: true,
            canApplyAutomatically: false,
            canSendEmailAutomatically: false,
            bodyStored: false,
            crmRecordsCreated: false,
          },
        }),
      });

      return suggestion;
    });
  }

  async generateExternalEmailReplyDraft(
    emailMessageId: string,
    currentUser: CurrentUser,
  ) {
    const emailMessage = await this.prisma.externalEmailMessage.findFirst({
      where: {
        id: emailMessageId,
        organizationId: currentUser.organizationId,
        deletedAt: null,
        connectedAccount: {
          userId: currentUser.id,
        },
      },
      select: {
        id: true,
        organizationId: true,
        connectedAccountId: true,
        provider: true,
        externalMessageId: true,
        externalThreadId: true,
        subject: true,
        snippet: true,
        fromEmail: true,
        fromName: true,
        toEmailsJson: true,
        ccEmailsJson: true,
        bccEmailsJson: true,
        labelIdsJson: true,
        internalDate: true,
        metadataJson: true,
        syncedAt: true,
        connectedAccount: {
          select: {
            id: true,
            provider: true,
            email: true,
            displayName: true,
            status: true,
            userId: true,
          },
        },
      },
    });

    if (!emailMessage) {
      throw new NotFoundException('External email message not found');
    }

    const existingPendingSuggestion = await this.prisma.aiSuggestion.findFirst({
      where: {
        organizationId: currentUser.organizationId,
        type: AiSuggestionType.GENERATE_EMAIL_REPLY_DRAFT,
        status: AiSuggestionStatus.PENDING_REVIEW,
        externalEmailMessageId: emailMessage.id,
      },
      select: {
        id: true,
      },
    });

    if (existingPendingSuggestion) {
      throw new ConflictException(
        'This email already has a pending AI reply draft suggestion',
      );
    }

    const inputText = this.buildExternalEmailMetadataInputText(emailMessage);
    const inputHash = this.hashInput(inputText);

    const estimatedCreditsRequired =
      this.aiUsageService.estimateCreditsFromText(inputText, 180);

    await this.aiUsageService.assertCanUseAi(currentUser, {
      feature: AiUsageFeature.EXTERNAL_EMAIL_REPLY_DRAFT,
      estimatedCreditsRequired,
      metadataJson: {
        externalEmailMessageId: emailMessage.id,
        connectedAccountId: emailMessage.connectedAccountId,
        externalMessageId: emailMessage.externalMessageId,
        externalThreadId: emailMessage.externalThreadId,
        feature: AiUsageFeature.EXTERNAL_EMAIL_REPLY_DRAFT,
        estimatedCreditsRequired,
        bodyStored: false,
        draftCreatedAutomatically: false,
        emailSentAutomatically: false,
        crmRecordsCreated: false,
      },
    });

    const generated = await this.generateWithFailureUsage(
      currentUser,
      {
        feature: AiUsageFeature.EXTERNAL_EMAIL_REPLY_DRAFT,
        inputText,
        estimatedCreditsRequired,
        metadataJson: {
          externalEmailMessageId: emailMessage.id,
          connectedAccountId: emailMessage.connectedAccountId,
          externalMessageId: emailMessage.externalMessageId,
          externalThreadId: emailMessage.externalThreadId,
          feature: AiUsageFeature.EXTERNAL_EMAIL_REPLY_DRAFT,
          estimatedCreditsRequired,
          bodyStored: false,
          draftCreatedAutomatically: false,
          emailSentAutomatically: false,
          crmRecordsCreated: false,
        },
      },
      () =>
        this.aiSuggestionProviderService.generateExternalEmailReplyDraft(
        {
          id: emailMessage.id,
          connectedAccountId: emailMessage.connectedAccountId,
          provider: emailMessage.provider,
          externalMessageId: emailMessage.externalMessageId,
          externalThreadId: emailMessage.externalThreadId,
          subject: emailMessage.subject,
          snippet: emailMessage.snippet,
          fromEmail: emailMessage.fromEmail,
          fromName: emailMessage.fromName,
          toEmailsJson: emailMessage.toEmailsJson,
          ccEmailsJson: emailMessage.ccEmailsJson,
          bccEmailsJson: emailMessage.bccEmailsJson,
          labelIdsJson: emailMessage.labelIdsJson,
          internalDate: emailMessage.internalDate,
          syncedAt: emailMessage.syncedAt,
        },
        inputText,
        ),
    );

    const output = generated.outputJson;

    return this.prisma.$transaction(async (tx) => {
      const suggestion = await tx.aiSuggestion.create({
        data: {
          organizationId: currentUser.organizationId,
          userId: currentUser.id,
          provider: generated.provider,
          type: AiSuggestionType.GENERATE_EMAIL_REPLY_DRAFT,
          status: AiSuggestionStatus.PENDING_REVIEW,
          title: generated.title,
          entityType: EntityType.EXTERNAL_EMAIL_MESSAGE,
          entityId: emailMessage.id,
          externalEmailMessageId: emailMessage.id,
          inputText,
          inputHash,
          outputJson: generated.outputJson as Prisma.InputJsonValue,
          outputText: generated.outputText,
          confidenceScore: generated.confidenceScore,
          metadataJson: {
            model: generated.model,
            suggestedSubject: output.suggestedSubject,
            tone: output.tone,
            confidence: output.confidence,
            reasoning: output.reasoning,
            humanApprovalRequired: true,
            canApplyAutomatically: false,
            canSendEmailAutomatically: false,
            emailSentAutomatically: false,
            draftCreatedAutomatically: false,
            aiAnalysisScope: 'metadata_only',
            generatedFor: 'external_email_reply_draft',
            source: 'external_sync',
            connectedAccountId: emailMessage.connectedAccountId,
            externalEmailMessageId: emailMessage.id,
            externalMessageId: emailMessage.externalMessageId,
            externalThreadId: emailMessage.externalThreadId,
            bodyStored: false,
            crmRecordsCreated: false,
          },
          tokensInput: generated.tokensInput,
          tokensOutput: generated.tokensOutput,
          estimatedCostUsd: generated.estimatedCostUsd,
          expiresAt: this.getDefaultExpirationDate(),
        },
      });

      await this.aiUsageService.recordSuccessfulUsage(tx, currentUser, {
        feature: AiUsageFeature.EXTERNAL_EMAIL_REPLY_DRAFT,
        provider: generated.provider,
        model: generated.model,
        tokensInput: generated.tokensInput,
        tokensOutput: generated.tokensOutput,
        estimatedCostUsd: generated.estimatedCostUsd,
        aiSuggestionId: suggestion.id,
        metadataJson: {
          aiSuggestionId: suggestion.id,
          aiSuggestionType: suggestion.type,
          externalEmailMessageId: emailMessage.id,
          connectedAccountId: emailMessage.connectedAccountId,
          externalMessageId: emailMessage.externalMessageId,
          externalThreadId: emailMessage.externalThreadId,
          estimatedCreditsRequired,
          bodyStored: false,
          draftCreatedAutomatically: false,
          emailSentAutomatically: false,
          crmRecordsCreated: false,
        },
      });

      await tx.activityEvent.create({
        data: this.activityEventsService.buildCreateData(currentUser, {
          type: ActivityEventType.AI_SUGGESTION_CREATED,
          entityType: EntityType.EXTERNAL_EMAIL_MESSAGE,
          entityId: emailMessage.id,
          title: `AI email reply draft suggestion created`,
          description:
            'AI generated a reply draft suggestion from synced email metadata. Human review is required before creating a draft or sending any email.',
          source: Source.AI_SUGGESTION,
          occurredAt: suggestion.createdAt,
          metadataJson: {
            aiSuggestionId: suggestion.id,
            aiSuggestionType: suggestion.type,
            aiSuggestionStatus: suggestion.status,
            externalEmailMessageId: emailMessage.id,
            connectedAccountId: emailMessage.connectedAccountId,
            externalMessageId: emailMessage.externalMessageId,
            externalThreadId: emailMessage.externalThreadId,
            humanApprovalRequired: true,
            canApplyAutomatically: false,
            canSendEmailAutomatically: false,
            draftCreatedAutomatically: false,
            emailSentAutomatically: false,
            bodyStored: false,
            crmRecordsCreated: false,
          },
        }),
      });

      return suggestion;
    });
  }

  async createGmailDraftFromEmailReplySuggestion(
    id: string,
    currentUser: CurrentUser,
  ) {
    const suggestion = await this.prisma.aiSuggestion.findFirst({
      where: {
        id,
        organizationId: currentUser.organizationId,
      },
      include: {
        externalEmailMessage: {
          select: {
            id: true,
            organizationId: true,
            connectedAccountId: true,
            provider: true,
            externalMessageId: true,
            externalThreadId: true,
            subject: true,
            snippet: true,
            fromEmail: true,
            fromName: true,
            toEmailsJson: true,
            ccEmailsJson: true,
            labelIdsJson: true,
            internalDate: true,
            syncedAt: true,
            connectedAccount: {
              select: {
                id: true,
                organizationId: true,
                userId: true,
                provider: true,
                email: true,
                status: true,
                capabilities: true,
                scopesJson: true,
                encryptedAccessToken: true,
                encryptedRefreshToken: true,
                tokenExpiresAt: true,
              },
            },
          },
        },
      },
    });

    if (!suggestion) {
      throw new NotFoundException('AI suggestion not found');
    }

    if (suggestion.type !== AiSuggestionType.GENERATE_EMAIL_REPLY_DRAFT) {
      throw new BadRequestException(
        'Only email reply draft suggestions can create Gmail drafts',
      );
    }

    if (suggestion.status !== AiSuggestionStatus.ACCEPTED) {
      throw new ConflictException(
        'Only accepted email reply draft suggestions can create Gmail drafts',
      );
    }

    if (!suggestion.externalEmailMessageId || !suggestion.externalEmailMessage) {
      throw new BadRequestException(
        'AI suggestion is not linked to a synced external email message',
      );
    }

    const email = suggestion.externalEmailMessage;
    const account = email.connectedAccount;

    if (
      account.organizationId !== currentUser.organizationId ||
      account.userId !== currentUser.id
    ) {
      throw new NotFoundException('AI suggestion not found');
    }

    if (
      account.provider !== ConnectedAccountProvider.GOOGLE ||
      account.status !== ConnectedAccountStatus.CONNECTED ||
      !account.capabilities.includes(ConnectedAccountCapability.EMAIL)
    ) {
      throw new BadRequestException(
        'AI suggestion is not linked to a connected Google email account',
      );
    }

    if (
      this.hasAppliedAction(
        suggestion.metadataJson,
        'CREATE_GMAIL_DRAFT_FROM_EMAIL_REPLY_SUGGESTION',
      )
    ) {
      throw new ConflictException(
        'A Gmail draft has already been created from this AI suggestion',
      );
    }

    if (!account.encryptedAccessToken || !account.encryptedRefreshToken) {
      throw new BadRequestException(
        'Connected Google account does not have OAuth tokens',
      );
    }

    if (!this.hasGoogleScope(account.scopesJson, GMAIL_COMPOSE_SCOPE)) {
      throw new BadRequestException(
        'Connected Google account is not authorized to create Gmail drafts. Reconnect Google with Gmail draft permissions and try again.',
      );
    }

    const recipientEmail = email.fromEmail?.trim();

    if (!recipientEmail) {
      throw new BadRequestException(
        'Synced email metadata does not include a reply recipient',
      );
    }

    const replyBody = suggestion.outputText?.trim();

    if (!replyBody) {
      throw new BadRequestException(
        'AI suggestion does not include a reply draft body',
      );
    }

    const suggestedSubject =
      this.getSuggestionMetadataString(suggestion.outputJson, 'suggestedSubject') ||
      this.getSuggestionMetadataString(
        suggestion.metadataJson,
        'suggestedSubject',
      ) ||
      this.buildReplySubject(email.subject);

    const accessToken = await this.getValidGoogleAccessToken(account);
    const gmailDraft = await this.createGmailDraft({
      accessToken,
      toEmail: recipientEmail,
      toName: email.fromName,
      subject: suggestedSubject,
      body: replyBody,
      threadId: email.externalThreadId,
    });

    if (!gmailDraft.id) {
      throw new HttpException(
        'Gmail draft creation failed. Please try again later.',
        HttpStatus.BAD_GATEWAY,
      );
    }

    const gmailThreadId = gmailDraft.message?.threadId ?? email.externalThreadId;
    const createdAt = new Date();

    const updatedSuggestion = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.aiSuggestion.update({
        where: {
          id: suggestion.id,
        },
        data: {
          metadataJson: this.buildGmailDraftAppliedMetadata({
            metadataJson: suggestion.metadataJson,
            currentUser,
            gmailDraftId: gmailDraft.id as string,
            gmailThreadId,
            connectedAccountId: account.id,
            externalEmailMessageId: email.id,
            externalMessageId: email.externalMessageId,
            externalThreadId: email.externalThreadId,
            createdAt,
          }),
        },
        include: this.getSuggestionInclude(),
      });

      await tx.activityEvent.create({
        data: this.activityEventsService.buildCreateData(currentUser, {
          type: ActivityEventType.AI_SUGGESTION_APPLIED,
          entityType: EntityType.CONNECTED_ACCOUNT,
          entityId: account.id,
          title: 'Gmail draft created from AI reply suggestion',
          description:
            'A human created a Gmail draft from an AI reply suggestion. The email was NOT sent automatically.',
          source: Source.AI_SUGGESTION,
          occurredAt: createdAt,
          metadataJson: {
            appliedAction:
              'CREATE_GMAIL_DRAFT_FROM_EMAIL_REPLY_SUGGESTION',
            aiSuggestionId: suggestion.id,
            aiSuggestionType: suggestion.type,
            connectedAccountId: account.id,
            externalEmailMessageId: email.id,
            externalMessageId: email.externalMessageId,
            externalThreadId: email.externalThreadId,
            gmailDraftId: gmailDraft.id,
            gmailThreadId,
            humanApprovalRequired: true,
            canSendEmailAutomatically: false,
            draftCreatedAutomatically: false,
            emailSentAutomatically: false,
            crmRecordsCreated: false,
          },
        }),
      });

      return updated;
    });

    return {
      suggestion: updatedSuggestion,
      gmailDraftId: gmailDraft.id,
      gmailThreadId,
      gmailDraftMetadata: {
        connectedAccountId: account.id,
        externalEmailMessageId: email.id,
        externalMessageId: email.externalMessageId,
        externalThreadId: email.externalThreadId,
        messageId: gmailDraft.message?.id ?? null,
        labelIds: gmailDraft.message?.labelIds ?? [],
        recipientEmail,
        suggestedSubject,
        createdAt: createdAt.toISOString(),
      },
      confirmation: {
        humanApprovalRequired: true,
        draftCreatedAutomatically: false,
        canSendEmailAutomatically: false,
        emailSentAutomatically: false,
        crmRecordsCreated: false,
      },
    };
  }

  async analyzeExternalCalendarEvent(
    calendarEventId: string,
    currentUser: CurrentUser,
  ) {
    const calendarEvent = await this.prisma.externalCalendarEvent.findFirst({
      where: {
        id: calendarEventId,
        organizationId: currentUser.organizationId,
        deletedAt: null,
        connectedAccount: {
          userId: currentUser.id,
        },
      },
      select: {
        id: true,
        organizationId: true,
        connectedAccountId: true,
        provider: true,
        externalCalendarId: true,
        externalEventId: true,
        iCalUid: true,
        status: true,
        summary: true,
        description: true,
        location: true,
        startAt: true,
        endAt: true,
        isAllDay: true,
        organizerEmail: true,
        organizerName: true,
        attendeesJson: true,
        htmlLink: true,
        metadataJson: true,
        syncedAt: true,
        connectedAccount: {
          select: {
            id: true,
            provider: true,
            email: true,
            displayName: true,
            status: true,
            userId: true,
          },
        },
      },
    });

    if (!calendarEvent) {
      throw new NotFoundException('External calendar event not found');
    }

    const existingPendingSuggestion = await this.prisma.aiSuggestion.findFirst({
      where: {
        organizationId: currentUser.organizationId,
        type: AiSuggestionType.ANALYZE_EXTERNAL_CALENDAR_EVENT,
        status: AiSuggestionStatus.PENDING_REVIEW,
        externalCalendarEventId: calendarEvent.id,
      },
      select: {
        id: true,
      },
    });

    if (existingPendingSuggestion) {
      throw new ConflictException(
        'This calendar event already has a pending AI review suggestion',
      );
    }

    const inputText =
      this.buildExternalCalendarEventMetadataInputText(calendarEvent);
    const inputHash = this.hashInput(inputText);

    const estimatedCreditsRequired =
      this.aiUsageService.estimateCreditsFromText(inputText, 240);

    await this.aiUsageService.assertCanUseAi(currentUser, {
      feature: AiUsageFeature.EXTERNAL_CALENDAR_ANALYSIS,
      estimatedCreditsRequired,
      metadataJson: {
        externalCalendarEventId: calendarEvent.id,
        connectedAccountId: calendarEvent.connectedAccountId,
        externalCalendarId: calendarEvent.externalCalendarId,
        externalEventId: calendarEvent.externalEventId,
        feature: AiUsageFeature.EXTERNAL_CALENDAR_ANALYSIS,
        estimatedCreditsRequired,
        crmRecordsCreated: false,
        emailSentAutomatically: false,
      },
    });

    const generated = await this.generateWithFailureUsage(
      currentUser,
      {
        feature: AiUsageFeature.EXTERNAL_CALENDAR_ANALYSIS,
        inputText,
        estimatedCreditsRequired,
        metadataJson: {
          externalCalendarEventId: calendarEvent.id,
          connectedAccountId: calendarEvent.connectedAccountId,
          externalCalendarId: calendarEvent.externalCalendarId,
          externalEventId: calendarEvent.externalEventId,
          feature: AiUsageFeature.EXTERNAL_CALENDAR_ANALYSIS,
          estimatedCreditsRequired,
          crmRecordsCreated: false,
          emailSentAutomatically: false,
        },
      },
      () =>
        this.aiSuggestionProviderService.generateExternalCalendarEventAnalysis(
        {
          id: calendarEvent.id,
          connectedAccountId: calendarEvent.connectedAccountId,
          provider: calendarEvent.provider,
          externalCalendarId: calendarEvent.externalCalendarId,
          externalEventId: calendarEvent.externalEventId,
          iCalUid: calendarEvent.iCalUid,
          status: calendarEvent.status,
          summary: calendarEvent.summary,
          description: calendarEvent.description,
          location: calendarEvent.location,
          startAt: calendarEvent.startAt,
          endAt: calendarEvent.endAt,
          isAllDay: calendarEvent.isAllDay,
          organizerEmail: calendarEvent.organizerEmail,
          organizerName: calendarEvent.organizerName,
          attendeesJson: calendarEvent.attendeesJson,
          htmlLink: calendarEvent.htmlLink,
          syncedAt: calendarEvent.syncedAt,
        },
        inputText,
        ),
    );

    return this.prisma.$transaction(async (tx) => {
      const suggestion = await tx.aiSuggestion.create({
        data: {
          organizationId: currentUser.organizationId,
          userId: currentUser.id,
          provider: generated.provider,
          type: AiSuggestionType.ANALYZE_EXTERNAL_CALENDAR_EVENT,
          status: AiSuggestionStatus.PENDING_REVIEW,
          title: generated.title,
          entityType: EntityType.EXTERNAL_CALENDAR_EVENT,
          entityId: calendarEvent.id,
          externalCalendarEventId: calendarEvent.id,
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
            generatedFor: 'external_calendar_event_review',
            source: 'external_sync',
            connectedAccountId: calendarEvent.connectedAccountId,
            externalCalendarEventId: calendarEvent.id,
            externalCalendarId: calendarEvent.externalCalendarId,
            externalEventId: calendarEvent.externalEventId,
            iCalUid: calendarEvent.iCalUid,
            aiAnalysisScope: 'metadata_only',
            crmRecordsCreated: false,
            emailSentAutomatically: false,
          },
          tokensInput: generated.tokensInput,
          tokensOutput: generated.tokensOutput,
          estimatedCostUsd: generated.estimatedCostUsd,
          expiresAt: this.getDefaultExpirationDate(),
        },
      });

      await this.aiUsageService.recordSuccessfulUsage(tx, currentUser, {
        feature: AiUsageFeature.EXTERNAL_CALENDAR_ANALYSIS,
        provider: generated.provider,
        model: generated.model,
        tokensInput: generated.tokensInput,
        tokensOutput: generated.tokensOutput,
        estimatedCostUsd: generated.estimatedCostUsd,
        aiSuggestionId: suggestion.id,
        metadataJson: {
          aiSuggestionId: suggestion.id,
          aiSuggestionType: suggestion.type,
          externalCalendarEventId: calendarEvent.id,
          connectedAccountId: calendarEvent.connectedAccountId,
          externalCalendarId: calendarEvent.externalCalendarId,
          externalEventId: calendarEvent.externalEventId,
          estimatedCreditsRequired,
          crmRecordsCreated: false,
          emailSentAutomatically: false,
        },
      });

      await tx.activityEvent.create({
        data: this.activityEventsService.buildCreateData(currentUser, {
          type: ActivityEventType.AI_SUGGESTION_CREATED,
          entityType: EntityType.EXTERNAL_CALENDAR_EVENT,
          entityId: calendarEvent.id,
          title: `AI calendar review suggestion created`,
          description:
            'AI generated a review suggestion from synced calendar metadata. Human review is required before creating any CRM record.',
          source: Source.AI_SUGGESTION,
          occurredAt: suggestion.createdAt,
          metadataJson: {
            aiSuggestionId: suggestion.id,
            aiSuggestionType: suggestion.type,
            aiSuggestionStatus: suggestion.status,
            externalCalendarEventId: calendarEvent.id,
            connectedAccountId: calendarEvent.connectedAccountId,
            externalCalendarId: calendarEvent.externalCalendarId,
            externalEventId: calendarEvent.externalEventId,
            humanApprovalRequired: true,
            canApplyAutomatically: false,
            canSendEmailAutomatically: false,
            crmRecordsCreated: false,
            emailSentAutomatically: false,
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

  async createNoteFromExternalEmailSuggestion(
    id: string,
    currentUser: CurrentUser,
    dto: ApplySuggestedNoteDto,
  ) {
    const suggestion = await this.prisma.aiSuggestion.findFirst({
      where: {
        id,
        organizationId: currentUser.organizationId,
      },
      include: this.getSuggestionInclude(),
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

    if (suggestion.type !== AiSuggestionType.ANALYZE_EXTERNAL_EMAIL) {
      throw new ConflictException('Unsupported AI suggestion type');
    }

    if (!suggestion.externalEmailMessageId) {
      throw new ConflictException(
        'AI suggestion is not linked to an external email message',
      );
    }

    if (
      this.hasAppliedAction(
        suggestion.metadataJson,
        'CREATE_NOTE_FROM_EXTERNAL_EMAIL',
      )
    ) {
      throw new ConflictException('External email note was already created');
    }

    const output = this.parseExternalEmailAnalysisOutput(suggestion.outputJson);
    const email = suggestion.externalEmailMessage;
    const noteBody =
      dto.content?.trim() ||
      output.suggestedNote?.trim() ||
      output.summary?.trim();

    if (!noteBody) {
      throw new ConflictException('Suggestion does not include a note');
    }

    const title =
      dto.title?.trim() ||
      `AI email review note: ${email?.subject?.trim() || 'Synced email'}`;
    const content = this.buildExternalEmailNoteContent({
      noteBody,
      output,
      email,
      externalEmailMessageId: suggestion.externalEmailMessageId,
    });
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
          companyId: suggestion.companyId,
          contactId: suggestion.contactId,
          leadId: suggestion.leadId,
        },
      });

      const updatedSuggestion = await tx.aiSuggestion.update({
        where: {
          id: suggestion.id,
        },
        data: {
          metadataJson: this.buildAppliedMetadata({
            metadataJson: suggestion.metadataJson,
            action: 'CREATE_NOTE_FROM_EXTERNAL_EMAIL',
            currentUser,
            appliedAt,
            recordType: EntityType.NOTE,
            recordId: note.id,
            details: {
              title,
              externalEmailMessageId: suggestion.externalEmailMessageId,
              externalMessageId: email?.externalMessageId ?? null,
              externalThreadId: email?.externalThreadId ?? null,
              emailSentAutomatically: false,
            },
          }),
        },
        include: this.getSuggestionInclude(),
      });

      await tx.activityEvent.create({
        data: this.activityEventsService.buildCreateData(currentUser, {
          type: ActivityEventType.AI_SUGGESTION_APPLIED,
          entityType: EntityType.NOTE,
          entityId: note.id,
          title: 'AI suggestion applied: external email note created',
          description:
            'A human created a CRM note from an accepted external email AI suggestion. No email was sent automatically.',
          source: Source.AI_SUGGESTION,
          companyId: note.companyId ?? undefined,
          contactId: note.contactId ?? undefined,
          leadId: note.leadId ?? undefined,
          noteId: note.id,
          occurredAt: appliedAt,
          metadataJson: {
            aiSuggestionId: suggestion.id,
            aiSuggestionType: suggestion.type,
            appliedAction: 'CREATE_NOTE_FROM_EXTERNAL_EMAIL',
            externalEmailMessageId: suggestion.externalEmailMessageId,
            externalMessageId: email?.externalMessageId ?? null,
            externalThreadId: email?.externalThreadId ?? null,
            noteId: note.id,
            appliedToCrm: true,
            canApplyAutomatically: false,
            canSendEmailAutomatically: false,
            emailSentAutomatically: false,
          },
        }),
      });

      return {
        suggestion: updatedSuggestion,
        note,
      };
    });
  }

  async createTaskFromExternalEmailSuggestion(
    id: string,
    currentUser: CurrentUser,
    dto: ApplySuggestedTaskDto,
  ) {
    const suggestion = await this.prisma.aiSuggestion.findFirst({
      where: {
        id,
        organizationId: currentUser.organizationId,
      },
      include: this.getSuggestionInclude(),
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

    if (suggestion.type !== AiSuggestionType.ANALYZE_EXTERNAL_EMAIL) {
      throw new ConflictException('Unsupported AI suggestion type');
    }

    if (!suggestion.externalEmailMessageId) {
      throw new ConflictException(
        'AI suggestion is not linked to an external email message',
      );
    }

    if (
      this.hasAppliedAction(
        suggestion.metadataJson,
        'CREATE_TASK_FROM_EXTERNAL_EMAIL',
      )
    ) {
      throw new ConflictException('External email task was already created');
    }

    const output = this.parseExternalEmailAnalysisOutput(suggestion.outputJson);
    const email = suggestion.externalEmailMessage;
    const suggestedTask = output.suggestedTasks?.[dto.taskIndex ?? 0];
    const title =
      dto.title?.trim() ||
      suggestedTask?.title?.trim() ||
      `Review email: ${email?.subject?.trim() || 'Synced email'}`;
    const description = this.buildExternalEmailTaskDescription({
      taskBody:
        dto.description?.trim() ||
        suggestedTask?.description?.trim() ||
        output.summary?.trim() ||
        output.suggestedNote?.trim() ||
        'Review this accepted external email AI suggestion and decide the next CRM action.',
      output,
      email,
      externalEmailMessageId: suggestion.externalEmailMessageId,
    });
    const dueDate = dto.dueDate
      ? new Date(dto.dueDate)
      : typeof suggestedTask?.dueInDays === 'number'
        ? this.buildDueDateFromDays(suggestedTask.dueInDays)
        : undefined;
    const priority = dto.priority ?? suggestedTask?.priority ?? Priority.MEDIUM;
    const appliedAt = new Date();

    return this.prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          organizationId: currentUser.organizationId,
          title,
          description,
          status: TaskStatus.TODO,
          priority,
          importanceLevel: ImportanceLevel.MEDIUM,
          dueDate,
          assignedToUserId: currentUser.id,
          contactId: suggestion.contactId,
          leadId: suggestion.leadId,
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
            action: 'CREATE_TASK_FROM_EXTERNAL_EMAIL',
            currentUser,
            appliedAt,
            recordType: EntityType.TASK,
            recordId: task.id,
            details: {
              title,
              priority,
              dueDate: dueDate?.toISOString() ?? null,
              externalEmailMessageId: suggestion.externalEmailMessageId,
              externalMessageId: email?.externalMessageId ?? null,
              externalThreadId: email?.externalThreadId ?? null,
              emailSentAutomatically: false,
            },
          }),
        },
        include: this.getSuggestionInclude(),
      });

      await tx.activityEvent.create({
        data: this.activityEventsService.buildCreateData(currentUser, {
          type: ActivityEventType.AI_SUGGESTION_APPLIED,
          entityType: EntityType.TASK,
          entityId: task.id,
          title: 'AI suggestion applied: external email task created',
          description:
            'A human created a CRM task from an accepted external email AI suggestion. No email was sent automatically.',
          source: Source.AI_SUGGESTION,
          contactId: task.contactId ?? undefined,
          leadId: task.leadId ?? undefined,
          taskId: task.id,
          occurredAt: appliedAt,
          metadataJson: {
            aiSuggestionId: suggestion.id,
            aiSuggestionType: suggestion.type,
            appliedAction: 'CREATE_TASK_FROM_EXTERNAL_EMAIL',
            externalEmailMessageId: suggestion.externalEmailMessageId,
            externalMessageId: email?.externalMessageId ?? null,
            externalThreadId: email?.externalThreadId ?? null,
            taskId: task.id,
            appliedToCrm: true,
            canApplyAutomatically: false,
            canSendEmailAutomatically: false,
            emailSentAutomatically: false,
          },
        }),
      });

      return {
        suggestion: updatedSuggestion,
        task,
      };
    });
  }

  async createLeadFromExternalEmailSuggestion(
    id: string,
    currentUser: CurrentUser,
  ) {
    const suggestion = await this.prisma.aiSuggestion.findFirst({
      where: {
        id,
        organizationId: currentUser.organizationId,
      },
      include: this.getSuggestionInclude(),
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

    if (suggestion.type !== AiSuggestionType.ANALYZE_EXTERNAL_EMAIL) {
      throw new ConflictException('Unsupported AI suggestion type');
    }

    if (!suggestion.externalEmailMessageId) {
      throw new ConflictException(
        'AI suggestion is not linked to an external email message',
      );
    }

    if (
      this.hasAppliedAction(
        suggestion.metadataJson,
        'CREATE_LEAD_FROM_EXTERNAL_EMAIL',
      )
    ) {
      throw new ConflictException('External email lead was already created');
    }

    const output = this.parseExternalEmailAnalysisOutput(suggestion.outputJson);
    const email = suggestion.externalEmailMessage;
    const title = `Email lead: ${email?.subject?.trim() || 'Synced email'}`;
    const importanceLevel = this.normalizeImportanceLevel(output.importanceLevel);
    const priority = this.mapImportanceToPriority(importanceLevel);
    const appliedAt = new Date();
    const description = this.buildExternalEmailLeadDescription({
      output,
      email,
      externalEmailMessageId: suggestion.externalEmailMessageId,
    });

    return this.prisma.$transaction(async (tx) => {
      const pipelinePosition = await this.getNextLeadPipelinePosition(
        tx,
        currentUser.organizationId,
        LeadStatus.NEW,
      );

      const lead = await tx.lead.create({
        data: {
          organizationId: currentUser.organizationId,
          title,
          description,
          companyId: suggestion.companyId,
          contactId: suggestion.contactId,
          assignedToUserId: currentUser.id,
          status: LeadStatus.NEW,
          priority,
          importanceLevel,
          source: Source.AI_SUGGESTION,
          pipelinePosition,
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
            action: 'CREATE_LEAD_FROM_EXTERNAL_EMAIL',
            currentUser,
            appliedAt,
            recordType: EntityType.LEAD,
            recordId: lead.id,
            details: {
              title,
              priority,
              importanceLevel,
              externalEmailMessageId: suggestion.externalEmailMessageId,
              externalMessageId: email?.externalMessageId ?? null,
              externalThreadId: email?.externalThreadId ?? null,
              emailSentAutomatically: false,
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
          title: 'AI suggestion applied: external email lead created',
          description:
            'A human created a CRM lead from an accepted external email AI suggestion. No email was sent automatically.',
          source: Source.AI_SUGGESTION,
          companyId: lead.companyId ?? undefined,
          contactId: lead.contactId ?? undefined,
          leadId: lead.id,
          occurredAt: appliedAt,
          metadataJson: {
            aiSuggestionId: suggestion.id,
            aiSuggestionType: suggestion.type,
            appliedAction: 'CREATE_LEAD_FROM_EXTERNAL_EMAIL',
            externalEmailMessageId: suggestion.externalEmailMessageId,
            externalMessageId: email?.externalMessageId ?? null,
            externalThreadId: email?.externalThreadId ?? null,
            leadId: lead.id,
            appliedToCrm: true,
            canApplyAutomatically: false,
            canSendEmailAutomatically: false,
            emailSentAutomatically: false,
          },
        }),
      });

      return {
        suggestion: updatedSuggestion,
        lead,
      };
    });
  }

  async createTaskFromExternalCalendarSuggestion(
    id: string,
    currentUser: CurrentUser,
  ) {
    const suggestion = await this.prisma.aiSuggestion.findFirst({
      where: {
        id,
        organizationId: currentUser.organizationId,
      },
      include: this.getSuggestionInclude(),
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

    if (suggestion.type !== AiSuggestionType.ANALYZE_EXTERNAL_CALENDAR_EVENT) {
      throw new ConflictException('Unsupported AI suggestion type');
    }

    if (!suggestion.externalCalendarEventId) {
      throw new ConflictException(
        'AI suggestion is not linked to an external calendar event',
      );
    }

    if (
      this.hasAppliedAction(
        suggestion.metadataJson,
        'CREATE_TASK_FROM_EXTERNAL_CALENDAR_EVENT',
      ) ||
      this.hasAppliedAction(
        suggestion.metadataJson,
        'CREATE_TASK_FROM_EXTERNAL_CALENDAR',
      )
    ) {
      throw new ConflictException('External calendar task was already created');
    }

    const output = this.parseExternalCalendarEventAnalysisOutput(
      suggestion.outputJson,
    );
    const calendarEvent = suggestion.externalCalendarEvent;
    const suggestedTask = output.suggestedTasks?.[0];
    const importanceLevel = this.normalizeImportanceLevel(output.importanceLevel);
    const priority = this.normalizePriority(
      suggestedTask?.priority,
      this.mapImportanceToPriority(importanceLevel),
    );
    const title =
      suggestedTask?.title?.trim() ||
      `Follow up calendar event: ${calendarEvent?.summary?.trim() || 'Synced event'}`;
    const dueDate =
      typeof suggestedTask?.dueInDays === 'number' &&
      suggestedTask.dueInDays >= 0
        ? this.buildDueDateFromDays(suggestedTask.dueInDays)
        : this.buildDueDateFromCalendarEvent(calendarEvent);
    const appliedAt = new Date();
    const description = this.buildExternalCalendarTaskDescription({
      taskBody:
        suggestedTask?.description?.trim() ||
        output.summary?.trim() ||
        output.suggestedNote?.trim() ||
        'Review this accepted external calendar AI suggestion and decide the next CRM action.',
      output,
      calendarEvent,
      externalCalendarEventId: suggestion.externalCalendarEventId,
    });

    return this.prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          organizationId: currentUser.organizationId,
          title,
          description,
          status: TaskStatus.TODO,
          priority,
          importanceLevel,
          dueDate,
          assignedToUserId: currentUser.id,
          contactId: suggestion.contactId,
          leadId: suggestion.leadId,
          boardPosition: 0,
          statusChangedAt: appliedAt,
        },
      });

      const updatedSuggestion = await tx.aiSuggestion.update({
        where: {
          id: suggestion.id,
        },
        data: {
          metadataJson: {
            ...(this.buildAppliedMetadata({
              metadataJson: suggestion.metadataJson,
              action: 'CREATE_TASK_FROM_EXTERNAL_CALENDAR_EVENT',
              currentUser,
              appliedAt,
              recordType: EntityType.TASK,
              recordId: task.id,
              details: {
                taskId: task.id,
                title,
                priority,
                dueDate: dueDate?.toISOString() ?? null,
                externalCalendarEventId: suggestion.externalCalendarEventId,
                externalEventId: calendarEvent?.externalEventId ?? null,
                externalCalendarId: calendarEvent?.externalCalendarId ?? null,
                crmRecordsCreated: true,
                emailSentAutomatically: false,
                taskCreatedAutomatically: false,
              },
            }) as Record<string, unknown>),
            appliedAt: appliedAt.toISOString(),
            appliedByUserId: currentUser.id,
            crmRecordsCreated: true,
            emailSentAutomatically: false,
            taskCreatedAutomatically: false,
          },
        },
        include: this.getSuggestionInclude(),
      });

      await tx.activityEvent.create({
        data: this.activityEventsService.buildCreateData(currentUser, {
          type: ActivityEventType.AI_SUGGESTION_APPLIED,
          entityType: EntityType.TASK,
          entityId: task.id,
          title: 'AI suggestion applied: external calendar task created',
          description:
            'A human created a CRM task from an accepted external calendar AI suggestion. No email was sent automatically.',
          source: Source.AI_SUGGESTION,
          companyId: suggestion.companyId ?? undefined,
          contactId: task.contactId ?? undefined,
          leadId: task.leadId ?? undefined,
          taskId: task.id,
          occurredAt: appliedAt,
          metadataJson: {
            aiSuggestionId: suggestion.id,
            aiSuggestionType: suggestion.type,
            appliedAction: 'CREATE_TASK_FROM_EXTERNAL_CALENDAR_EVENT',
            externalCalendarEventId: suggestion.externalCalendarEventId,
            externalEventId: calendarEvent?.externalEventId ?? null,
            externalCalendarId: calendarEvent?.externalCalendarId ?? null,
            taskId: task.id,
            appliedToCrm: true,
            crmRecordsCreated: true,
            canApplyAutomatically: false,
            canSendEmailAutomatically: false,
            emailSentAutomatically: false,
            taskCreatedAutomatically: false,
          },
        }),
      });

      return {
        suggestion: updatedSuggestion,
        task,
      };
    });
  }

  async createNoteFromExternalCalendarSuggestion(
    id: string,
    currentUser: CurrentUser,
  ) {
    const suggestion = await this.prisma.aiSuggestion.findFirst({
      where: {
        id,
        organizationId: currentUser.organizationId,
      },
      include: this.getSuggestionInclude(),
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

    if (suggestion.type !== AiSuggestionType.ANALYZE_EXTERNAL_CALENDAR_EVENT) {
      throw new ConflictException('Unsupported AI suggestion type');
    }

    if (!suggestion.externalCalendarEventId) {
      throw new ConflictException(
        'AI suggestion is not linked to an external calendar event',
      );
    }

    if (
      this.hasAppliedAction(
        suggestion.metadataJson,
        'CREATE_NOTE_FROM_EXTERNAL_CALENDAR',
      )
    ) {
      throw new ConflictException('External calendar note was already created');
    }

    const output = this.parseExternalCalendarEventAnalysisOutput(
      suggestion.outputJson,
    );
    const calendarEvent = suggestion.externalCalendarEvent;
    const title = `AI calendar review note: ${
      calendarEvent?.summary?.trim() || 'Synced event'
    }`;
    const content = this.buildExternalCalendarNoteContent({
      noteBody:
        output.suggestedNote?.trim() ||
        output.summary?.trim() ||
        'Review this accepted external calendar AI suggestion and decide the next CRM action.',
      output,
      calendarEvent,
      externalCalendarEventId: suggestion.externalCalendarEventId,
    });
    const importanceLevel = this.normalizeImportanceLevel(output.importanceLevel);
    const appliedAt = new Date();

    return this.prisma.$transaction(async (tx) => {
      const note = await tx.note.create({
        data: {
          organizationId: currentUser.organizationId,
          title,
          content,
          source: Source.AI_SUGGESTION,
          importanceLevel,
          createdByUserId: currentUser.id,
          companyId: suggestion.companyId,
          contactId: suggestion.contactId,
          leadId: suggestion.leadId,
        },
      });

      const updatedSuggestion = await tx.aiSuggestion.update({
        where: {
          id: suggestion.id,
        },
        data: {
          metadataJson: this.buildAppliedMetadata({
            metadataJson: suggestion.metadataJson,
            action: 'CREATE_NOTE_FROM_EXTERNAL_CALENDAR',
            currentUser,
            appliedAt,
            recordType: EntityType.NOTE,
            recordId: note.id,
            details: {
              title,
              importanceLevel,
              externalCalendarEventId: suggestion.externalCalendarEventId,
              externalEventId: calendarEvent?.externalEventId ?? null,
              externalCalendarId: calendarEvent?.externalCalendarId ?? null,
              emailSentAutomatically: false,
            },
          }),
        },
        include: this.getSuggestionInclude(),
      });

      await tx.activityEvent.create({
        data: this.activityEventsService.buildCreateData(currentUser, {
          type: ActivityEventType.AI_SUGGESTION_APPLIED,
          entityType: EntityType.NOTE,
          entityId: note.id,
          title: 'AI suggestion applied: external calendar note created',
          description:
            'A human created a CRM note from an accepted external calendar AI suggestion. No email was sent automatically.',
          source: Source.AI_SUGGESTION,
          companyId: note.companyId ?? undefined,
          contactId: note.contactId ?? undefined,
          leadId: note.leadId ?? undefined,
          noteId: note.id,
          occurredAt: appliedAt,
          metadataJson: {
            aiSuggestionId: suggestion.id,
            aiSuggestionType: suggestion.type,
            appliedAction: 'CREATE_NOTE_FROM_EXTERNAL_CALENDAR',
            externalCalendarEventId: suggestion.externalCalendarEventId,
            externalEventId: calendarEvent?.externalEventId ?? null,
            externalCalendarId: calendarEvent?.externalCalendarId ?? null,
            noteId: note.id,
            appliedToCrm: true,
            canApplyAutomatically: false,
            canSendEmailAutomatically: false,
            emailSentAutomatically: false,
          },
        }),
      });

      return {
        suggestion: updatedSuggestion,
        note,
      };
    });
  }

  async createLeadFromExternalCalendarSuggestion(
    id: string,
    currentUser: CurrentUser,
  ) {
    const suggestion = await this.prisma.aiSuggestion.findFirst({
      where: {
        id,
        organizationId: currentUser.organizationId,
      },
      include: this.getSuggestionInclude(),
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

    if (suggestion.type !== AiSuggestionType.ANALYZE_EXTERNAL_CALENDAR_EVENT) {
      throw new ConflictException('Unsupported AI suggestion type');
    }

    if (!suggestion.externalCalendarEventId) {
      throw new ConflictException(
        'AI suggestion is not linked to an external calendar event',
      );
    }

    if (
      this.hasAppliedAction(
        suggestion.metadataJson,
        'CREATE_LEAD_FROM_EXTERNAL_CALENDAR',
      )
    ) {
      throw new ConflictException('External calendar lead was already created');
    }

    const output = this.parseExternalCalendarEventAnalysisOutput(
      suggestion.outputJson,
    );
    const calendarEvent = suggestion.externalCalendarEvent;
    const title = `Calendar lead: ${
      calendarEvent?.summary?.trim() || 'Synced event'
    }`;
    const importanceLevel = this.normalizeImportanceLevel(output.importanceLevel);
    const priority = this.mapImportanceToPriority(importanceLevel);
    const description = this.buildExternalCalendarLeadDescription({
      output,
      calendarEvent,
      externalCalendarEventId: suggestion.externalCalendarEventId,
    });
    const appliedAt = new Date();

    return this.prisma.$transaction(async (tx) => {
      const pipelinePosition = await this.getNextLeadPipelinePosition(
        tx,
        currentUser.organizationId,
        LeadStatus.NEW,
      );

      const lead = await tx.lead.create({
        data: {
          organizationId: currentUser.organizationId,
          title,
          description,
          companyId: suggestion.companyId,
          contactId: suggestion.contactId,
          assignedToUserId: currentUser.id,
          status: LeadStatus.NEW,
          priority,
          importanceLevel,
          source: Source.AI_SUGGESTION,
          pipelinePosition,
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
            action: 'CREATE_LEAD_FROM_EXTERNAL_CALENDAR',
            currentUser,
            appliedAt,
            recordType: EntityType.LEAD,
            recordId: lead.id,
            details: {
              title,
              priority,
              importanceLevel,
              externalCalendarEventId: suggestion.externalCalendarEventId,
              externalEventId: calendarEvent?.externalEventId ?? null,
              externalCalendarId: calendarEvent?.externalCalendarId ?? null,
              emailSentAutomatically: false,
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
          title: 'AI suggestion applied: external calendar lead created',
          description:
            'A human created a CRM lead from an accepted external calendar AI suggestion. No email was sent automatically.',
          source: Source.AI_SUGGESTION,
          companyId: lead.companyId ?? undefined,
          contactId: lead.contactId ?? undefined,
          leadId: lead.id,
          occurredAt: appliedAt,
          metadataJson: {
            aiSuggestionId: suggestion.id,
            aiSuggestionType: suggestion.type,
            appliedAction: 'CREATE_LEAD_FROM_EXTERNAL_CALENDAR',
            externalCalendarEventId: suggestion.externalCalendarEventId,
            externalEventId: calendarEvent?.externalEventId ?? null,
            externalCalendarId: calendarEvent?.externalCalendarId ?? null,
            leadId: lead.id,
            appliedToCrm: true,
            canApplyAutomatically: false,
            canSendEmailAutomatically: false,
            emailSentAutomatically: false,
          },
        }),
      });

      return {
        suggestion: updatedSuggestion,
        lead,
      };
    });
  }

  private async generateWithFailureUsage<TGenerated>(
    currentUser: CurrentUser,
    input: {
      feature: AiUsageFeature;
      inputText: string;
      estimatedCreditsRequired: number;
      metadataJson: Prisma.InputJsonValue;
    },
    generate: () => Promise<TGenerated>,
  ) {
    try {
      return await generate();
    } catch (error) {
      const failure = this.toSafeAiProviderFailure(error);

      await this.aiUsageService.recordFailedUsage(currentUser, {
        feature: input.feature,
        provider: this.getConfiguredAiProvider(),
        model: this.getConfiguredAiModel(),
        tokensInput: Math.ceil(input.inputText.length / 4),
        tokensOutput: 0,
        estimatedCostUsd: 0,
        errorCode: failure.errorCode,
        errorMessage: failure.errorMessage,
        metadataJson: this.buildAiFailureMetadata({
          metadataJson: input.metadataJson,
          estimatedCreditsRequired: input.estimatedCreditsRequired,
          errorCode: failure.errorCode,
        }),
      });

      throw new HttpException(failure.errorMessage, failure.statusCode);
    }
  }

  private toSafeAiProviderFailure(error: unknown) {
    if (error instanceof AiProviderError) {
      return {
        errorCode: error.errorCode,
        errorMessage: error.message,
        statusCode: error.statusCode,
      };
    }

    return {
      errorCode: 'AI_PROVIDER_GENERATION_FAILED',
      errorMessage: 'AI generation failed. Please try again later.',
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
    };
  }

  private buildAiFailureMetadata({
    metadataJson,
    estimatedCreditsRequired,
    errorCode,
  }: {
    metadataJson: Prisma.InputJsonValue;
    estimatedCreditsRequired: number;
    errorCode: string;
  }): Prisma.InputJsonValue {
    const metadata =
      metadataJson &&
      typeof metadataJson === 'object' &&
      !Array.isArray(metadataJson)
        ? (metadataJson as Record<string, unknown>)
        : {};

    return {
      ...metadata,
      estimatedCreditsRequired,
      providerFailure: true,
      errorCode,
      suggestionCreated: false,
      crmRecordsCreated: false,
      emailSentAutomatically: false,
    };
  }

  private getConfiguredAiProvider() {
    return process.env.AI_PROVIDER || 'mock';
  }

  private getConfiguredAiModel() {
    return process.env.OPENAI_MODEL || 'gpt-5.5';
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

  private parseExternalEmailAnalysisOutput(
    outputJson: Prisma.JsonValue | null,
  ): ExternalEmailAnalysisApplyOutput {
    if (!outputJson || typeof outputJson !== 'object' || Array.isArray(outputJson)) {
      throw new ConflictException('AI suggestion output is not structured');
    }

    return outputJson as ExternalEmailAnalysisApplyOutput;
  }

  private parseExternalCalendarEventAnalysisOutput(
    outputJson: Prisma.JsonValue | null,
  ): ExternalCalendarEventAnalysisApplyOutput {
    if (!outputJson || typeof outputJson !== 'object' || Array.isArray(outputJson)) {
      throw new ConflictException('AI suggestion output is not structured');
    }

    return outputJson as ExternalCalendarEventAnalysisApplyOutput;
  }

  private buildExternalEmailNoteContent({
    noteBody,
    output,
    email,
    externalEmailMessageId,
  }: {
    noteBody: string;
    output: ExternalEmailAnalysisApplyOutput;
    email?: {
      subject: string | null;
      snippet: string | null;
      fromEmail: string | null;
      fromName: string | null;
      externalMessageId: string;
      externalThreadId: string | null;
      internalDate: Date | null;
      syncedAt: Date;
    } | null;
    externalEmailMessageId: string;
  }) {
    return [
      noteBody,
      '',
      'Synced email context:',
      `Subject: ${email?.subject ?? '(no subject)'}`,
      `From: ${email?.fromName || email?.fromEmail || '(unknown sender)'}`,
      `From email: ${email?.fromEmail ?? '(unknown)'}`,
      `Snippet: ${email?.snippet ?? '(no snippet)'}`,
      `Internal date: ${email?.internalDate?.toISOString() ?? '(unknown)'}`,
      `Synced at: ${email?.syncedAt?.toISOString() ?? '(unknown)'}`,
      `External email message id: ${externalEmailMessageId}`,
      `External provider message id: ${email?.externalMessageId ?? '(unknown)'}`,
      `External thread id: ${email?.externalThreadId ?? 'none'}`,
      '',
      'AI review context:',
      output.summary ? `Summary: ${output.summary}` : null,
      output.reasoningSummary ? `Reasoning: ${output.reasoningSummary}` : null,
      '',
      'Safety: This note was created by explicit human action from an accepted AI suggestion. No email was sent automatically.',
    ]
      .filter((line): line is string => line !== null)
      .join('\n');
  }

  private buildExternalEmailTaskDescription({
    taskBody,
    output,
    email,
    externalEmailMessageId,
  }: {
    taskBody: string;
    output: ExternalEmailAnalysisApplyOutput;
    email?: {
      subject: string | null;
      snippet: string | null;
      fromEmail: string | null;
      fromName: string | null;
      externalMessageId: string;
      externalThreadId: string | null;
      internalDate: Date | null;
      syncedAt: Date;
    } | null;
    externalEmailMessageId: string;
  }) {
    return [
      taskBody,
      '',
      'Synced email metadata:',
      `Subject: ${email?.subject ?? '(no subject)'}`,
      `From: ${email?.fromName || email?.fromEmail || '(unknown sender)'}`,
      `From email: ${email?.fromEmail ?? '(unknown)'}`,
      `Snippet: ${email?.snippet ?? '(no snippet)'}`,
      `Internal date: ${email?.internalDate?.toISOString() ?? '(unknown)'}`,
      `Synced at: ${email?.syncedAt?.toISOString() ?? '(unknown)'}`,
      `External email message id: ${externalEmailMessageId}`,
      `External provider message id: ${email?.externalMessageId ?? '(unknown)'}`,
      `External thread id: ${email?.externalThreadId ?? 'none'}`,
      '',
      'AI review context:',
      output.summary ? `Summary: ${output.summary}` : null,
      output.reasoningSummary ? `Reasoning: ${output.reasoningSummary}` : null,
      '',
      'Human approval: This task was created by explicit human action from an accepted AI suggestion. No email was sent automatically.',
    ]
      .filter((line): line is string => line !== null)
      .join('\n');
  }

  private buildExternalEmailLeadDescription({
    output,
    email,
    externalEmailMessageId,
  }: {
    output: ExternalEmailAnalysisApplyOutput;
    email?: {
      subject: string | null;
      snippet: string | null;
      fromEmail: string | null;
      fromName: string | null;
      externalMessageId: string;
      externalThreadId: string | null;
      internalDate: Date | null;
      syncedAt: Date;
    } | null;
    externalEmailMessageId: string;
  }) {
    return [
      'Lead created from an accepted external email AI suggestion.',
      '',
      'Synced email metadata:',
      `Subject: ${email?.subject ?? '(no subject)'}`,
      `From: ${email?.fromName || email?.fromEmail || '(unknown sender)'}`,
      `From email: ${email?.fromEmail ?? '(unknown)'}`,
      `Snippet: ${email?.snippet ?? '(no snippet)'}`,
      `Internal date: ${email?.internalDate?.toISOString() ?? '(unknown)'}`,
      `Synced at: ${email?.syncedAt?.toISOString() ?? '(unknown)'}`,
      `External email message id: ${externalEmailMessageId}`,
      `External provider message id: ${email?.externalMessageId ?? '(unknown)'}`,
      `External thread id: ${email?.externalThreadId ?? 'none'}`,
      '',
      'AI review context:',
      output.summary ? `Summary: ${output.summary}` : null,
      output.reasoningSummary ? `Reasoning: ${output.reasoningSummary}` : null,
      '',
      'Human approval: This lead was created by explicit human action from an accepted AI suggestion. No company or contact was created automatically. No email was sent automatically.',
    ]
      .filter((line): line is string => line !== null)
      .join('\n');
  }

  private buildExternalCalendarTaskDescription({
    taskBody,
    output,
    calendarEvent,
    externalCalendarEventId,
  }: {
    taskBody: string;
    output: ExternalCalendarEventAnalysisApplyOutput;
    calendarEvent?: {
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
      htmlLink: string | null;
      syncedAt: Date;
    } | null;
    externalCalendarEventId: string;
  }) {
    return [
      taskBody,
      '',
      'Synced calendar metadata:',
      `Summary: ${calendarEvent?.summary ?? '(no title)'}`,
      `Status: ${calendarEvent?.status ?? '(unknown)'}`,
      `Location: ${calendarEvent?.location ?? '(none)'}`,
      `Description: ${calendarEvent?.description ?? '(none)'}`,
      `Start: ${calendarEvent?.startAt?.toISOString() ?? '(unknown)'}`,
      `End: ${calendarEvent?.endAt?.toISOString() ?? '(unknown)'}`,
      `All day: ${calendarEvent?.isAllDay ? 'yes' : 'no'}`,
      `Organizer: ${
        calendarEvent?.organizerName ||
        calendarEvent?.organizerEmail ||
        '(unknown)'
      }`,
      `Organizer email: ${calendarEvent?.organizerEmail ?? '(unknown)'}`,
      `Calendar link: ${calendarEvent?.htmlLink ?? '(none)'}`,
      `Synced at: ${calendarEvent?.syncedAt?.toISOString() ?? '(unknown)'}`,
      `External calendar event id: ${externalCalendarEventId}`,
      `External provider event id: ${calendarEvent?.externalEventId ?? '(unknown)'}`,
      `External calendar id: ${calendarEvent?.externalCalendarId ?? '(unknown)'}`,
      `iCal UID: ${calendarEvent?.iCalUid ?? '(none)'}`,
      '',
      'AI review context:',
      output.summary ? `Summary: ${output.summary}` : null,
      output.suggestedNote ? `Suggested note: ${output.suggestedNote}` : null,
      output.reasoningSummary ? `Reasoning: ${output.reasoningSummary}` : null,
      '',
      'Human approval: This task was created by explicit human action from an accepted AI suggestion. No company, contact, or lead was created automatically. No email was sent automatically.',
    ]
      .filter((line): line is string => line !== null)
      .join('\n');
  }

  private buildExternalCalendarNoteContent({
    noteBody,
    output,
    calendarEvent,
    externalCalendarEventId,
  }: {
    noteBody: string;
    output: ExternalCalendarEventAnalysisApplyOutput;
    calendarEvent?: {
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
      htmlLink: string | null;
      syncedAt: Date;
    } | null;
    externalCalendarEventId: string;
  }) {
    return [
      noteBody,
      '',
      'Synced calendar metadata:',
      `Summary: ${calendarEvent?.summary ?? '(no title)'}`,
      `Status: ${calendarEvent?.status ?? '(unknown)'}`,
      `Location: ${calendarEvent?.location ?? '(none)'}`,
      `Description: ${calendarEvent?.description ?? '(none)'}`,
      `Start: ${calendarEvent?.startAt?.toISOString() ?? '(unknown)'}`,
      `End: ${calendarEvent?.endAt?.toISOString() ?? '(unknown)'}`,
      `All day: ${calendarEvent?.isAllDay ? 'yes' : 'no'}`,
      `Organizer: ${
        calendarEvent?.organizerName ||
        calendarEvent?.organizerEmail ||
        '(unknown)'
      }`,
      `Organizer email: ${calendarEvent?.organizerEmail ?? '(unknown)'}`,
      `Synced at: ${calendarEvent?.syncedAt?.toISOString() ?? '(unknown)'}`,
      `External calendar event id: ${externalCalendarEventId}`,
      `External provider event id: ${calendarEvent?.externalEventId ?? '(unknown)'}`,
      `External calendar id: ${calendarEvent?.externalCalendarId ?? '(unknown)'}`,
      `iCal UID: ${calendarEvent?.iCalUid ?? '(none)'}`,
      '',
      'AI review context:',
      output.summary ? `Summary: ${output.summary}` : null,
      output.reasoningSummary ? `Reasoning: ${output.reasoningSummary}` : null,
      '',
      'Human approval: This note was created by explicit human action from an accepted AI suggestion. No company, contact, lead, task, or email was created automatically. No email was sent automatically.',
    ]
      .filter((line): line is string => line !== null)
      .join('\n');
  }

  private buildExternalCalendarLeadDescription({
    output,
    calendarEvent,
    externalCalendarEventId,
  }: {
    output: ExternalCalendarEventAnalysisApplyOutput;
    calendarEvent?: {
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
      htmlLink: string | null;
      syncedAt: Date;
    } | null;
    externalCalendarEventId: string;
  }) {
    return [
      'Lead created from an accepted external calendar AI suggestion.',
      '',
      'Synced calendar metadata:',
      `Summary: ${calendarEvent?.summary ?? '(no title)'}`,
      `Status: ${calendarEvent?.status ?? '(unknown)'}`,
      `Location: ${calendarEvent?.location ?? '(none)'}`,
      `Description: ${calendarEvent?.description ?? '(none)'}`,
      `Start: ${calendarEvent?.startAt?.toISOString() ?? '(unknown)'}`,
      `End: ${calendarEvent?.endAt?.toISOString() ?? '(unknown)'}`,
      `All day: ${calendarEvent?.isAllDay ? 'yes' : 'no'}`,
      `Organizer: ${
        calendarEvent?.organizerName ||
        calendarEvent?.organizerEmail ||
        '(unknown)'
      }`,
      `Organizer email: ${calendarEvent?.organizerEmail ?? '(unknown)'}`,
      `Synced at: ${calendarEvent?.syncedAt?.toISOString() ?? '(unknown)'}`,
      `External calendar event id: ${externalCalendarEventId}`,
      `External provider event id: ${calendarEvent?.externalEventId ?? '(unknown)'}`,
      `External calendar id: ${calendarEvent?.externalCalendarId ?? '(unknown)'}`,
      `iCal UID: ${calendarEvent?.iCalUid ?? '(none)'}`,
      '',
      'AI review context:',
      output.summary ? `Summary: ${output.summary}` : null,
      output.reasoningSummary ? `Reasoning: ${output.reasoningSummary}` : null,
      '',
      'Human approval: This lead was created by explicit human action from an accepted AI suggestion. No company or contact was created automatically. No email was sent automatically.',
    ]
      .filter((line): line is string => line !== null)
      .join('\n');
  }

  private normalizeImportanceLevel(importanceLevel?: ImportanceLevel) {
    switch (importanceLevel) {
      case ImportanceLevel.LOW:
        return ImportanceLevel.LOW;
      case ImportanceLevel.HIGH:
        return ImportanceLevel.HIGH;
      case ImportanceLevel.CRITICAL:
        return ImportanceLevel.CRITICAL;
      case ImportanceLevel.MEDIUM:
      default:
        return ImportanceLevel.MEDIUM;
    }
  }

  private normalizePriority(priority: Priority | undefined, fallback: Priority) {
    switch (priority) {
      case Priority.LOW:
        return Priority.LOW;
      case Priority.HIGH:
        return Priority.HIGH;
      case Priority.CRITICAL:
        return Priority.CRITICAL;
      case Priority.MEDIUM:
        return Priority.MEDIUM;
      default:
        return fallback;
    }
  }

  private mapImportanceToPriority(importanceLevel: ImportanceLevel) {
    switch (importanceLevel) {
      case ImportanceLevel.LOW:
        return Priority.LOW;
      case ImportanceLevel.HIGH:
        return Priority.HIGH;
      case ImportanceLevel.CRITICAL:
        return Priority.CRITICAL;
      case ImportanceLevel.MEDIUM:
      default:
        return Priority.MEDIUM;
    }
  }

  private async getNextLeadPipelinePosition(
    tx: Prisma.TransactionClient,
    organizationId: string,
    status: LeadStatus,
  ) {
    const result = await tx.lead.aggregate({
      where: {
        organizationId,
        deletedAt: null,
        status,
      },
      _max: {
        pipelinePosition: true,
      },
    });

    return (result._max.pipelinePosition ?? 0) + 1000;
  }

  private buildDueDateFromCalendarEvent(
    calendarEvent?: {
      startAt: Date | null;
      endAt: Date | null;
    } | null,
  ) {
    const now = new Date();

    if (calendarEvent?.startAt && calendarEvent.startAt >= now) {
      return calendarEvent.startAt;
    }

    if (calendarEvent?.endAt && calendarEvent.endAt >= now) {
      return calendarEvent.endAt;
    }

    return undefined;
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

  private buildGmailDraftAppliedMetadata({
    metadataJson,
    currentUser,
    gmailDraftId,
    gmailThreadId,
    connectedAccountId,
    externalEmailMessageId,
    externalMessageId,
    externalThreadId,
    createdAt,
  }: {
    metadataJson: Prisma.JsonValue | null;
    currentUser: CurrentUser;
    gmailDraftId: string;
    gmailThreadId?: string | null;
    connectedAccountId: string;
    externalEmailMessageId: string;
    externalMessageId: string;
    externalThreadId: string | null;
    createdAt: Date;
  }): Prisma.InputJsonValue {
    const metadata = this.asMetadataObject(metadataJson);
    const appliedActions = Array.isArray(metadata.appliedActions)
      ? metadata.appliedActions
      : [];

    return {
      ...metadata,
      gmailDraftId,
      gmailThreadId: gmailThreadId ?? null,
      gmailDraftCreatedAt: createdAt.toISOString(),
      gmailDraftCreatedByUserId: currentUser.id,
      humanApprovalRequired: true,
      canApplyAutomatically: false,
      canSendEmailAutomatically: false,
      draftCreatedAutomatically: false,
      emailSentAutomatically: false,
      appliedActions: [
        ...appliedActions,
        {
          action: 'CREATE_GMAIL_DRAFT_FROM_EMAIL_REPLY_SUGGESTION',
          gmailDraftId,
          gmailThreadId: gmailThreadId ?? null,
          connectedAccountId,
          externalEmailMessageId,
          externalMessageId,
          externalThreadId,
          createdAt: createdAt.toISOString(),
          createdByUserId: currentUser.id,
          emailSentAutomatically: false,
          draftCreatedAutomatically: false,
          canSendEmailAutomatically: false,
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

  private getSuggestionMetadataString(
    value: Prisma.JsonValue | null,
    key: string,
  ) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    const candidate = (value as Record<string, unknown>)[key];

    return typeof candidate === 'string' && candidate.trim()
      ? candidate.trim()
      : null;
  }

  private hasGoogleScope(scopesJson: Prisma.JsonValue | null, scope: string) {
    if (!scopesJson || typeof scopesJson !== 'object') {
      return false;
    }

    const scopes = (scopesJson as Record<string, unknown>).scopes;

    return Array.isArray(scopes) && scopes.includes(scope);
  }

  private buildReplySubject(subject: string | null) {
    const trimmed = subject?.trim() || '(No subject)';

    return trimmed.toLowerCase().startsWith('re:')
      ? trimmed
      : `Re: ${trimmed}`;
  }

  private async getValidGoogleAccessToken(account: {
    id: string;
    encryptedAccessToken: string | null;
    encryptedRefreshToken: string | null;
    tokenExpiresAt: Date | null;
  }) {
    if (!account.encryptedAccessToken || !account.encryptedRefreshToken) {
      throw new BadRequestException(
        'Connected Google account does not have OAuth tokens',
      );
    }

    const expiresAt = account.tokenExpiresAt?.getTime() ?? 0;
    const hasUsableAccessToken = expiresAt > Date.now() + 60_000;

    if (hasUsableAccessToken) {
      return this.tokenEncryptionService.decrypt(account.encryptedAccessToken);
    }

    const refreshToken = this.tokenEncryptionService.decrypt(
      account.encryptedRefreshToken,
    );

    const refreshed = await this.refreshGoogleAccessToken(refreshToken);

    if (!refreshed.access_token) {
      throw new HttpException(
        'Google token refresh failed. Please reconnect Google and try again.',
        HttpStatus.BAD_GATEWAY,
      );
    }

    const encryptedAccessToken = this.tokenEncryptionService.encrypt(
      refreshed.access_token,
    );

    const tokenExpiresAt =
      typeof refreshed.expires_in === 'number'
        ? new Date(Date.now() + refreshed.expires_in * 1000)
        : null;

    await this.prisma.connectedAccount.update({
      where: { id: account.id },
      data: {
        encryptedAccessToken,
        tokenExpiresAt,
        tokenEncryptionVersion:
          this.tokenEncryptionService.getEncryptionVersion(),
        lastError: null,
      },
    });

    return refreshed.access_token;
  }

  private async refreshGoogleAccessToken(
    refreshToken: string,
  ): Promise<GoogleRefreshTokenResponse> {
    const clientId = this.configService.get<string>('app.googleOAuthClientId');
    const clientSecret = this.configService.get<string>(
      'app.googleOAuthClientSecret',
    );

    if (!clientId || !clientSecret) {
      throw new HttpException(
        'Google OAuth configuration is missing',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const body = new URLSearchParams();

    body.set('client_id', clientId);
    body.set('client_secret', clientSecret);
    body.set('refresh_token', refreshToken);
    body.set('grant_type', 'refresh_token');

    const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    const data = (await response.json()) as GoogleRefreshTokenResponse;

    if (!response.ok || data.error) {
      throw new HttpException(
        'Google token refresh failed. Please reconnect Google and try again.',
        response.status === 400 || response.status === 401
          ? HttpStatus.BAD_REQUEST
          : HttpStatus.BAD_GATEWAY,
      );
    }

    return data;
  }

  private async createGmailDraft(params: {
    accessToken: string;
    toEmail: string;
    toName: string | null;
    subject: string;
    body: string;
    threadId: string | null;
  }): Promise<GmailDraftCreateResponse> {
    const response = await fetch(GMAIL_DRAFTS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          raw: this.buildGmailRawMessage(params),
          ...(params.threadId ? { threadId: params.threadId } : {}),
        },
      }),
    });

    const data = (await response.json()) as GmailDraftCreateResponse;

    if (!response.ok || data.error) {
      if (response.status === 401 || response.status === 403) {
        throw new BadRequestException(
          'Connected Google account is not authorized to create Gmail drafts. Reconnect Google with Gmail draft permissions and try again.',
        );
      }

      throw new HttpException(
        'Gmail draft creation failed. Please try again later.',
        HttpStatus.BAD_GATEWAY,
      );
    }

    return data;
  }

  private buildGmailRawMessage(params: {
    toEmail: string;
    toName: string | null;
    subject: string;
    body: string;
    threadId: string | null;
  }) {
    const headers = [
      `To: ${this.formatEmailAddress(params.toEmail, params.toName)}`,
      `Subject: ${this.encodeMailHeader(params.subject)}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: 8bit',
      'MIME-Version: 1.0',
    ];

    const rawMessage = [...headers, '', params.body].join('\r\n');

    return Buffer.from(rawMessage, 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }

  private formatEmailAddress(email: string, name: string | null) {
    const safeEmail = this.stripMailHeaderUnsafeCharacters(email.trim());
    const safeName = this.stripMailHeaderUnsafeCharacters(name?.trim() ?? '');

    if (!safeName) {
      return safeEmail;
    }

    return `"${safeName.replace(/["\\]/g, '\\$&')}" <${safeEmail}>`;
  }

  private encodeMailHeader(value: string) {
    const safeValue = this.stripMailHeaderUnsafeCharacters(value.trim());

    if (/^[\x20-\x7E]*$/.test(safeValue)) {
      return safeValue;
    }

    return `=?UTF-8?B?${Buffer.from(safeValue, 'utf8').toString('base64')}?=`;
  }

  private stripMailHeaderUnsafeCharacters(value: string) {
    return value.replace(/[\r\n]/g, ' ').trim();
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

private getSuggestionInclude(): Prisma.AiSuggestionInclude {
  return {
    externalEmailMessage: {
      select: {
        id: true,
        provider: true,
        externalMessageId: true,
        externalThreadId: true,
        subject: true,
        snippet: true,
        fromEmail: true,
        fromName: true,
        toEmailsJson: true,
        ccEmailsJson: true,
        labelIdsJson: true,
        internalDate: true,
        syncedAt: true,
      },
    },
    externalCalendarEvent: {
      select: {
        id: true,
        provider: true,
        externalCalendarId: true,
        externalEventId: true,
        iCalUid: true,
        status: true,
        summary: true,
        description: true,
        location: true,
        startAt: true,
        endAt: true,
        isAllDay: true,
        organizerEmail: true,
        organizerName: true,
        attendeesJson: true,
        htmlLink: true,
        syncedAt: true,
      },
    },
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

  private buildExternalEmailMetadataInputText(emailMessage: {
    id: string;
    connectedAccountId: string;
    provider: string;
    externalMessageId: string;
    externalThreadId: string | null;
    subject: string | null;
    snippet: string | null;
    fromEmail: string | null;
    fromName: string | null;
    toEmailsJson: Prisma.JsonValue | null;
    ccEmailsJson: Prisma.JsonValue | null;
    bccEmailsJson: Prisma.JsonValue | null;
    labelIdsJson: Prisma.JsonValue | null;
    internalDate: Date | null;
    metadataJson: Prisma.JsonValue | null;
    syncedAt: Date;
  }) {
    return [
      'External email metadata AI review',
      `Email message id: ${emailMessage.id}`,
      `Connected account id: ${emailMessage.connectedAccountId}`,
      `Provider: ${emailMessage.provider}`,
      `External message id: ${emailMessage.externalMessageId}`,
      `External thread id: ${emailMessage.externalThreadId ?? 'none'}`,
      `Subject: ${emailMessage.subject ?? '(no subject)'}`,
      `Snippet: ${emailMessage.snippet ?? '(no snippet)'}`,
      `From email: ${emailMessage.fromEmail ?? '(unknown)'}`,
      `From name: ${emailMessage.fromName ?? '(unknown)'}`,
      `To: ${this.safeStringifyJson(emailMessage.toEmailsJson)}`,
      `Cc: ${this.safeStringifyJson(emailMessage.ccEmailsJson)}`,
      `Bcc: ${this.safeStringifyJson(emailMessage.bccEmailsJson)}`,
      `Labels: ${this.safeStringifyJson(emailMessage.labelIdsJson)}`,
      `Internal date: ${
        emailMessage.internalDate?.toISOString() ?? '(unknown)'
      }`,
      `Synced at: ${emailMessage.syncedAt.toISOString()}`,
      '',
      'Important safety constraints:',
      '- Email body is not stored.',
      '- Analyze metadata/snippet only.',
      '- Do not create CRM records automatically.',
      '- Do not send emails automatically.',
      '- Human review is required.',
    ].join('\n');
  }

  private buildExternalCalendarEventMetadataInputText(calendarEvent: {
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
    attendeesJson: Prisma.JsonValue | null;
    htmlLink: string | null;
    metadataJson: Prisma.JsonValue | null;
    syncedAt: Date;
  }) {
    return [
      'External calendar event metadata AI review',
      `Calendar event id: ${calendarEvent.id}`,
      `Connected account id: ${calendarEvent.connectedAccountId}`,
      `Provider: ${calendarEvent.provider}`,
      `External calendar id: ${calendarEvent.externalCalendarId}`,
      `External event id: ${calendarEvent.externalEventId}`,
      `iCal UID: ${calendarEvent.iCalUid ?? 'none'}`,
      `Status: ${calendarEvent.status ?? '(unknown)'}`,
      `Summary: ${calendarEvent.summary ?? '(no summary)'}`,
      `Description: ${calendarEvent.description ?? '(no description)'}`,
      `Location: ${calendarEvent.location ?? '(no location)'}`,
      `Start at: ${calendarEvent.startAt?.toISOString() ?? '(unknown)'}`,
      `End at: ${calendarEvent.endAt?.toISOString() ?? '(unknown)'}`,
      `All day: ${calendarEvent.isAllDay ? 'true' : 'false'}`,
      `Organizer email: ${calendarEvent.organizerEmail ?? '(unknown)'}`,
      `Organizer name: ${calendarEvent.organizerName ?? '(unknown)'}`,
      `Attendees: ${this.safeStringifyJson(calendarEvent.attendeesJson)}`,
      `HTML link available: ${calendarEvent.htmlLink ? 'true' : 'false'}`,
      `Synced at: ${calendarEvent.syncedAt.toISOString()}`,
      '',
      'Important safety constraints:',
      '- Analyze synced calendar metadata only.',
      '- Do not create CRM records automatically.',
      '- Do not create tasks automatically.',
      '- Do not create notes automatically.',
      '- Do not send emails automatically.',
      '- Human review is required.',
    ].join('\n');
  }  

  private safeStringifyJson(value: Prisma.JsonValue | null) {
    if (value === null || value === undefined) {
      return 'null';
    }

    try {
      return JSON.stringify(value);
    } catch {
      return '[unserializable-json]';
    }
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
