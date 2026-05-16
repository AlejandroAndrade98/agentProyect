import { Injectable } from '@nestjs/common';
import { LeadStatus, Prisma, Priority, TaskStatus } from '@prisma/client';

import { CurrentUser } from '../auth/interfaces/current-user.interface';
import { PrismaService } from '../database/prisma.service';

import { QueryDashboardRecentActivityDto } from './dto/query-dashboard-recent-activity.dto';

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

    async getLeadsOverview(currentUser: CurrentUser) {
    const organizationId = currentUser.organizationId;

    const leadStatusValues = Object.values(LeadStatus);
    const leadPriorityValues = Object.values(Priority);

    const [statusCounts, priorityCounts, recentLeads] = await Promise.all([
      Promise.all(
        leadStatusValues.map((status) =>
          this.prisma.lead.count({
            where: {
              organizationId,
              deletedAt: null,
              status,
            },
          }),
        ),
      ),

      Promise.all(
        leadPriorityValues.map((priority) =>
          this.prisma.lead.count({
            where: {
              organizationId,
              deletedAt: null,
              priority,
            },
          }),
        ),
      ),

      this.prisma.lead.findMany({
        where: {
          organizationId,
          deletedAt: null,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 5,
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          importanceLevel: true,
          source: true,
          estimatedBudget: true,
          expectedCloseDate: true,
          nextStep: true,
          lastContactAt: true,
          createdAt: true,
          updatedAt: true,
          company: {
            select: {
              id: true,
              name: true,
            },
          },
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          user: {
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
    ]);

    const leadsByStatus = leadStatusValues.map((status, index) => ({
      status,
      count: statusCounts[index] ?? 0,
    }));

    const leadsByPriority = leadPriorityValues.map((priority, index) => ({
      priority,
      count: priorityCounts[index] ?? 0,
    }));

    return {
      leadsByStatus,
      leadsByPriority,
      recentLeads,
    };
  }

  async getTasksOverview(currentUser: CurrentUser) {
    const organizationId = currentUser.organizationId;

    const now = new Date();
    const sevenDaysFromNow = new Date(now);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const taskStatusValues = Object.values(TaskStatus);
    const taskPriorityValues = Object.values(Priority);

    const [
      statusCounts,
      priorityCounts,
      pendingTasks,
      overdueTasks,
      dueSoonTasks,
      recentlyCompletedTasks,
    ] = await Promise.all([
      Promise.all(
        taskStatusValues.map((status) =>
          this.prisma.task.count({
            where: {
              organizationId,
              deletedAt: null,
              status,
            },
          }),
        ),
      ),

      Promise.all(
        taskPriorityValues.map((priority) =>
          this.prisma.task.count({
            where: {
              organizationId,
              deletedAt: null,
              priority,
            },
          }),
        ),
      ),

      this.prisma.task.findMany({
        where: {
          organizationId,
          deletedAt: null,
          status: {
            in: [TaskStatus.TODO, TaskStatus.IN_PROGRESS],
          },
        },
        orderBy: [
          {
            dueDate: 'asc',
          },
          {
            createdAt: 'desc',
          },
        ],
        take: 5,
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          priority: true,
          importanceLevel: true,
          dueDate: true,
          completedAt: true,
          createdAt: true,
          updatedAt: true,
          lead: {
            select: {
              id: true,
              title: true,
              status: true,
              priority: true,
            },
          },
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          user: {
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

      this.prisma.task.findMany({
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
        orderBy: {
          dueDate: 'asc',
        },
        take: 5,
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          priority: true,
          importanceLevel: true,
          dueDate: true,
          completedAt: true,
          createdAt: true,
          updatedAt: true,
          lead: {
            select: {
              id: true,
              title: true,
              status: true,
              priority: true,
            },
          },
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          user: {
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

      this.prisma.task.findMany({
        where: {
          organizationId,
          deletedAt: null,
          dueDate: {
            gte: now,
            lte: sevenDaysFromNow,
          },
          status: {
            notIn: [
              TaskStatus.COMPLETED,
              TaskStatus.CANCELLED,
              TaskStatus.ARCHIVED,
            ],
          },
        },
        orderBy: {
          dueDate: 'asc',
        },
        take: 5,
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          priority: true,
          importanceLevel: true,
          dueDate: true,
          completedAt: true,
          createdAt: true,
          updatedAt: true,
          lead: {
            select: {
              id: true,
              title: true,
              status: true,
              priority: true,
            },
          },
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          user: {
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

      this.prisma.task.findMany({
        where: {
          organizationId,
          deletedAt: null,
          status: TaskStatus.COMPLETED,
        },
        orderBy: {
          completedAt: 'desc',
        },
        take: 5,
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          priority: true,
          importanceLevel: true,
          dueDate: true,
          completedAt: true,
          createdAt: true,
          updatedAt: true,
          lead: {
            select: {
              id: true,
              title: true,
              status: true,
              priority: true,
            },
          },
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          user: {
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
    ]);

    const tasksByStatus = taskStatusValues.map((status, index) => ({
      status,
      count: statusCounts[index] ?? 0,
    }));

    const tasksByPriority = taskPriorityValues.map((priority, index) => ({
      priority,
      count: priorityCounts[index] ?? 0,
    }));

    return {
      tasksByStatus,
      tasksByPriority,
      pendingTasks,
      overdueTasks,
      dueSoonTasks,
      recentlyCompletedTasks,
    };
  }

    async getRecentActivity(
    currentUser: CurrentUser,
    query: QueryDashboardRecentActivityDto,
  ) {
    const organizationId = currentUser.organizationId;
    const limit = query.limit ?? 10;

    const where: Prisma.ActivityEventWhereInput = {
      organizationId,
      ...(query.type ? { type: query.type } : {}),
    };

    const recentActivity = await this.prisma.activityEvent.findMany({
      where,
      orderBy: {
        occurredAt: 'desc',
      },
      take: limit,
      select: {
        id: true,
        type: true,
        entityType: true,
        entityId: true,
        title: true,
        description: true,
        source: true,
        companyId: true,
        contactId: true,
        leadId: true,
        taskId: true,
        noteId: true,
        metadataJson: true,
        occurredAt: true,
        createdAt: true,
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
    });

    return {
      recentActivity,
    };
  }
}