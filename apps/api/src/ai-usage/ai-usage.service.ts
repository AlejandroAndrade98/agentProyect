import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AiCreditTransactionType,
  AiUsageFeature,
  AiUsageStatus,
  Prisma,
  Role,
} from '@prisma/client';

import { CurrentUser } from '../auth/interfaces/current-user.interface';
import { PrismaService } from '../database/prisma.service';

import {
  buildPaginatedResult,
  getPaginationParams,
  normalizeSearch,
} from '../common/utils/pagination.util';

import { QueryAiUsageRecordsDto } from './dto/query-ai-usage-records.dto';

type CheckAiUsageInput = {
  feature: AiUsageFeature;
  estimatedCreditsRequired: number;
  metadataJson?: Prisma.InputJsonValue;
};

type RecordSuccessfulUsageInput = {
  feature: AiUsageFeature;
  provider: string;
  model: string;
  tokensInput: number;
  tokensOutput: number;
  estimatedCostUsd: number;
  aiSuggestionId?: string;
  metadataJson?: Prisma.InputJsonValue;
};

type RecordFailedUsageInput = {
  feature: AiUsageFeature;
  provider?: string;
  model?: string;
  tokensInput?: number;
  tokensOutput?: number;
  estimatedCostUsd?: number;
  errorCode: string;
  errorMessage: string;
  metadataJson?: Prisma.InputJsonValue;
};

@Injectable()
export class AiUsageService {
  constructor(private readonly prisma: PrismaService) {}

  estimateCreditsFromText(inputText: string, expectedOutputTokens = 250) {
    const estimatedInputTokens = Math.ceil(inputText.length / 4);

    return this.calculateCreditsUsed(
      estimatedInputTokens,
      expectedOutputTokens,
    );
  }

  calculateCreditsUsed(tokensInput: number, tokensOutput: number) {
    return Math.max(1, tokensInput + tokensOutput);
  }

