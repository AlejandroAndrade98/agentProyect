import { Prisma } from '@prisma/client';

import {
  buildPaginatedResult,
  getPaginationParams,
  normalizeSearch,
} from '../common/utils/pagination.util';
import { QueryProductsDto } from './dto/query-products.dto';

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CurrentUser } from '../auth/interfaces/current-user.interface';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

async findAll(currentUser: CurrentUser, query: QueryProductsDto) {
  const { page, pageSize, skip, take } = getPaginationParams(query);
  const search = normalizeSearch(query.search);

  const where: Prisma.ProductWhereInput = {
    organizationId: currentUser.organizationId,
    deletedAt: null,
    ...(query.category && {
      category: {
        contains: query.category.trim(),
        mode: 'insensitive',
      },
    }),
    ...(query.isActive !== undefined && {
      isActive: query.isActive,
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
          description: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          category: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ],
    }),
  };

  const sortBy = query.sortBy ?? 'createdAt';
  const sortOrder = query.sortOrder ?? 'desc';

  const orderBy: Prisma.ProductOrderByWithRelationInput = {
    [sortBy]: sortOrder,
  };

  const [data, total] = await this.prisma.$transaction([
    this.prisma.product.findMany({
      where,
      orderBy,
      skip,
      take,
    }),
    this.prisma.product.count({
      where,
    }),
  ]);

  return buildPaginatedResult(data, total, page, pageSize);
}

  async findOne(id: string, currentUser: CurrentUser) {
    const product = await this.prisma.product.findFirst({
      where: {
        id,
        organizationId: currentUser.organizationId,
        deletedAt: null,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async create(dto: CreateProductDto, currentUser: CurrentUser) {
    return this.prisma.product.create({
      data: {
        ...dto,
        organizationId: currentUser.organizationId,
      },
    });
  }

  async update(id: string, dto: UpdateProductDto, currentUser: CurrentUser) {
    await this.findOne(id, currentUser);

    return this.prisma.product.update({
      where: {
        id,
      },
      data: dto,
    });
  }

  async remove(id: string, currentUser: CurrentUser) {
    await this.findOne(id, currentUser);

    return this.prisma.product.update({
      where: {
        id,
      },
      data: {
        deletedAt: new Date(),
      },
    });
  }
}