import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CurrentUser } from '../auth/interfaces/current-user.interface';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';

import { ActivityEventType, EntityType, Prisma } from '@prisma/client';

import {
  buildPaginatedResult,
  getPaginationParams,
  normalizeSearch,
} from '../common/utils/pagination.util';
import { QueryNotesDto } from './dto/query-notes.dto';

import { hasInclude, parseIncludeParam } from '../common/utils/include.util';
import { NoteIncludeQueryDto } from './dto/note-include-query.dto';
import { ActivityEventsService } from '../activity-events/activity-events.service';

@Injectable()
export class NotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityEventsService: ActivityEventsService,
  ) {}

async findAll(currentUser: CurrentUser, query: QueryNotesDto) {
  const { page, pageSize, skip, take } = getPaginationParams(query);
  const search = normalizeSearch(query.search);

  const where: Prisma.NoteWhereInput = {
    organizationId: currentUser.organizationId,
    deletedAt: null,
    ...(query.importanceLevel && {
      importanceLevel: query.importanceLevel,
    }),
    ...(query.source && {
      source: query.source,
    }),
    ...(query.companyId && {
      companyId: query.companyId,
    }),
    ...(query.contactId && {
      contactId: query.contactId,
    }),
    ...(query.leadId && {
      leadId: query.leadId,
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
          content: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ],
    }),
  };

  const sortBy = query.sortBy ?? 'createdAt';
  const sortOrder = query.sortOrder ?? 'desc';

  const orderBy: Prisma.NoteOrderByWithRelationInput = {
    [sortBy]: sortOrder,
  };

  const [data, total] = await this.prisma.$transaction([
    this.prisma.note.findMany({
      where,
      orderBy,
      skip,
      take,
    }),
    this.prisma.note.count({
      where,
    }),
  ]);

  return buildPaginatedResult(data, total, page, pageSize);
}

  async findOne(
    id: string,
    currentUser: CurrentUser,
    query?: NoteIncludeQueryDto,
  ) {
    const includes = parseIncludeParam(query?.include, [
      'company',
      'contact',
      'lead',
      'createdBy',
    ] as const);

    const note = await this.prisma.note.findFirst({
      where: {
        id,
        organizationId: currentUser.organizationId,
        deletedAt: null,
      },
      include: {
        company: hasInclude(includes, 'company'),
        contact: hasInclude(includes, 'contact'),
        lead: hasInclude(includes, 'lead'),
        createdBy: hasInclude(includes, 'createdBy')
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

    if (!note) {
      throw new NotFoundException('Note not found');
    }

    return note;
  }

async create(dto: CreateNoteDto, currentUser: CurrentUser) {
  return this.prisma.$transaction(async (tx) => {
    if (dto.companyId) {
      const company = await tx.company.findFirst({
        where: {
          id: dto.companyId,
          organizationId: currentUser.organizationId,
          deletedAt: null,
        },
      });

      if (!company) {
        throw new NotFoundException('Company not found');
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

    const note = await tx.note.create({
      data: {
        ...dto,
        organizationId: currentUser.organizationId,
        createdByUserId: currentUser.id,
      },
    });

    await tx.activityEvent.create({
      data: this.activityEventsService.buildCreateData(currentUser, {
        type: ActivityEventType.NOTE_CREATED,
        entityType: EntityType.NOTE,
        entityId: note.id,
        title: note.title
          ? `Note created: ${note.title}`
          : 'Note created',
        description: note.content,
        source: note.source,
        companyId: note.companyId ?? undefined,
        contactId: note.contactId ?? undefined,
        leadId: note.leadId ?? undefined,
        noteId: note.id,
        occurredAt: note.createdAt,
        metadataJson: {
          importanceLevel: note.importanceLevel,
        },
      }),
    });

    return note;
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