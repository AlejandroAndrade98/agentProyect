import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OrganizationAccountType,
  OrganizationInvitationStatus,
  OrganizationStatus,
  Prisma,
  Role,
} from '@prisma/client';
import { createHash, randomBytes } from 'crypto';

import { PrismaService } from '../database/prisma.service';
import {
  buildPaginatedResult,
  getPaginationParams,
  normalizeSearch,
} from '../common/utils/pagination.util';

import { QueryPlatformOrganizationsDto } from './dto/query-platform-organizations.dto';
import { UpdatePlatformOrganizationDto } from './dto/update-platform-organization.dto';
import { UpdatePlatformOrganizationStatusDto } from './dto/update-platform-organization-status.dto';

import type { CurrentUser } from '../auth/interfaces/current-user.interface';
import { OnboardPlatformOrganizationDto } from './dto/onboard-platform-organization.dto';

@Injectable()
export class PlatformOrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryPlatformOrganizationsDto) {
    const { page, pageSize, skip, take } = getPaginationParams(query);
    const search = normalizeSearch(query.search);

    const where: Prisma.OrganizationWhereInput = {
      deletedAt: null,
      ...(query.accountType && {
        accountType: query.accountType,
      }),
      ...(query.status && {
        status: query.status,
      }),
      ...(query.plan && {
        plan: query.plan,
      }),
      ...(query.aiEnabled !== undefined && {
        aiEnabled: query.aiEnabled === 'true',
      }),
      ...(search && {
        OR: [
          {
            name: {
              contains: search,
              mode: 'insensitive',
            },
          },
          {
            slug: {
              contains: search,
              mode: 'insensitive',
            },
          },
          {
            billingEmail: {
              contains: search,
              mode: 'insensitive',
            },
          },
          {
            supportEmail: {
              contains: search,
              mode: 'insensitive',
            },
          },
        ],
      }),
    };

    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';

    const orderBy: Prisma.OrganizationOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.organization.findMany({
        where,
        orderBy,
        skip,
        take,
        select: this.getOrganizationListSelect(),
      }),
      this.prisma.organization.count({
        where,
      }),
    ]);

    return buildPaginatedResult(data, total, page, pageSize);
  }

  async findOne(id: string) {
    const organization = await this.prisma.organization.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      select: this.getOrganizationDetailSelect(),
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return organization;
  }

  async onboardOrganization(
  currentUser: CurrentUser,
  dto: OnboardPlatformOrganizationDto,
) {
  const now = new Date();
  const organizationName = dto.organizationName.trim();
  const slug = dto.slug.trim().toLowerCase();
  const ownerEmail = dto.ownerEmail.trim().toLowerCase();
  const billingEmail = dto.billingEmail?.trim().toLowerCase();
  const supportEmail = dto.supportEmail?.trim().toLowerCase();

  const existingOrganization = await this.prisma.organization.findUnique({
    where: {
      slug,
    },
    select: {
      id: true,
    },
  });

  if (existingOrganization) {
    throw new ConflictException('Organization slug is already in use');
  }

  const existingUser = await this.prisma.user.findUnique({
    where: {
      email: ownerEmail,
    },
    select: {
      id: true,
    },
  });

  if (existingUser) {
    throw new ConflictException('Owner email already belongs to an existing user');
  }

  const existingPendingInvitation =
    await this.prisma.organizationInvitation.findFirst({
      where: {
        email: ownerEmail,
        status: OrganizationInvitationStatus.PENDING,
        expiresAt: {
          gt: now,
        },
      },
      select: {
        id: true,
      },
    });

  if (existingPendingInvitation) {
    throw new ConflictException('Owner email already has a pending invitation');
  }

  const status = dto.status ?? OrganizationStatus.TRIAL;
  const accountType = dto.accountType ?? OrganizationAccountType.COMPANY;
  const acceptanceToken = this.createInvitationToken();
  const tokenHash = this.hashInvitationToken(acceptanceToken);
  const expiresAt = this.buildInvitationExpiresAt();

  return this.prisma.$transaction(async (tx) => {
    const createdOrganization = await tx.organization.create({
      data: {
        name: organizationName,
        slug,
        industry: dto.industry,
        plan: dto.plan,
        accountType,
        status,
        statusReason: dto.statusReason,
        billingEmail,
        supportEmail,
        timezone: dto.timezone ?? 'America/Bogota',
        locale: dto.locale ?? 'es-CO',
        trialEndsAt: dto.trialEndsAt ? new Date(dto.trialEndsAt) : undefined,
        maxUsers: dto.maxUsers,
        maxActiveLeads: dto.maxActiveLeads,
        aiEnabled: dto.aiEnabled,
        aiMonthlyCreditsLimit: dto.aiMonthlyCreditsLimit,
        aiDefaultUserMonthlyCreditsLimit:
          dto.aiDefaultUserMonthlyCreditsLimit,
        aiCreditsBalance: dto.aiCreditsBalance,
        ...(dto.aiCreditsBalance !== undefined && {
          aiCreditsUpdatedAt: now,
        }),
        ...this.getStatusDatePatch(status),
      },
      select: {
        id: true,
      },
    });

    const ownerInvitation = await tx.organizationInvitation.create({
      data: {
        organizationId: createdOrganization.id,
        email: ownerEmail,
        role: Role.OWNER,
        tokenHash,
        status: OrganizationInvitationStatus.PENDING,
        expiresAt,
        invitedByUserId: currentUser.id,
      },
      select: this.getOnboardingInvitationSelect(),
    });

    const organization = await tx.organization.findUniqueOrThrow({
      where: {
        id: createdOrganization.id,
      },
      select: this.getOrganizationDetailSelect(),
    });

    return {
      organization,
      ownerInvitation: {
        ...ownerInvitation,
        acceptanceToken,
      },
    };
  });
}

