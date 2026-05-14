import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CurrentUser } from '../auth/interfaces/current-user.interface';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';

@Injectable()
export class NotesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(currentUser: CurrentUser) {
    return this.prisma.note.findMany({
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
    const note = await this.prisma.note.findFirst({
      where: {
        id,
        organizationId: currentUser.organizationId,
        deletedAt: null,
      },
    });

    if (!note) {
      throw new NotFoundException('Note not found');
    }

    return note;
  }

  async create(dto: CreateNoteDto, currentUser: CurrentUser) {
    await this.validateRelations(dto, currentUser.organizationId);

    return this.prisma.note.create({
      data: {
        ...dto,
        organizationId: currentUser.organizationId,
        createdByUserId: currentUser.id,
      },
    });
  }

  async update(id: string, dto: UpdateNoteDto, currentUser: CurrentUser) {
    await this.findOne(id, currentUser);
    await this.validateRelations(dto, currentUser.organizationId);

    return this.prisma.note.update({
      where: {
        id,
      },
      data: dto,
    });
  }

  async remove(id: string, currentUser: CurrentUser) {
    await this.findOne(id, currentUser);

    return this.prisma.note.update({
      where: {
        id,
      },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  private async validateRelations(
    dto: CreateNoteDto | UpdateNoteDto,
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

    if (dto.leadId) {
      await this.validateLeadBelongsToOrganization(dto.leadId, organizationId);
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

  private async validateLeadBelongsToOrganization(
    leadId: string,
    organizationId: string,
  ) {
    const lead = await this.prisma.lead.findFirst({
      where: {
        id: leadId,
        organizationId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }
  }
}