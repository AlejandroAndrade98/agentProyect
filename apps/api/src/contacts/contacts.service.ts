import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CurrentUser } from '../auth/interfaces/current-user.interface';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

import { ActivityEventType, EntityType, Prisma } from '@prisma/client';

import {
  buildPaginatedResult,
  getPaginationParams,
  normalizeSearch,
} from '../common/utils/pagination.util';
import { QueryContactsDto } from './dto/query-contacts.dto';

import { hasInclude, parseIncludeParam } from '../common/utils/include.util';
import { ContactIncludeQueryDto } from './dto/contact-include-query.dto';
import { ActivityEventsService } from '../activity-events/activity-events.service';

@Injectable()
export class ContactsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityEventsService: ActivityEventsService,
  ) {}

async findAll(currentUser: CurrentUser, query: QueryContactsDto) {
  const { page, pageSize, skip, take } = getPaginationParams(query);
  const search = normalizeSearch(query.search);

  const where: Prisma.ContactWhereInput = {
    organizationId: currentUser.organizationId,
    deletedAt: null,
    ...(query.companyId && {
      companyId: query.companyId,
    }),
    ...(query.importanceLevel && {
      importanceLevel: query.importanceLevel,
    }),
    ...(query.source && {
      source: query.source,
    }),
    ...(query.city && {
      city: {
        contains: query.city.trim(),
        mode: 'insensitive',
      },
    }),
    ...(query.country && {
      country: {
        contains: query.country.trim(),
        mode: 'insensitive',
      },
    }),
    ...(search && {
      OR: [
        {
          firstName: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          lastName: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          email: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          phone: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          jobTitle: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          linkedinUrl: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          city: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          country: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          notes: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          expertise: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ],
    }),
  };

  const sortBy = query.sortBy ?? 'createdAt';
  const sortOrder = query.sortOrder ?? 'desc';

  const orderBy: Prisma.ContactOrderByWithRelationInput = {
    [sortBy]: sortOrder,
  };

  const [data, total] = await this.prisma.$transaction([
    this.prisma.contact.findMany({
      where,
      orderBy,
      skip,
      take,
    }),
    this.prisma.contact.count({
      where,
    }),
  ]);

  return buildPaginatedResult(data, total, page, pageSize);
}

  async findOne(
  id: string,
  currentUser: CurrentUser,
  query?: ContactIncludeQueryDto,
) {
  const includes = parseIncludeParam(query?.include, [
    'company',
    'leads',
    'tasks',
    'notes',
  ] as const);

  const contact = await this.prisma.contact.findFirst({
    where: {
      id,
      organizationId: currentUser.organizationId,
      deletedAt: null,
    },
    include: {
      company: hasInclude(includes, 'company'),
      leads: hasInclude(includes, 'leads')
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

  if (!contact) {
    throw new NotFoundException('Contact not found');
  }

  return contact;
}

async create(dto: CreateContactDto, currentUser: CurrentUser) {
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

    const contact = await tx.contact.create({
      data: {
        ...dto,
        organizationId: currentUser.organizationId,
      },
    });

    await tx.activityEvent.create({
      data: this.activityEventsService.buildCreateData(currentUser, {
        type: ActivityEventType.CONTACT_CREATED,
        entityType: EntityType.CONTACT,
        entityId: contact.id,
        title: `Contact created: ${contact.firstName} ${contact.lastName}`,
        description: contact.notes ?? undefined,
        source: contact.source,
        companyId: contact.companyId ?? undefined,
        contactId: contact.id,
        occurredAt: contact.createdAt,
      }),
    });

    return contact;
  });
}

  async update(id: string, dto: UpdateContactDto, currentUser: CurrentUser) {
    await this.findOne(id, currentUser);

    if (dto.companyId) {
      await this.validateCompanyBelongsToOrganization(
        dto.companyId,
        currentUser.organizationId,
      );
    }

    return this.prisma.contact.update({
      where: {
        id,
      },
      data: dto,
    });
  }

  async remove(id: string, currentUser: CurrentUser) {
    await this.findOne(id, currentUser);

    return this.prisma.contact.update({
      where: {
        id,
      },
      data: {
        deletedAt: new Date(),
      },
    });
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
}