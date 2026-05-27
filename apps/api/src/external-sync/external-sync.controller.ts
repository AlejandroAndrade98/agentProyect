import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  CRM_READ_ROLES,
  CRM_WRITE_ROLES,
} from '../auth/constants/role-groups';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { CurrentUser as CurrentUserType } from '../auth/interfaces/current-user.interface';
import { QueryExternalCalendarEventsDto } from './dto/query-external-calendar-events.dto';
import { QueryExternalEmailMessagesDto } from './dto/query-external-email-messages.dto';
import { ExternalSyncService } from './external-sync.service';

@Controller('external-sync')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...CRM_READ_ROLES)
export class ExternalSyncController {
  constructor(private readonly externalSyncService: ExternalSyncService) {}

  @Post('email-messages/sync')
  @Roles(...CRM_WRITE_ROLES)
  syncGmailMessages(@CurrentUser() currentUser: CurrentUserType) {
    return this.externalSyncService.syncGmailMessages(currentUser);
  } 

  @Get('email-messages')
  findEmailMessages(
    @CurrentUser() currentUser: CurrentUserType,
    @Query() query: QueryExternalEmailMessagesDto,
  ) {
    return this.externalSyncService.findEmailMessages(currentUser, query);
  }

  @Get('calendar-events')
  findCalendarEvents(
    @CurrentUser() currentUser: CurrentUserType,
    @Query() query: QueryExternalCalendarEventsDto,
  ) {
    return this.externalSyncService.findCalendarEvents(currentUser, query);
  }
}