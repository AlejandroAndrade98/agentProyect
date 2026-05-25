import { Injectable, NotFoundException } from '@nestjs/common';
import { OrganizationStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../database/prisma.service';
import {
  buildPaginatedResult,
  getPaginationParams,
  normalizeSearch,
} from '../common/utils/pagination.util';

import { QueryPlatformOrganizationsDto } from './dto/query-platform-organizations.dto';
import { UpdatePlatformOrganizationDto } from './dto/update-platform-organization.dto';
import { UpdatePlatformOrganizationStatusDto } from './dto/update-platform-organization-status.dto';

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
          role: 'OWNER',
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