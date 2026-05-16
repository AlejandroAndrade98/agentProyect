import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CurrentUser } from '../auth/interfaces/current-user.interface';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

import { ActivityEventType, EntityType, Prisma, TaskStatus} from '@prisma/client';

import {
  buildPaginatedResult,
  getPaginationParams,
  normalizeSearch,
} from '../common/utils/pagination.util';
import { QueryTasksDto } from './dto/query-tasks.dto';

import { hasInclude, parseIncludeParam } from '../common/utils/include.util';
import { TaskIncludeQueryDto } from './dto/task-include-query.dto';
import { ActivityEventsService } from '../activity-events/activity-events.service';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityEventsService: ActivityEventsService,
  ) {}

async findAll(currentUser: CurrentUser, query: QueryTasksDto) {
  const { page, pageSize, skip, take } = getPaginationParams(query);
  const search = normalizeSearch(query.search);

  const where: Prisma.TaskWhereInput = {
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
    ...(query.leadId && {
      leadId: query.leadId,
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
      ],
    }),
  };

  const sortBy = query.sortBy ?? 'createdAt';
  const sortOrder = query.sortOrder ?? 'desc';

  const orderBy: Prisma.TaskOrderByWithRelationInput = {
    [sortBy]: sortOrder,
  };

  const [data, total] = await this.prisma.$transaction([
    this.prisma.task.findMany({
      where,
      orderBy,
      skip,
      take,
    }),
    this.prisma.task.count({
      where,
    }),
  ]);

  return buildPaginatedResult(data, total, page, pageSize);
}

async findOne(
  id: string,
  currentUser: CurrentUser,
  query?: TaskIncludeQueryDto,
) {
  const includes = parseIncludeParam(query?.include, [
    'lead',
    'contact',
    'assignedUser',
  ] as const);

  const task = await this.prisma.task.findFirst({
    where: {
      id,
      organizationId: currentUser.organizationId,
      deletedAt: null,
    },
    include: {
      lead: hasInclude(includes, 'lead'),
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
    },
  });

  if (!task) {
    throw new NotFoundException('Task not found');
  }

  return task;
}

async create(dto: CreateTaskDto, currentUser: CurrentUser) {
  return this.prisma.$transaction(async (tx) => {
    if (dto.leadId) {
      const lead = await tx.lead.findFirst({
        where: {
          id: dto.leadId,
          organizationId: currentUser.organizationId,
          deletedAt: null,
        },
      });

      if (!lead) {
        throw new NotFoundException('Lead not found');
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

    const task = await tx.task.create({
      data: {
        ...dto,
        organizationId: currentUser.organizationId,
      },
    });

    await tx.activityEvent.create({
      data: this.activityEventsService.buildCreateData(currentUser, {
        type: ActivityEventType.TASK_CREATED,
        entityType: EntityType.TASK,
        entityId: task.id,
        title: `Task created: ${task.title}`,
        description: task.description ?? undefined,
        source: undefined,
        contactId: task.contactId ?? undefined,
        leadId: task.leadId ?? undefined,
        taskId: task.id,
        occurredAt: task.createdAt,
        metadataJson: {
          status: task.status,
          priority: task.priority,
          dueDate: task.dueDate,
        },
      }),
    });

    return task;
  });
}

async update(id: string, dto: UpdateTaskDto, currentUser: CurrentUser) {
  const existingTask = await this.findOne(id, currentUser);

  await this.validateRelations(dto, currentUser.organizationId);

  const wasCompleted = existingTask.status === TaskStatus.COMPLETED;
  const willBeCompleted = dto.status === TaskStatus.COMPLETED;
  const statusIsChanging = dto.status !== undefined;

  const becameCompleted = !wasCompleted && willBeCompleted;
  const leftCompleted =
    wasCompleted && statusIsChanging && dto.status !== TaskStatus.COMPLETED;

  const updateData: Prisma.TaskUpdateInput = {
    ...dto,
  };

  if (becameCompleted) {
    updateData.completedAt = dto.completedAt ?? new Date();
  }

  if (leftCompleted) {
    updateData.completedAt = null;
  }

  return this.prisma.$transaction(async (tx) => {
    const task = await tx.task.update({
      where: {
        id,
      },
      data: updateData,
    });

    if (becameCompleted) {
      await tx.activityEvent.create({
        data: this.activityEventsService.buildCreateData(currentUser, {
          type: ActivityEventType.TASK_COMPLETED,
          entityType: EntityType.TASK,
          entityId: task.id,
          title: `Task completed: ${task.title}`,
          description: task.description ?? undefined,
          source: undefined,
          contactId: task.contactId ?? undefined,
          leadId: task.leadId ?? undefined,
          taskId: task.id,
          occurredAt: task.completedAt ?? new Date(),
          metadataJson: {
            previousStatus: existingTask.status,
            newStatus: task.status,
            completedAt: task.completedAt,
            priority: task.priority,
          },
        }),
      });
    }

    return task;
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