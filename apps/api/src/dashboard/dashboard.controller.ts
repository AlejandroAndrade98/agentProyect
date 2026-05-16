import { Controller, Get, UseGuards } from '@nestjs/common';

import { CRM_READ_ROLES } from '../auth/constants/role-groups';
import { CurrentUser as CurrentUserDecorator } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/interfaces/current-user.interface';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @Roles(...CRM_READ_ROLES)
  getSummary(@CurrentUserDecorator() currentUser: CurrentUser) {
    return this.dashboardService.getSummary(currentUser);
  }
}