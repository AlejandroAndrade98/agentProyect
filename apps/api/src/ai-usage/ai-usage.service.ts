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
} from '@prisma/client';

import { CurrentUser } from '../auth/interfaces/current-user.interface';
import { PrismaService } from '../database/prisma.service';

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
}