private createInvitationToken() {
  return randomBytes(32).toString('hex');
}

private hashInvitationToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

private buildInvitationExpiresAt() {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  return expiresAt;
}

private getOnboardingInvitationSelect() {
  return {
    id: true,
    organizationId: true,
    email: true,
    role: true,
    status: true,
    expiresAt: true,
    acceptedAt: true,
    revokedAt: true,
    createdAt: true,
    invitedBy: {
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    },
  } satisfies Prisma.OrganizationInvitationSelect;
}

  async update(id: string, dto: UpdatePlatformOrganizationDto) {
    await this.ensureOrganizationExists(id);

    const organization = await this.prisma.organization.update({
      where: {
        id,
      },
      data: {
        ...dto,
        ...(dto.aiCreditsBalance !== undefined && {
          aiCreditsUpdatedAt: new Date(),
        }),
        ...(dto.status && this.getStatusDatePatch(dto.status)),
      },
      select: this.getOrganizationDetailSelect(),
    });

    return organization;
  }

  async updateStatus(id: string, dto: UpdatePlatformOrganizationStatusDto) {
    await this.ensureOrganizationExists(id);

    const organization = await this.prisma.organization.update({
      where: {
        id,
      },
      data: {
        status: dto.status,
        statusReason: dto.statusReason,
        ...this.getStatusDatePatch(dto.status),
      },
      select: this.getOrganizationDetailSelect(),
    });

    return organization;
  }

  private async ensureOrganizationExists(id: string) {
    const organization = await this.prisma.organization.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return organization;
  }

  private getStatusDatePatch(status: OrganizationStatus) {
    const now = new Date();

    if (status === OrganizationStatus.ACTIVE) {
      return {
        activatedAt: now,
        suspendedAt: null,
        cancelledAt: null,
      };
    }

    if (status === OrganizationStatus.SUSPENDED) {
      return {
        suspendedAt: now,
      };
    }

    if (status === OrganizationStatus.CANCELLED) {
      return {
        cancelledAt: now,
      };
    }

    if (status === OrganizationStatus.TRIAL) {
      return {
        suspendedAt: null,
        cancelledAt: null,
      };
    }

    return {};
  }

  private getOrganizationListSelect() {
    return {
      id: true,
      name: true,
      slug: true,
      industry: true,
      plan: true,
      accountType: true,
      status: true,
      billingEmail: true,
      supportEmail: true,
      timezone: true,
      locale: true,
      maxUsers: true,
      maxActiveLeads: true,
      aiEnabled: true,
      aiMonthlyCreditsLimit: true,
      aiDefaultUserMonthlyCreditsLimit: true,
      aiCreditsBalance: true,
      aiCreditsUpdatedAt: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          users: true,
          companies: true,
          contacts: true,
          leads: true,
          tasks: true,
          notes: true,
          aiUsageRecords: true,
          invitations: true,
        },
      },
        users: {
          where: {
            role: {
              in: [Role.OWNER, Role.SUPER_ADMIN],
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
          take: 1,
          select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
        },
      },
    } satisfies Prisma.OrganizationSelect;
  }

  private getOrganizationDetailSelect() {
    return {
      id: true,
      name: true,
      slug: true,
      industry: true,
      plan: true,
      accountType: true,
      status: true,
      statusReason: true,
      billingEmail: true,
      supportEmail: true,
      timezone: true,
      locale: true,
      trialEndsAt: true,
      activatedAt: true,
      suspendedAt: true,
      cancelledAt: true,
      maxUsers: true,
      maxActiveLeads: true,
      aiEnabled: true,
      aiMonthlyCreditsLimit: true,
      aiDefaultUserMonthlyCreditsLimit: true,
      aiCreditsBalance: true,
      aiCreditsUpdatedAt: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          users: true,
          companies: true,
          contacts: true,
          leads: true,
          tasks: true,
          notes: true,
          products: true,
          activityEvents: true,
          aiSuggestions: true,
          aiUsageRecords: true,
          aiCreditTransactions: true,
          invitations: true,
        },
      },
      users: {
        orderBy: {
          createdAt: 'asc',
        },
        take: 20,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      },
      invitations: {
        orderBy: {
          createdAt: 'desc',
        },
        take: 20,
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          expiresAt: true,
          acceptedAt: true,
          revokedAt: true,
          createdAt: true,
          invitedBy: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
            },
          },
          acceptedBy: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
            },
          },
        },
      },
    } satisfies Prisma.OrganizationSelect;
  }
}