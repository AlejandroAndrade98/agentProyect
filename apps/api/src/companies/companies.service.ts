import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CurrentUser } from '../auth/interfaces/current-user.interface';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { Prisma } from '@prisma/client';
import {
  buildPaginatedResult,
  getPaginationParams,
  normalizeSearch,
} from '../common/utils/pagination.util';
import { QueryCompaniesDto } from './dto/query-companies.dto';

import { hasInclude, parseIncludeParam } from '../common/utils/include.util';
import { CompanyIncludeQueryDto } from './dto/company-include-query.dto';

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

async findAll(currentUser: CurrentUser, query: QueryCompaniesDto) {
  const { page, pageSize, skip, take } = getPaginationParams(query);
  const search = normalizeSearch(query.search);

  const where: Prisma.CompanyWhereInput = {
    organizationId: currentUser.organizationId,
    deletedAt: null,
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
    ...(query.industry && {
      industry: {
        contains: query.industry.trim(),
        mode: 'insensitive',
      },
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
          website: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          industry: {
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
      ],
    }),
  };

  const sortBy = query.sortBy ?? 'createdAt';
  const sortOrder = query.sortOrder ?? 'desc';

  const orderBy: Prisma.CompanyOrderByWithRelationInput = {
    [sortBy]: sortOrder,
  };

  const [data, total] = await this.prisma.$transaction([
    this.prisma.company.findMany({
      where,
      orderBy,
      skip,
      take,
    }),
    this.prisma.company.count({
      where,
    }),
  ]);

  return buildPaginatedResult(data, total, page, pageSize);
}

async findOne(
  id: string,
  currentUser: CurrentUser,
  query?: CompanyIncludeQueryDto,
) {
  const includes = parseIncludeParam(query?.include, [
    'contacts',
    'leads',
    'notes',
  ] as const);

  const company = await this.prisma.company.findFirst({
    where: {
      id,
      organizationId: currentUser.organizationId,
      deletedAt: null,
    },
    include: {
      contacts: hasInclude(includes, 'contacts')
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

  if (!company) {
    throw new NotFoundException('Company not found');
  }

  return company;
}

  async create(dto: CreateCompanyDto, currentUser: CurrentUser) {
    return this.prisma.company.create({
      data: {
        ...dto,
        organizationId: currentUser.organizationId,
      },
    });
  }

  async update(id: string, dto: UpdateCompanyDto, currentUser: CurrentUser) {
    await this.findOne(id, currentUser);

    return this.prisma.company.update({
      where: {
        id,
      },
      data: dto,
    });
  }

  async remove(id: string, currentUser: CurrentUser) {
    await this.findOne(id, currentUser);

    return this.prisma.company.update({
      where: {
        id,
      },
      data: {
        deletedAt: new Date(),
      },
    });
  }
}