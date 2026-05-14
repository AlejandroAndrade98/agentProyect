import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CurrentUser } from '../auth/interfaces/current-user.interface';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

import { Prisma } from '@prisma/client';

import {
  buildPaginatedResult,
  getPaginationParams,
  normalizeSearch,
} from '../common/utils/pagination.util';
import { QueryContactsDto } from './dto/query-contacts.dto';

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

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

  async findOne(id: string, currentUser: CurrentUser) {
    const contact = await this.prisma.contact.findFirst({
      where: {
        id,
        organizationId: currentUser.organizationId,
        deletedAt: null,
      },
    });

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    return contact;
  }

  async create(dto: CreateContactDto, currentUser: CurrentUser) {
    if (dto.companyId) {
      await this.validateCompanyBelongsToOrganization(
        dto.companyId,
        currentUser.organizationId,
      );
    }

    return this.prisma.contact.create({
      data: {
        ...dto,
        organizationId: currentUser.organizationId,
      },
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