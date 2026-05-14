import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CurrentUser } from '../auth/interfaces/current-user.interface';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(currentUser: CurrentUser) {
    return this.prisma.task.findMany({
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
    const task = await this.prisma.task.findFirst({
      where: {
        id,
        organizationId: currentUser.organizationId,
        deletedAt: null,
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    return task;
  }

  async create(dto: CreateTaskDto, currentUser: CurrentUser) {
    await this.validateRelations(dto, currentUser.organizationId);

    return this.prisma.task.create({
      data: {
        ...dto,
        organizationId: currentUser.organizationId,
      },
    });
  }

  async update(id: string, dto: UpdateTaskDto, currentUser: CurrentUser) {
    await this.findOne(id, currentUser);
    await this.validateRelations(dto, currentUser.organizationId);

    return this.prisma.task.update({
      where: {
        id,
      },
      data: dto,
    });
  }

  async remove(id: string, currentUser: CurrentUser) {
    await this.findOne(id, currentUser);

    return this.prisma.task.update({
      where: {
        id,
      },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  private async validateRelations(
    dto: CreateTaskDto | UpdateTaskDto,
    organizationId: string,
  ) {
    if (dto.leadId) {
      await this.validateLeadBelongsToOrganization(dto.leadId, organizationId);
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