import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CurrentUser } from '../auth/interfaces/current-user.interface';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(currentUser: CurrentUser) {
    return this.prisma.company.findMany({
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
    const company = await this.prisma.company.findFirst({
      where: {
        id,
        organizationId: currentUser.organizationId,
        deletedAt: null,
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