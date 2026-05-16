import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { CurrentUser as CurrentUserDecorator } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CRM_READ_ROLES } from '../auth/constants/role-groups';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/interfaces/current-user.interface';
import { ActivityEventsService } from './activity-events.service';
import { QueryActivityEventsDto } from './dto/query-activity-events.dto';

@Controller('activity-events')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ActivityEventsController {
  constructor(private readonly activityEventsService: ActivityEventsService) {}

  @Get()
  @Roles(...CRM_READ_ROLES)
  findAll(
    @CurrentUserDecorator() currentUser: CurrentUser,
    @Query() query: QueryActivityEventsDto,
  ) {
    return this.activityEventsService.findAll(currentUser, query);
  }
}