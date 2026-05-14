import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CurrentUser } from '../auth/interfaces/current-user.interface';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(currentUser: CurrentUser) {
    return this.prisma.contact.findMany({
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