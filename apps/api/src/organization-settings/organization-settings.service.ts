import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import {
  OrganizationInvitationStatus,
  OrganizationStatus,
  Prisma,
  Role,
} from '@prisma/client';
import { createHash, randomBytes } from 'crypto';

import { CurrentUser } from '../auth/interfaces/current-user.interface';
import {
  buildPaginatedResult,
  getPaginationParams,
  normalizeSearch,
} from '../common/utils/pagination.util';
import { PrismaService } from '../database/prisma.service';
import { EmailService } from '../email/email.service';

import { QueryOrganizationUsersDto } from './dto/query-organization-users.dto';
import { UpdateCurrentOrganizationDto } from './dto/update-current-organization.dto';

import { CreateOrganizationInvitationDto } from './dto/create-organization-invitation.dto';
import { QueryOrganizationInvitationsDto } from './dto/query-organization-invitations.dto';

import * as bcrypt from 'bcrypt';
import { AcceptOrganizationInvitationDto } from './dto/accept-organization-invitation.dto';


@Injectable()
export class OrganizationSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

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
        select: this.getOrganizationUserSelect(),
      }),
      this.prisma.user.count({
        where,
      }),
    ]);

    return buildPaginatedResult(data, total, page, pageSize);
  }

    async deactivateOrganizationUser(currentUser: CurrentUser, userId: string) {
    this.assertCanManageOrganizationUsers(currentUser);

    const targetUser = await this.getTargetOrganizationUser(
      currentUser.organizationId,
      userId,
    );

    this.assertCanManageTargetUser(currentUser, targetUser.role, targetUser.id);

    if (!targetUser.isActive) {
      return targetUser;
    }

    return this.prisma.user.update({
      where: {
        id: targetUser.id,
      },
      data: {
        isActive: false,
      },
      select: this.getOrganizationUserSelect(),
    });
  }

  async reactivateOrganizationUser(currentUser: CurrentUser, userId: string) {
    this.assertCanManageOrganizationUsers(currentUser);

    const targetUser = await this.getTargetOrganizationUser(
      currentUser.organizationId,
      userId,
    );

    this.assertCanManageTargetUser(currentUser, targetUser.role, targetUser.id);

    if (targetUser.isActive) {
      return targetUser;
    }

    await this.assertCanReactivateUser(currentUser.organizationId);

    return this.prisma.user.update({
      where: {
        id: targetUser.id,
      },
      data: {
        isActive: true,
      },
      select: this.getOrganizationUserSelect(),
    });
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
        name: true,
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
    const invitationUrl =
      this.emailService.buildOrganizationInvitationUrl(acceptanceToken);
    const emailDelivery = await this.emailService.sendOrganizationInvitationEmail(
      {
        to: normalizedEmail,
        organizationName: organization.name,
        role: dto.role,
        expiresAt,
        invitationUrl,
      },
    );

    return {
      invitation,
      emailDeliveryStatus: emailDelivery.status,
      emailDeliveryProvider: emailDelivery.provider,
      ...(this.canExposeDevelopmentInvitationTokens()
        ? { acceptanceToken }
        : {}),
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

    private isOrganizationOperational(status: OrganizationStatus) {
    return (
      status === OrganizationStatus.TRIAL ||
      status === OrganizationStatus.ACTIVE
      );
    }

    async getInvitationByToken(token: string) {
    const tokenHash = this.hashInvitationToken(token);
    const now = new Date();

    const invitation = await this.prisma.organizationInvitation.findUnique({
      where: {
        tokenHash,
      },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        expiresAt: true,
        acceptedAt: true,
        revokedAt: true,
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            accountType: true,
            status: true,
          },
        },
        
      },
    });
    

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (!this.isOrganizationOperational(invitation.organization.status)) {
      throw new ForbiddenException('Organization is not accepting invitations');
    }

    if (invitation.status !== OrganizationInvitationStatus.PENDING) {
      throw new BadRequestException('Invitation is no longer pending');
    }

    if (invitation.expiresAt <= now) {
      await this.prisma.organizationInvitation.update({
        where: {
          id: invitation.id,
        },
        data: {
          status: OrganizationInvitationStatus.EXPIRED,
        },
      });

      throw new BadRequestException('Invitation has expired');
    }

    return invitation;
  }

