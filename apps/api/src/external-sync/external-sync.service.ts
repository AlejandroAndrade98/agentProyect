import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../database/prisma.service';
import { QueryExternalCalendarEventsDto } from './dto/query-external-calendar-events.dto';
import { QueryExternalEmailMessagesDto } from './dto/query-external-email-messages.dto';
import type { CurrentUser as CurrentUserType } from '../auth/interfaces/current-user.interface';

type ExternalSyncCurrentUser = {
  organizationId: string;
};

@Injectable()
export class ExternalSyncService {
  constructor(private readonly prisma: PrismaService) {}

    async findEmailMessages(
    currentUser: CurrentUserType,
    query: QueryExternalEmailMessagesDto,
    ) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.ExternalEmailMessageWhereInput = {
      organizationId: currentUser.organizationId,
      deletedAt: null,
      ...(query.connectedAccountId
        ? { connectedAccountId: query.connectedAccountId }
        : {}),
      ...(query.externalThreadId
        ? { externalThreadId: query.externalThreadId }
        : {}),
      ...(query.fromEmail
        ? {
            fromEmail: {
              contains: query.fromEmail,
              mode: 'insensitive',
            },
          }
        : {}),
      ...(query.internalDateFrom || query.internalDateTo
        ? {
            internalDate: {
              ...(query.internalDateFrom
                ? { gte: new Date(query.internalDateFrom) }
                : {}),
              ...(query.internalDateTo
                ? { lte: new Date(query.internalDateTo) }
                : {}),
            },
          }
        : {}),
      ...(query.q
        ? {
            OR: [
              {
                subject: {
                  contains: query.q,
                  mode: 'insensitive',
                },
              },
              {
                snippet: {
                  contains: query.q,
                  mode: 'insensitive',
                },
              },
              {
                fromEmail: {
                  contains: query.q,
                  mode: 'insensitive',
                },
              },
              {
                fromName: {
                  contains: query.q,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.externalEmailMessage.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [{ internalDate: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          organizationId: true,
          connectedAccountId: true,
          provider: true,
          externalMessageId: true,
          externalThreadId: true,
          subject: true,
          snippet: true,
          fromEmail: true,
          fromName: true,
          toEmailsJson: true,
          ccEmailsJson: true,
          bccEmailsJson: true,
          labelIdsJson: true,
          internalDate: true,
          metadataJson: true,
          syncedAt: true,
          createdAt: true,
          updatedAt: true,
          connectedAccount: {
            select: {
              id: true,
              provider: true,
              email: true,
              displayName: true,
              status: true,
              user: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                  role: true,
                  isActive: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.externalEmailMessage.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        pageSize,
        total,
        pageCount: Math.ceil(total / pageSize),
      },
    };
  }

    async findCalendarEvents(
    currentUser: CurrentUserType,
    query: QueryExternalCalendarEventsDto,
    ) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.ExternalCalendarEventWhereInput = {
      organizationId: currentUser.organizationId,
      deletedAt: null,
      ...(query.connectedAccountId
        ? { connectedAccountId: query.connectedAccountId }
        : {}),
      ...(query.externalCalendarId
        ? { externalCalendarId: query.externalCalendarId }
        : {}),
      ...(query.startFrom || query.startTo
        ? {
            startAt: {
              ...(query.startFrom ? { gte: new Date(query.startFrom) } : {}),
              ...(query.startTo ? { lte: new Date(query.startTo) } : {}),
            },
          }
        : {}),
      ...(query.q
        ? {
            OR: [
              {
                summary: {
                  contains: query.q,
                  mode: 'insensitive',
                },
              },
              {
                description: {
                  contains: query.q,
                  mode: 'insensitive',
                },
              },
              {
                location: {
                  contains: query.q,
                  mode: 'insensitive',
                },
              },
              {
                organizerEmail: {
                  contains: query.q,
                  mode: 'insensitive',
                },
              },
              {
                organizerName: {
                  contains: query.q,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.externalCalendarEvent.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [{ startAt: 'asc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          organizationId: true,
          connectedAccountId: true,
          provider: true,
          externalCalendarId: true,
          externalEventId: true,
          iCalUid: true,
          status: true,
          summary: true,
          description: true,
          location: true,
          startAt: true,
          endAt: true,
          isAllDay: true,
          organizerEmail: true,
          organizerName: true,
          attendeesJson: true,
          htmlLink: true,
          metadataJson: true,
          syncedAt: true,
          createdAt: true,
          updatedAt: true,
          connectedAccount: {
            select: {
              id: true,
              provider: true,
              email: true,
              displayName: true,
              status: true,
              user: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                  role: true,
                  isActive: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.externalCalendarEvent.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        pageSize,
        total,
        pageCount: Math.ceil(total / pageSize),
      },
    };
  }
}