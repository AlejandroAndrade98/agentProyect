import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';
import { CurrentUser } from '../auth/interfaces/current-user.interface';

const MAX_AI_CONTEXT_ACTIVITY_EVENTS = 5;
const MAX_AI_CONTEXT_NOTES = 5;
const MAX_AI_CONTEXT_TASKS = 10;

export type LeadNextStepsContext = {
  lead: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    importanceLevel: string;
    source: string;
    estimatedBudget: number | null;
    expectedCloseDate: Date | null;
    nextStep: string | null;
    lastContactAt: Date | null;
    pipelinePosition: number;
    statusChangedAt: Date;
    companyId: string | null;
    contactId: string | null;
    assignedToUserId: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  company: {
    id: string;
    name: string;
    industry: string | null;
    city: string | null;
    country: string | null;
    notes: string | null;
    importanceLevel: string;
  } | null;
  contact: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    jobTitle: string | null;
    notes: string | null;
    expertise: string | null;
    importanceLevel: string;
  } | null;
  assignedUser: {
    id: string;
    email: string;
    name: string;
    role: string;
  } | null;
  tasks: Array<{
    id: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    dueDate: Date | null;
    completedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
  notes: Array<{
    id: string;
    title: string | null;
    content: string;
    importanceLevel: string;
    source: string;
    createdAt: Date;
    updatedAt: Date;
  }>;
  activityEvents: Array<{
    id: string;
    type: string;
    title: string;
    description: string | null;
    source: string | null;
    occurredAt: Date;
    metadataJson: unknown;
  }>;
};

@Injectable()
export class LeadAiContextService {
  constructor(private readonly prisma: PrismaService) {}

  async buildLeadNextStepsContext(
    leadId: string,
    currentUser: CurrentUser,
  ): Promise<LeadNextStepsContext> {
    const lead = await this.prisma.lead.findFirst({
      where: {
        id: leadId,
        organizationId: currentUser.organizationId,
        deletedAt: null,
      },
      include: {
        company: true,
        contact: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
          },
        },
        tasks: {
          where: {
            deletedAt: null,
          },
          orderBy: [
            {
              status: 'asc',
            },
            {
              dueDate: 'asc',
            },
            {
              createdAt: 'desc',
            },
          ],
          take: MAX_AI_CONTEXT_TASKS,
        },
        linkedNotes: {
          where: {
            deletedAt: null,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: MAX_AI_CONTEXT_NOTES,
        },
      },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    const activityEvents = await this.prisma.activityEvent.findMany({
      where: {
        organizationId: currentUser.organizationId,
        leadId: lead.id,
      },
      orderBy: {
        occurredAt: 'desc',
      },
      take: MAX_AI_CONTEXT_ACTIVITY_EVENTS,
    });

    return {
      lead: {
        id: lead.id,
        title: lead.title,
        description: lead.description,
        status: lead.status,
        priority: lead.priority,
        importanceLevel: lead.importanceLevel,
        source: lead.source,
        estimatedBudget: lead.estimatedBudget,
        expectedCloseDate: lead.expectedCloseDate,
        nextStep: lead.nextStep,
        lastContactAt: lead.lastContactAt,
        pipelinePosition: lead.pipelinePosition,
        statusChangedAt: lead.statusChangedAt,
        companyId: lead.companyId,
        contactId: lead.contactId,
        assignedToUserId: lead.assignedToUserId,
        createdAt: lead.createdAt,
        updatedAt: lead.updatedAt,
      },
      company: lead.company
        ? {
            id: lead.company.id,
            name: lead.company.name,
            industry: lead.company.industry,
            city: lead.company.city,
            country: lead.company.country,
            notes: lead.company.notes,
            importanceLevel: lead.company.importanceLevel,
          }
        : null,
      contact: lead.contact
        ? {
            id: lead.contact.id,
            firstName: lead.contact.firstName,
            lastName: lead.contact.lastName,
            email: lead.contact.email,
            phone: lead.contact.phone,
            jobTitle: lead.contact.jobTitle,
            notes: lead.contact.notes,
            expertise: lead.contact.expertise,
            importanceLevel: lead.contact.importanceLevel,
          }
        : null,
      assignedUser: lead.user
        ? {
            id: lead.user.id,
            email: lead.user.email,
            name: lead.user.name,
            role: lead.user.role,
          }
        : null,
      tasks: lead.tasks.map((task) => ({
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        completedAt: task.completedAt,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      })),
      notes: lead.linkedNotes.map((note) => ({
        id: note.id,
        title: note.title,
        content: note.content,
        importanceLevel: note.importanceLevel,
        source: note.source,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
      })),
      activityEvents: activityEvents.map((event) => ({
        id: event.id,
        type: event.type,
        title: event.title,
        description: event.description,
        source: event.source,
        occurredAt: event.occurredAt,
        metadataJson: event.metadataJson,
      })),
    };
  }

  buildInputText(context: LeadNextStepsContext) {
    return JSON.stringify(
      {
        instruction:
          'Suggest next steps for this CRM lead. Do not apply any CRM changes automatically. Any task, note, email draft, or lead update requires human approval.',
        humanApprovalRequired: true,
        context,
      },
      null,
      2,
    );
  }
}
