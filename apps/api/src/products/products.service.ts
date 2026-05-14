import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CurrentUser } from '../auth/interfaces/current-user.interface';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(currentUser: CurrentUser) {
    return this.prisma.product.findMany({
      where: {
        organizationId: currentUser.organizationId,
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
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