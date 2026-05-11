import { Injectable, NotFoundException } from '@nestjs/common';
import type { CurrentUser } from '../auth/interfaces/current-user.interface';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrent(currentUser: CurrentUser) {
    const organization = await this.prisma.organization.findFirst({
      where: {
        id: currentUser.organizationId,
        deletedAt: null,
        archivedAt: null,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        industry: true,
        plan: true,
        maxUsers: true,
        maxActiveLeads: true,
        maxAiRequestsPerMonth: true,
        maxStorageMb: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return organization;
  }
}