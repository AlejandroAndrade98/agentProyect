import { Injectable } from '@nestjs/common';
import { LeadStatus, TaskStatus } from '@prisma/client';

import { CurrentUser } from '../auth/interfaces/current-user.interface';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(currentUser: CurrentUser) {
    const organizationId = currentUser.organizationId;

    const now = new Date();

    const [
      companiesTotal,
      contactsTotal,
      leadsTotal,
      leadsOpen,
      leadsWon,
      leadsLost,
      tasksTotal,
      tasksPending,
      tasksCompleted,
      tasksOverdue,
      recentActivityTotal,
    ] = await this.prisma.$transaction([
      this.prisma.company.count({
        where: {
          organizationId,
          deletedAt: null,
        },
      }),

      this.prisma.contact.count({
        where: {
          organizationId,
          deletedAt: null,
        },
      }),

      this.prisma.lead.count({
        where: {
          organizationId,
          deletedAt: null,
        },
      }),

      this.prisma.lead.count({
        where: {
          organizationId,
          deletedAt: null,
          status: {
            notIn: [LeadStatus.WON, LeadStatus.LOST, LeadStatus.ARCHIVED],
          },
        },
      }),

      this.prisma.lead.count({
        where: {
          organizationId,
          deletedAt: null,
          status: LeadStatus.WON,
        },
      }),

      this.prisma.lead.count({
        where: {
          organizationId,
          deletedAt: null,
          status: LeadStatus.LOST,
        },
      }),

      this.prisma.task.count({
        where: {
          organizationId,
          deletedAt: null,
        },
      }),

      this.prisma.task.count({
        where: {
          organizationId,
          deletedAt: null,
          status: {
            in: [TaskStatus.TODO, TaskStatus.IN_PROGRESS],
          },
        },
      }),

      this.prisma.task.count({
        where: {
          organizationId,
          deletedAt: null,
          status: TaskStatus.COMPLETED,
        },
      }),

      this.prisma.task.count({
        where: {
          organizationId,
          deletedAt: null,
          dueDate: {
            lt: now,
          },
          status: {
            notIn: [
              TaskStatus.COMPLETED,
              TaskStatus.CANCELLED,
              TaskStatus.ARCHIVED,
            ],
          },
        },
      }),

      this.prisma.activityEvent.count({
        where: {
          organizationId,
        },
      }),
    ]);

    return {
      companies: {
        total: companiesTotal,
      },
      contacts: {
        total: contactsTotal,
      },
      leads: {
        total: leadsTotal,
        open: leadsOpen,
        won: leadsWon,
        lost: leadsLost,
      },
      tasks: {
        total: tasksTotal,
        pending: tasksPending,
        completed: tasksCompleted,
        overdue: tasksOverdue,
      },
      activityEvents: {
        total: recentActivityTotal,
      },
    };
  }
}