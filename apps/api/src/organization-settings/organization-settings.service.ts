import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';

import { CurrentUser } from '../auth/interfaces/current-user.interface';
import {
  buildPaginatedResult,
  getPaginationParams,
  normalizeSearch,
} from '../common/utils/pagination.util';
import { PrismaService } from '../database/prisma.service';

import { QueryOrganizationUsersDto } from './dto/query-organization-users.dto';
import { UpdateCurrentOrganizationDto } from './dto/update-current-organization.dto';

@Injectable()
export class OrganizationSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrentOrganization(currentUser: CurrentUser) {
    const organization = await this.prisma.organization.findFirst({
      where: {
        id: currentUser.organizationId,
        deletedAt: null,
      },
      select: this.getCurrentOrganizationSelect(),
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return organization;
  }

  async updateCurrentOrganization(
    currentUser: CurrentUser,
    dto: UpdateCurrentOrganizationDto,
  ) {
    this.assertCanManageOrganizationSettings(currentUser);

    const organization = await this.prisma.organization.findFirst({
      where: {
        id: currentUser.organizationId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return this.prisma.organization.update({
      where: {
        id: currentUser.organizationId,
      },
      data: dto,
      select: this.getCurrentOrganizationSelect(),
    });
  }

  async findOrganizationUsers(
    currentUser: CurrentUser,
    query: QueryOrganizationUsersDto,
  ) {
    this.assertCanManageOrganizationUsers(currentUser);

    const { page, pageSize, skip, take } = getPaginationParams(query);
    const search = normalizeSearch(query.search);

    const where: Prisma.UserWhereInput = {
      organizationId: currentUser.organizationId,
      ...(query.role && {
        role: query.role,
      }),
      ...(query.isActive !== undefined && {
        isActive: query.isActive === 'true',
      }),
      ...(search && {
        OR: [
          {
            email: {
              contains: search,
              mode: 'insensitive',
            },
          },
          {
            name: {
              contains: search,
              mode: 'insensitive',
            },
          },
        ],
      }),
    };

    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';

    const orderBy: Prisma.UserOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy,
        skip,
        take,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.user.count({
        where,
      }),
    ]);

    return buildPaginatedResult(data, total, page, pageSize);
  }

  private assertCanManageOrganizationSettings(currentUser: CurrentUser) {
    if (
      currentUser.role !== Role.SUPER_ADMIN &&
      currentUser.role !== Role.OWNER &&
      currentUser.role !== Role.ADMIN
    ) {
      throw new ForbiddenException(
        'You do not have permission to manage organization settings',
      );
    }
  }

  private assertCanManageOrganizationUsers(currentUser: CurrentUser) {
    if (
      currentUser.role !== Role.SUPER_ADMIN &&
      currentUser.role !== Role.OWNER &&
      currentUser.role !== Role.ADMIN
    ) {
      throw new ForbiddenException(
        'You do not have permission to view organization users',
      );
    }
  }

  private getCurrentOrganizationSelect() {
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
          aiSuggestions: true,
          aiUsageRecords: true,
          invitations: true,
        },
      },
    } satisfies Prisma.OrganizationSelect;
  }
}