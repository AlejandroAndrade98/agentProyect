import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { OrganizationInvitationStatus, Prisma, Role } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';

import { CurrentUser } from '../auth/interfaces/current-user.interface';
import {
  buildPaginatedResult,
  getPaginationParams,
  normalizeSearch,
} from '../common/utils/pagination.util';
import { PrismaService } from '../database/prisma.service';

import { QueryOrganizationUsersDto } from './dto/query-organization-users.dto';
import { UpdateCurrentOrganizationDto } from './dto/update-current-organization.dto';

import { CreateOrganizationInvitationDto } from './dto/create-organization-invitation.dto';
import { QueryOrganizationInvitationsDto } from './dto/query-organization-invitations.dto';



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

    const canViewSuperAdminUsers = currentUser.role === Role.SUPER_ADMIN;

    if (query.role === Role.SUPER_ADMIN && !canViewSuperAdminUsers) {
      throw new ForbiddenException(
        'You do not have permission to view super admin users',
      );
    }

    const { page, pageSize, skip, take } = getPaginationParams(query);
    const search = normalizeSearch(query.search);

    const where: Prisma.UserWhereInput = {
      organizationId: currentUser.organizationId,
      ...(query.role
        ? {
            role: query.role,
          }
        : !canViewSuperAdminUsers
          ? {
              role: {
                not: Role.SUPER_ADMIN,
              },
            }
          : {}),
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

    async findOrganizationInvitations(
    currentUser: CurrentUser,
    query: QueryOrganizationInvitationsDto,
  ) {
    this.assertCanManageOrganizationUsers(currentUser);

    const { page, pageSize, skip, take } = getPaginationParams(query);
    const search = normalizeSearch(query.search);

    const where: Prisma.OrganizationInvitationWhereInput = {
      organizationId: currentUser.organizationId,
      ...(query.status && {
        status: query.status,
      }),
      ...(query.role && {
        role: query.role,
      }),
      ...(search && {
        email: {
          contains: search,
          mode: 'insensitive',
        },
      }),
    };

    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';

    const orderBy: Prisma.OrganizationInvitationOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.organizationInvitation.findMany({
        where,
        orderBy,
        skip,
        take,
        select: this.getOrganizationInvitationSelect(),
      }),
      this.prisma.organizationInvitation.count({
        where,
      }),
    ]);

    return buildPaginatedResult(data, total, page, pageSize);
  }

  async createOrganizationInvitation(
    currentUser: CurrentUser,
    dto: CreateOrganizationInvitationDto,
  ) {
    this.assertCanManageOrganizationUsers(currentUser);
    this.assertCanInviteRole(currentUser, dto.role);

    const normalizedEmail = dto.email.trim().toLowerCase();
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + 7);

    const organization = await this.prisma.organization.findFirst({
      where: {
        id: currentUser.organizationId,
        deletedAt: null,
      },
      select: {
        id: true,
        maxUsers: true,
      },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
      select: {
        id: true,
        organizationId: true,
      },
    });

    if (existingUser) {
      throw new ConflictException('A user with this email already exists');
    }

    const existingPendingInvitation =
      await this.prisma.organizationInvitation.findFirst({
        where: {
          organizationId: currentUser.organizationId,
          email: normalizedEmail,
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
      throw new ConflictException(
        'A pending invitation already exists for this email',
      );
    }

    await this.assertHasAvailableUserSeat(currentUser.organizationId, now);

    const acceptanceToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashInvitationToken(acceptanceToken);

    const invitation = await this.prisma.organizationInvitation.create({
      data: {
        organizationId: currentUser.organizationId,
        email: normalizedEmail,
        role: dto.role,
        tokenHash,
        expiresAt,
        invitedByUserId: currentUser.id,
      },
      select: this.getOrganizationInvitationSelect(),
    });

    return {
      invitation,
      acceptanceToken,
    };
  }

  async revokeOrganizationInvitation(currentUser: CurrentUser, id: string) {
    this.assertCanManageOrganizationUsers(currentUser);

    const invitation = await this.prisma.organizationInvitation.findFirst({
      where: {
        id,
        organizationId: currentUser.organizationId,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.status !== OrganizationInvitationStatus.PENDING) {
      throw new BadRequestException('Only pending invitations can be revoked');
    }

    return this.prisma.organizationInvitation.update({
      where: {
        id,
      },
      data: {
        status: OrganizationInvitationStatus.REVOKED,
        revokedAt: new Date(),
      },
      select: this.getOrganizationInvitationSelect(),
    });
  }

    private assertCanInviteRole(currentUser: CurrentUser, role: Role) {
    if (role === Role.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Super admin users cannot be invited from organization settings',
      );
    }

    if (currentUser.role === Role.SUPER_ADMIN) {
      return;
    }

    if (currentUser.role === Role.OWNER) {
      if (role === Role.OWNER) {
        throw new ForbiddenException('Owner role cannot be invited');
      }

      return;
    }

    if (currentUser.role === Role.ADMIN) {
      if (role === Role.ADMIN || role === Role.OWNER) {
        throw new ForbiddenException(
          'Admins can only invite sales and viewer users',
        );
      }

      return;
    }

    throw new ForbiddenException(
      'You do not have permission to invite users',
    );
  }

  private async assertHasAvailableUserSeat(
    organizationId: string,
    now: Date,
  ) {
    const organization = await this.prisma.organization.findFirst({
      where: {
        id: organizationId,
        deletedAt: null,
      },
      select: {
        maxUsers: true,
      },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const [activeUsersCount, pendingInvitationsCount] =
      await this.prisma.$transaction([
        this.prisma.user.count({
          where: {
            organizationId,
            isActive: true,
          },
        }),
        this.prisma.organizationInvitation.count({
          where: {
            organizationId,
            status: OrganizationInvitationStatus.PENDING,
            expiresAt: {
              gt: now,
            },
          },
        }),
      ]);

    if (activeUsersCount + pendingInvitationsCount >= organization.maxUsers) {
      throw new ConflictException('Organization user limit reached');
    }
  }

  private hashInvitationToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private getOrganizationInvitationSelect() {
    return {
      id: true,
      email: true,
      role: true,
      status: true,
      expiresAt: true,
      acceptedAt: true,
      revokedAt: true,
      createdAt: true,
      updatedAt: true,
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
    } satisfies Prisma.OrganizationInvitationSelect;
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