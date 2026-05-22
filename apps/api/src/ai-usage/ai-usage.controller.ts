import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CRM_READ_ROLES } from '../auth/constants/role-groups';
import { CurrentUser as CurrentUserPayload } from '../auth/interfaces/current-user.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

import { AiUsageService } from './ai-usage.service';
import { QueryAiUsageRecordsDto } from './dto/query-ai-usage-records.dto';

@Controller('ai-usage')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AiUsageController {
  constructor(private readonly aiUsageService: AiUsageService) {}

  @Get('me')
  @Roles(...CRM_READ_ROLES)
  getMyUsage(@CurrentUser() currentUser: CurrentUserPayload) {
    return this.aiUsageService.getMyUsage(currentUser);
  }

  @Get('organization')
  @Roles(Role.SUPER_ADMIN, Role.OWNER, Role.ADMIN)
  getOrganizationUsage(@CurrentUser() currentUser: CurrentUserPayload) {
    return this.aiUsageService.getOrganizationUsage(currentUser);
  }

  @Get('records')
  @Roles(...CRM_READ_ROLES)
  findRecords(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Query() query: QueryAiUsageRecordsDto,
  ) {
    return this.aiUsageService.findRecords(currentUser, query);
  }
}