  async assertCanUseAi(
    currentUser: CurrentUser,
    input: CheckAiUsageInput,
  ) {
    const estimatedCreditsRequired = Math.max(
      1,
      input.estimatedCreditsRequired,
    );

    const organization = await this.prisma.organization.findFirst({
      where: {
        id: currentUser.organizationId,
        deletedAt: null,
      },
      select: {
        id: true,
        aiEnabled: true,
        aiMonthlyCreditsLimit: true,
        aiDefaultUserMonthlyCreditsLimit: true,
        aiCreditsBalance: true,
      },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    if (!organization.aiEnabled) {
      await this.recordBlockedUsage(currentUser, {
        feature: input.feature,
        errorCode: 'ORG_AI_DISABLED',
        errorMessage: 'AI usage is disabled for this organization',
        metadataJson: input.metadataJson,
      });

      throw new ForbiddenException(
        'AI usage is disabled for this organization',
      );
    }

    const userLimit = await this.prisma.aiUserUsageLimit.findFirst({
      where: {
        organizationId: currentUser.organizationId,
        userId: currentUser.id,
      },
    });

    if (userLimit && !userLimit.aiEnabled) {
      await this.recordBlockedUsage(currentUser, {
        feature: input.feature,
        errorCode: 'USER_AI_DISABLED',
        errorMessage: 'AI usage is disabled for this user',
        metadataJson: input.metadataJson,
      });

      throw new ForbiddenException('AI usage is disabled for this user');
    }

    const { startDate, endDate } = this.getCurrentMonthRange();

    const [organizationUsage, userUsage] = await Promise.all([
      this.prisma.aiUsageRecord.aggregate({
        where: {
          organizationId: currentUser.organizationId,
          status: AiUsageStatus.SUCCESS,
          createdAt: {
            gte: startDate,
            lt: endDate,
          },
        },
        _sum: {
          creditsUsed: true,
        },
      }),
      this.prisma.aiUsageRecord.aggregate({
        where: {
          organizationId: currentUser.organizationId,
          userId: currentUser.id,
          status: AiUsageStatus.SUCCESS,
          createdAt: {
            gte: startDate,
            lt: endDate,
          },
        },
        _sum: {
          creditsUsed: true,
        },
      }),
    ]);

    const organizationCreditsUsed =
      organizationUsage._sum.creditsUsed ?? 0;

    const userCreditsUsed = userUsage._sum.creditsUsed ?? 0;

    const userMonthlyLimit =
      userLimit?.monthlyCreditsLimit ??
      organization.aiDefaultUserMonthlyCreditsLimit;

    if (organization.aiCreditsBalance < estimatedCreditsRequired) {
      await this.recordBlockedUsage(currentUser, {
        feature: input.feature,
        errorCode: 'ORG_AI_CREDITS_EXHAUSTED',
        errorMessage: 'AI usage limit reached',
        metadataJson: input.metadataJson,
      });

      throw new HttpException(
        'AI usage limit reached',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (
      organizationCreditsUsed + estimatedCreditsRequired >
      organization.aiMonthlyCreditsLimit
    ) {
      await this.recordBlockedUsage(currentUser, {
        feature: input.feature,
        errorCode: 'ORG_MONTHLY_AI_LIMIT_REACHED',
        errorMessage: 'Organization monthly AI usage limit reached',
        metadataJson: input.metadataJson,
      });

      throw new HttpException(
        'Organization monthly AI usage limit reached',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (userCreditsUsed + estimatedCreditsRequired > userMonthlyLimit) {
      await this.recordBlockedUsage(currentUser, {
        feature: input.feature,
        errorCode: 'USER_MONTHLY_AI_LIMIT_REACHED',
        errorMessage: 'User monthly AI usage limit reached',
        metadataJson: input.metadataJson,
      });

      throw new HttpException(
        'User monthly AI usage limit reached',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return {
      organizationCreditsUsed,
      organizationMonthlyLimit: organization.aiMonthlyCreditsLimit,
      userCreditsUsed,
      userMonthlyLimit,
      estimatedCreditsRequired,
      creditsBalance: organization.aiCreditsBalance,
    };
  }

  async recordSuccessfulUsage(
    tx: Prisma.TransactionClient,
    currentUser: CurrentUser,
    input: RecordSuccessfulUsageInput,
  ) {
    const totalTokens = input.tokensInput + input.tokensOutput;
    const creditsUsed = this.calculateCreditsUsed(
      input.tokensInput,
      input.tokensOutput,
    );

    const usageRecord = await tx.aiUsageRecord.create({
      data: {
        organizationId: currentUser.organizationId,
        userId: currentUser.id,
        aiSuggestionId: input.aiSuggestionId,
        feature: input.feature,
        status: AiUsageStatus.SUCCESS,
        provider: input.provider,
        model: input.model,
        tokensInput: input.tokensInput,
        tokensOutput: input.tokensOutput,
        totalTokens,
        creditsUsed,
        estimatedCostUsd: input.estimatedCostUsd,
        metadataJson: input.metadataJson ?? undefined,
      },
    });

    const updatedOrganizationResult = await tx.organization.updateMany({
      where: {
        id: currentUser.organizationId,
        aiCreditsBalance: {
          gte: creditsUsed,
        },
      },
      data: {
        aiCreditsBalance: {
          decrement: creditsUsed,
        },
        aiCreditsUpdatedAt: new Date(),
      },
    });

    if (updatedOrganizationResult.count === 0) {
      throw new HttpException(
        'AI usage limit reached',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const organization = await tx.organization.findUnique({
      where: {
        id: currentUser.organizationId,
      },
      select: {
        aiCreditsBalance: true,
      },
    });

    await tx.aiCreditTransaction.create({
      data: {
        organizationId: currentUser.organizationId,
        actorUserId: currentUser.id,
        usageRecordId: usageRecord.id,
        aiSuggestionId: input.aiSuggestionId,
        type: AiCreditTransactionType.USAGE_DEBIT,
        amount: -creditsUsed,
        balanceAfter: organization?.aiCreditsBalance ?? null,
        reason: `AI usage: ${input.feature}`,
        metadataJson: {
          feature: input.feature,
          provider: input.provider,
          model: input.model,
          tokensInput: input.tokensInput,
          tokensOutput: input.tokensOutput,
          totalTokens,
          creditsUsed,
          estimatedCostUsd: input.estimatedCostUsd,
        },
      },
    });

    return usageRecord;
  }

  async recordFailedUsage(
    currentUser: CurrentUser,
    input: RecordFailedUsageInput,
  ) {
    const tokensInput = input.tokensInput ?? 0;
    const tokensOutput = input.tokensOutput ?? 0;

    return this.prisma.aiUsageRecord.create({
      data: {
        organizationId: currentUser.organizationId,
        userId: currentUser.id,
        feature: input.feature,
        status: AiUsageStatus.FAILED,
        provider: input.provider,
        model: input.model,
        tokensInput,
        tokensOutput,
        totalTokens: tokensInput + tokensOutput,
        creditsUsed: 0,
        estimatedCostUsd: input.estimatedCostUsd ?? 0,
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
        metadataJson: input.metadataJson ?? undefined,
      },
    });
  }

    async getMyUsage(currentUser: CurrentUser) {
    const { startDate, endDate } = this.getCurrentMonthRange();

    const [organization, userLimit, userUsage] = await Promise.all([
      this.prisma.organization.findFirst({
        where: {
          id: currentUser.organizationId,
          deletedAt: null,
        },
        select: {
          id: true,
          name: true,
          aiEnabled: true,
          aiMonthlyCreditsLimit: true,
          aiDefaultUserMonthlyCreditsLimit: true,
          aiCreditsBalance: true,
          aiCreditsUpdatedAt: true,
        },
      }),
      this.prisma.aiUserUsageLimit.findFirst({
        where: {
          organizationId: currentUser.organizationId,
          userId: currentUser.id,
        },
      }),
      this.prisma.aiUsageRecord.aggregate({
        where: {
          organizationId: currentUser.organizationId,
          userId: currentUser.id,
          status: AiUsageStatus.SUCCESS,
          createdAt: {
            gte: startDate,
            lt: endDate,
          },
        },
        _sum: {
          creditsUsed: true,
          tokensInput: true,
          tokensOutput: true,
          totalTokens: true,
          estimatedCostUsd: true,
        },
        _count: {
          _all: true,
        },
      }),
    ]);

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const userMonthlyLimit =
      userLimit?.monthlyCreditsLimit ??
      organization.aiDefaultUserMonthlyCreditsLimit;

    const creditsUsed = userUsage._sum.creditsUsed ?? 0;

    return {
      period: {
        startDate,
        endDate,
      },
      user: {
        id: currentUser.id,
        aiEnabled: userLimit?.aiEnabled ?? true,
        monthlyCreditsLimit: userMonthlyLimit,
        creditsUsed,
        creditsRemaining: Math.max(0, userMonthlyLimit - creditsUsed),
        requestsCount: userUsage._count._all,
        tokensInput: userUsage._sum.tokensInput ?? 0,
        tokensOutput: userUsage._sum.tokensOutput ?? 0,
        totalTokens: userUsage._sum.totalTokens ?? 0,
        estimatedCostUsd: userUsage._sum.estimatedCostUsd ?? 0,
      },
      organization: {
        id: organization.id,
        name: organization.name,
        aiEnabled: organization.aiEnabled,
        creditsBalance: organization.aiCreditsBalance,
        monthlyCreditsLimit: organization.aiMonthlyCreditsLimit,
        defaultUserMonthlyCreditsLimit:
          organization.aiDefaultUserMonthlyCreditsLimit,
        creditsUpdatedAt: organization.aiCreditsUpdatedAt,
      },
    };
  }

  async getOrganizationUsage(currentUser: CurrentUser) {
    this.assertCanViewOrganizationUsage(currentUser);

    const { startDate, endDate } = this.getCurrentMonthRange();

    const organization = await this.prisma.organization.findFirst({
      where: {
        id: currentUser.organizationId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        aiEnabled: true,
        aiMonthlyCreditsLimit: true,
        aiDefaultUserMonthlyCreditsLimit: true,
        aiCreditsBalance: true,
        aiCreditsUpdatedAt: true,
      },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const where: Prisma.AiUsageRecordWhereInput = {
      organizationId: currentUser.organizationId,
      status: AiUsageStatus.SUCCESS,
      createdAt: {
        gte: startDate,
        lt: endDate,
      },
    };

    const [summary, usageByFeature, usageByUser] = await Promise.all([
      this.prisma.aiUsageRecord.aggregate({
        where,
        _sum: {
          creditsUsed: true,
          tokensInput: true,
          tokensOutput: true,
          totalTokens: true,
          estimatedCostUsd: true,
        },
        _count: {
          _all: true,
        },
      }),
      this.prisma.aiUsageRecord.groupBy({
        by: ['feature'],
        where,
        _sum: {
          creditsUsed: true,
          totalTokens: true,
          estimatedCostUsd: true,
        },
        _count: {
          _all: true,
        },
        orderBy: {
          _sum: {
            creditsUsed: 'desc',
          },
        },
      }),
      this.prisma.aiUsageRecord.groupBy({
        by: ['userId'],
        where,
        _sum: {
          creditsUsed: true,
          totalTokens: true,
          estimatedCostUsd: true,
        },
        _count: {
          _all: true,
        },
        orderBy: {
          _sum: {
            creditsUsed: 'desc',
          },
        },
      }),
    ]);

    const userIds = usageByUser
      .map((record) => record.userId)
      .filter((userId): userId is string => Boolean(userId));

    const users = await this.prisma.user.findMany({
      where: {
        organizationId: currentUser.organizationId,
        id: {
          in: userIds,
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    const usersById = new Map(users.map((user) => [user.id, user]));

    const creditsUsed = summary._sum.creditsUsed ?? 0;

    return {
      period: {
        startDate,
        endDate,
      },
      organization: {
        ...organization,
        creditsUsed,
        creditsRemainingMonthly: Math.max(
          0,
          organization.aiMonthlyCreditsLimit - creditsUsed,
        ),
      },
      summary: {
        requestsCount: summary._count._all,
        creditsUsed,
        tokensInput: summary._sum.tokensInput ?? 0,
        tokensOutput: summary._sum.tokensOutput ?? 0,
        totalTokens: summary._sum.totalTokens ?? 0,
        estimatedCostUsd: summary._sum.estimatedCostUsd ?? 0,
      },
      usageByFeature: usageByFeature.map((record) => ({
        feature: record.feature,
        requestsCount: record._count._all,
        creditsUsed: record._sum.creditsUsed ?? 0,
        totalTokens: record._sum.totalTokens ?? 0,
        estimatedCostUsd: record._sum.estimatedCostUsd ?? 0,
      })),
      usageByUser: usageByUser.map((record) => ({
        userId: record.userId,
        user: record.userId ? usersById.get(record.userId) ?? null : null,
        requestsCount: record._count._all,
        creditsUsed: record._sum.creditsUsed ?? 0,
        totalTokens: record._sum.totalTokens ?? 0,
        estimatedCostUsd: record._sum.estimatedCostUsd ?? 0,
      })),
    };
  }

  async findRecords(
    currentUser: CurrentUser,
    query: QueryAiUsageRecordsDto,
  ) {
    const { page, pageSize, skip, take } = getPaginationParams(query);
    const search = normalizeSearch(query.search);
    const canViewOrganization = this.canViewOrganizationUsage(currentUser);

    const where: Prisma.AiUsageRecordWhereInput = {
      organizationId: currentUser.organizationId,
      ...(canViewOrganization
        ? query.userId
          ? { userId: query.userId }
          : {}
        : { userId: currentUser.id }),
      ...(query.feature && {
        feature: query.feature,
      }),
      ...(query.status && {
        status: query.status,
      }),
      ...(query.aiSuggestionId && {
        aiSuggestionId: query.aiSuggestionId,
      }),
      ...(search && {
        OR: [
          {
            provider: {
              contains: search,
              mode: 'insensitive',
            },
          },
          {
            model: {
              contains: search,
              mode: 'insensitive',
            },
          },
          {
            errorCode: {
              contains: search,
              mode: 'insensitive',
            },
          },
          {
            errorMessage: {
              contains: search,
              mode: 'insensitive',
            },
          },
        ],
      }),
    };

    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';

    const orderBy: Prisma.AiUsageRecordOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.aiUsageRecord.findMany({
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
            },
          },
          aiSuggestion: {
            select: {
              id: true,
              title: true,
              type: true,
              status: true,
              leadId: true,
              createdAt: true,
            },
          },
        },
      }),
      this.prisma.aiUsageRecord.count({
        where,
      }),
    ]);

    return buildPaginatedResult(data, total, page, pageSize);
  }

  private async recordBlockedUsage(
    currentUser: CurrentUser,
    input: {
      feature: AiUsageFeature;
      errorCode: string;
      errorMessage: string;
      metadataJson?: Prisma.InputJsonValue;
    },
  ) {
    return this.prisma.aiUsageRecord.create({
      data: {
        organizationId: currentUser.organizationId,
        userId: currentUser.id,
        feature: input.feature,
        status: AiUsageStatus.BLOCKED,
        creditsUsed: 0,
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
        metadataJson: input.metadataJson ?? undefined,
      },
    });
  }

  private getCurrentMonthRange() {
    const now = new Date();

    const startDate = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );

    const endDate = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
    );

    return {
      startDate,
      endDate,
    };
  }

  private canViewOrganizationUsage(currentUser: CurrentUser) {
    return (
      currentUser.role === Role.SUPER_ADMIN ||
      currentUser.role === Role.OWNER ||
      currentUser.role === Role.ADMIN
    );
  }

  private assertCanViewOrganizationUsage(currentUser: CurrentUser) {
    if (!this.canViewOrganizationUsage(currentUser)) {
      throw new ForbiddenException(
        'You do not have permission to view organization AI usage',
      );
    }
  }
}