async acceptInvitation(dto: AcceptOrganizationInvitationDto) {
  const tokenHash = this.hashInvitationToken(dto.token);
  const now = new Date();

  const invitation = await this.prisma.organizationInvitation.findUnique({
    where: {
      tokenHash,
    },
    select: {
      id: true,
      organizationId: true,
      email: true,
      role: true,
      status: true,
      expiresAt: true,
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          deletedAt: true,
        },
      },
    },
  });

  if (!invitation) {
    throw new NotFoundException('Invitation not found');
  }

  if (invitation.organization.deletedAt) {
    throw new NotFoundException('Organization not found');
  }

  if (!this.isOrganizationOperational(invitation.organization.status)) {
    throw new ForbiddenException('Organization is not accepting invitations');
  }

  if (invitation.status !== OrganizationInvitationStatus.PENDING) {
    throw new BadRequestException('Invitation is no longer pending');
  }

  if (invitation.expiresAt <= now) {
    await this.prisma.organizationInvitation.update({
      where: {
        id: invitation.id,
      },
      data: {
        status: OrganizationInvitationStatus.EXPIRED,
      },
    });

    throw new BadRequestException('Invitation has expired');
  }

    const existingUser = await this.prisma.user.findUnique({
      where: {
        email: invitation.email,
      },
      select: {
        id: true,
      },
    });

    if (existingUser) {
      throw new ConflictException('A user with this email already exists');
    }

    await this.assertHasAvailableUserSeatForAcceptance(
      invitation.organizationId,
      invitation.id,
      now,
    );

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: invitation.email,
          name: dto.name.trim(),
          passwordHash,
          role: invitation.role,
          isActive: true,
          organizationId: invitation.organizationId,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          organizationId: true,
          createdAt: true,
        },
      });

      const acceptedInvitation = await tx.organizationInvitation.update({
        where: {
          id: invitation.id,
        },
        data: {
          status: OrganizationInvitationStatus.ACCEPTED,
          acceptedAt: new Date(),
          acceptedByUserId: user.id,
        },
        select: this.getOrganizationInvitationSelect(),
      });

      return {
        user,
        invitation: acceptedInvitation,
      };
    });

    return {
      message: 'Invitation accepted successfully',
      organization: {
        id: invitation.organization.id,
        name: invitation.organization.name,
        slug: invitation.organization.slug,
      },
      user: result.user,
      invitation: result.invitation,
    };
  }

    private async assertHasAvailableUserSeatForAcceptance(
    organizationId: string,
    invitationId: string,
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

    const [activeUsersCount, otherPendingInvitationsCount] =
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
            id: {
              not: invitationId,
            },
            status: OrganizationInvitationStatus.PENDING,
            expiresAt: {
              gt: now,
            },
          },
        }),
      ]);

    if (
      activeUsersCount + 1 + otherPendingInvitationsCount >
      organization.maxUsers
    ) {
      throw new ConflictException('Organization user limit reached');
    }
  }

    private async getTargetOrganizationUser(
    organizationId: string,
    userId: string,
  ) {
    const targetUser = await this.prisma.user.findFirst({
      where: {
        id: userId,
        organizationId,
      },
      select: this.getOrganizationUserSelect(),
    });

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    return targetUser;
  }

  private assertCanManageTargetUser(
    currentUser: CurrentUser,
    targetRole: Role,
    targetUserId: string,
  ) {
    if (currentUser.id === targetUserId) {
      throw new ForbiddenException('You cannot change your own access status');
    }

    if (targetRole === Role.SUPER_ADMIN && currentUser.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('You cannot manage super admin users');
    }

    if (currentUser.role === Role.SUPER_ADMIN) {
      return;
    }

    if (currentUser.role === Role.OWNER) {
      if (targetRole === Role.OWNER) {
        throw new ForbiddenException('Owners cannot manage other owners');
      }

      return;
    }

    if (currentUser.role === Role.ADMIN) {
      if (targetRole === Role.OWNER || targetRole === Role.ADMIN) {
        throw new ForbiddenException(
          'Admins can only manage sales and viewer users',
        );
      }

      return;
    }

    throw new ForbiddenException('You do not have permission to manage users');
  }

  private async assertCanReactivateUser(organizationId: string) {
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

    const activeUsersCount = await this.prisma.user.count({
      where: {
        organizationId,
        isActive: true,
      },
    });

    if (activeUsersCount >= organization.maxUsers) {
      throw new ConflictException('Organization user limit reached');
    }
  }

  private getOrganizationUserSelect() {
    return {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      organizationId: true,
      createdAt: true,
      updatedAt: true,
    } satisfies Prisma.UserSelect;
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

  private canExposeDevelopmentInvitationTokens() {
    return process.env.NODE_ENV !== 'production';
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
