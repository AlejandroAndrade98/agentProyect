import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CurrentUser } from '../auth/interfaces/current-user.interface';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';

import { ActivityEventType, EntityType, Prisma } from '@prisma/client';

import {
  buildPaginatedResult,
  getPaginationParams,
  normalizeSearch,
} from '../common/utils/pagination.util';
import { QueryLeadsDto } from './dto/query-leads.dto';

import { hasInclude, parseIncludeParam } from '../common/utils/include.util';
import { LeadIncludeQueryDto } from './dto/lead-include-query.dto';
import { ActivityEventsService } from '../activity-events/activity-events.service';

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityEventsService: ActivityEventsService,
  ) {}

async findAll(currentUser: CurrentUser, query: QueryLeadsDto) {
  const { page, pageSize, skip, take } = getPaginationParams(query);
  const search = normalizeSearch(query.search);

  const where: Prisma.LeadWhereInput = {
    organizationId: currentUser.organizationId,
    deletedAt: null,
    ...(query.status && {
      status: query.status,
    }),
    ...(query.priority && {
      priority: query.priority,
    }),
    ...(query.importanceLevel && {
      importanceLevel: query.importanceLevel,
    }),
    ...(query.source && {
      source: query.source,
    }),
    ...(query.companyId && {
      companyId: query.companyId,
    }),
    ...(query.contactId && {
      contactId: query.contactId,
    }),
    ...(query.assignedToUserId && {
      assignedToUserId: query.assignedToUserId,
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
          description: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          nextStep: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ],
    }),
  };

  const sortBy = query.sortBy ?? 'createdAt';
  const sortOrder = query.sortOrder ?? 'desc';

  const orderBy: Prisma.LeadOrderByWithRelationInput = {
    [sortBy]: sortOrder,
  };

  const [data, total] = await this.prisma.$transaction([
    this.prisma.lead.findMany({
      where,
      orderBy,
      skip,
      take,
    }),
    this.prisma.lead.count({
      where,
    }),
  ]);

  return buildPaginatedResult(data, total, page, pageSize);
}

async findOne(
  id: string,
  currentUser: CurrentUser,
  query?: LeadIncludeQueryDto,
) {
  const includes = parseIncludeParam(query?.include, [
    'company',
    'contact',
    'assignedUser',
    'tasks',
    'notes',
  ] as const);

  const lead = await this.prisma.lead.findFirst({
    where: {
      id,
      organizationId: currentUser.organizationId,
      deletedAt: null,
    },
    include: {
      company: hasInclude(includes, 'company'),
      contact: hasInclude(includes, 'contact'),
      user: hasInclude(includes, 'assignedUser')
        ? {
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
          }
        : false,
      tasks: hasInclude(includes, 'tasks')
        ? {
            where: {
              deletedAt: null,
            },
            orderBy: {
              createdAt: 'desc',
            },
            take: 20,
          }
        : false,
      linkedNotes: hasInclude(includes, 'notes')
        ? {
            where: {
              deletedAt: null,
            },
            orderBy: {
              createdAt: 'desc',
            },
            take: 20,
          }
        : false,
    },
  });

  if (!lead) {
    throw new NotFoundException('Lead not found');
  }

  return lead;
}

async create(dto: CreateLeadDto, currentUser: CurrentUser) {
  return this.prisma.$transaction(async (tx) => {
    if (dto.companyId) {
      const company = await tx.company.findFirst({
        where: {
          id: dto.companyId,
          organizationId: currentUser.organizationId,
          deletedAt: null,
        },
      });

      if (!company) {
        throw new NotFoundException('Company not found');
      }
    }

    if (dto.contactId) {
      const contact = await tx.contact.findFirst({
        where: {
          id: dto.contactId,
          organizationId: currentUser.organizationId,
          deletedAt: null,
        },
      });

      if (!contact) {
        throw new NotFoundException('Contact not found');
      }
    }

    if (dto.assignedToUserId) {
      const assignedUser = await tx.user.findFirst({
        where: {
          id: dto.assignedToUserId,
          organizationId: currentUser.organizationId,
          deletedAt: null,
          isActive: true,
        },
      });

      if (!assignedUser) {
        throw new NotFoundException('Assigned user not found');
      }
    }

    const lead = await tx.lead.create({
      data: {
        ...dto,
        organizationId: currentUser.organizationId,
      },
    });

    await tx.activityEvent.create({
      data: this.activityEventsService.buildCreateData(currentUser, {
        type: ActivityEventType.LEAD_CREATED,
        entityType: EntityType.LEAD,
        entityId: lead.id,
        title: `Lead created: ${lead.title}`,
        description: lead.description ?? undefined,
        source: lead.source,
        companyId: lead.companyId ?? undefined,
        contactId: lead.contactId ?? undefined,
        leadId: lead.id,
        occurredAt: lead.createdAt,
      }),
    });

    return lead;
  });
}

async update(id: string, dto: UpdateLeadDto, currentUser: CurrentUser) {
  const existingLead = await this.findOne(id, currentUser);

  await this.validateRelations(dto, currentUser.organizationId);

  const statusChanged =
    dto.status !== undefined && dto.status !== existingLead.status;

  return this.prisma.$transaction(async (tx) => {
    const lead = await tx.lead.update({
      where: {
        id,
      },
      data: dto,
    });

    if (statusChanged) {
      await tx.activityEvent.create({
        data: this.activityEventsService.buildCreateData(currentUser, {
          type: ActivityEventType.LEAD_STATUS_CHANGED,
          entityType: EntityType.LEAD,
          entityId: lead.id,
          title: `Lead status changed: ${lead.title}`,
          description: `Status changed from ${existingLead.status} to ${lead.status}`,
          source: lead.source,
          companyId: lead.companyId ?? undefined,
          contactId: lead.contactId ?? undefined,
          leadId: lead.id,
          occurredAt: lead.updatedAt,
          metadataJson: {
            previousStatus: existingLead.status,
            newStatus: lead.status,
          },
        }),
      });
    }

    return lead;
  });
}

  async remove(id: string, currentUser: CurrentUser) {
    await this.findOne(id, currentUser);

    return this.prisma.lead.update({
      where: {
        id,
      },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  private async validateRelations(
    dto: CreateLeadDto | UpdateLeadDto,
    organizationId: string,
  ) {
    if (dto.companyId) {
      await this.validateCompanyBelongsToOrganization(
        dto.companyId,
        organizationId,
      );
    }

    if (dto.contactId) {
      await this.validateContactBelongsToOrganization(
        dto.contactId,
        organizationId,
      );
    }

    if (dto.assignedToUserId) {
      await this.validateUserBelongsToOrganization(
        dto.assignedToUserId,
        organizationId,
      );
    }
  }

  private async validateCompanyBelongsToOrganization(
    companyId: string,
    organizationId: string,
  ) {
    const company = await this.prisma.company.findFirst({
      where: {
        id: companyId,
        organizationId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }
  }

  private async validateContactBelongsToOrganization(
    contactId: string,
    organizationId: string,
  ) {
    const contact = await this.prisma.contact.findFirst({
      where: {
        id: contactId,
        organizationId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }
  }

  private async validateUserBelongsToOrganization(
    userId: string,
    organizationId: string,
  ) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        organizationId,
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Assigned user not found');
    }
  }
}