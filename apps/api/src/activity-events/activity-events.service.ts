import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { CurrentUser } from '../auth/interfaces/current-user.interface';
import {
  buildPaginatedResult,
  getPaginationParams,
  normalizeSearch,
} from '../common/utils/pagination.util';
import { PrismaService } from '../database/prisma.service';
import { QueryActivityEventsDto } from './dto/query-activity-events.dto';

@Injectable()
export class ActivityEventsService {
  constructor(private readonly prisma: PrismaService) {}

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