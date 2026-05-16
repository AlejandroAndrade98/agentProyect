import { Injectable } from '@nestjs/common';
import {
  ActivityEventType,
  EntityType,
  Prisma,
  Source,
} from '@prisma/client';

import { CurrentUser } from '../auth/interfaces/current-user.interface';
import {
  buildPaginatedResult,
  getPaginationParams,
  normalizeSearch,
} from '../common/utils/pagination.util';
import { PrismaService } from '../database/prisma.service';
import { QueryActivityEventsDto } from './dto/query-activity-events.dto';


export type CreateActivityEventInput = {
  type: ActivityEventType;
  entityType: EntityType;
  entityId: string;
  title: string;
  description?: string;
  source?: Source;
  actorUserId?: string | null;
  companyId?: string;
  contactId?: string;
  leadId?: string;
  taskId?: string;
  noteId?: string;
  metadataJson?: Prisma.InputJsonValue;
  occurredAt?: Date;
};

@Injectable()
export class ActivityEventsService {
  constructor(private readonly prisma: PrismaService) {}

    buildCreateData(
    currentUser: CurrentUser,
    input: CreateActivityEventInput,
  ): Prisma.ActivityEventUncheckedCreateInput {
    return {
      organizationId: currentUser.organizationId,
      type: input.type,
      entityType: input.entityType,
      entityId: input.entityId,
      title: input.title,
      description: input.description,
      source: input.source ?? Source.MANUAL,
      actorUserId:
        input.actorUserId === undefined ? currentUser.id : input.actorUserId,
      companyId: input.companyId,
      contactId: input.contactId,
      leadId: input.leadId,
      taskId: input.taskId,
      noteId: input.noteId,
      metadataJson: input.metadataJson,
      occurredAt: input.occurredAt ?? new Date(),
    };
  }

  async createEvent(
    currentUser: CurrentUser,
    input: CreateActivityEventInput,
  ) {
    return this.prisma.activityEvent.create({
      data: this.buildCreateData(currentUser, input),
    });
  }

  async findAll(currentUser: CurrentUser, query: QueryActivityEventsDto) {
    const { skip, take, page, pageSize } = getPaginationParams(query);

    const search = normalizeSearch(query.search);

    const where: Prisma.ActivityEventWhereInput = {
      organizationId: currentUser.organizationId,
      ...(query.type ? { type: query.type } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(query.source ? { source: query.source } : {}),
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.contactId ? { contactId: query.contactId } : {}),
      ...(query.leadId ? { leadId: query.leadId } : {}),
      ...(query.taskId ? { taskId: query.taskId } : {}),
      ...(query.noteId ? { noteId: query.noteId } : {}),
      ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
      ...(query.from || query.to
        ? {
            occurredAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
      ...(search
        ? {
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
          }
        : {}),
    };

    const sortBy = query.sortBy ?? 'occurredAt';
    const sortOrder = query.sortOrder ?? 'desc';

    const [activityEvents, total] = await this.prisma.$transaction([
      this.prisma.activityEvent.findMany({
        where,
        orderBy: {
          [sortBy]: sortOrder,
        },
        skip,
        take,
        include: {
          actor: {
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
          },
        },
      }),
      this.prisma.activityEvent.count({ where }),
    ]);

    return buildPaginatedResult(activityEvents, total, page, pageSize);
  }
}