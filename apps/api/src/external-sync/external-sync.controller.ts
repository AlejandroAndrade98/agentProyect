import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  CRM_READ_ROLES,
  CRM_WRITE_ROLES,
} from '../auth/constants/role-groups';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { CurrentUser as CurrentUserType } from '../auth/interfaces/current-user.interface';
import { RateLimit } from '../common/security/rate-limit.decorator';
import { RateLimitGuard } from '../common/security/rate-limit.guard';
import { DismissExternalEmailMessageDto } from './dto/dismiss-external-email-message.dto';
import { GmailSearchPreviewDto } from './dto/gmail-search-preview.dto';
import { ImportSelectedEmailMessagesDto } from './dto/import-selected-email-messages.dto';
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
  @RateLimit({
    name: 'externalSync.emailMessagesSync',
    windowMs: 60 * 60 * 1000,
    max: 10,
    keyBy: 'userOrIp',
  })
  @UseGuards(RateLimitGuard)
  syncGmailMessages(@CurrentUser() currentUser: CurrentUserType) {
    return this.externalSyncService.syncGmailMessages(currentUser);
  }   

  @Post('email-messages/gmail-search-preview')
  @Roles(...CRM_WRITE_ROLES)
  @RateLimit({
    name: 'externalSync.emailMessagesGmailSearchPreview',
    windowMs: 15 * 60 * 1000,
    max: 30,
    keyBy: 'userOrIp',
  })
  @UseGuards(RateLimitGuard)
  searchGmailMessagesPreview(
    @CurrentUser() currentUser: CurrentUserType,
    @Body() dto: GmailSearchPreviewDto,
  ) {
    return this.externalSyncService.searchGmailMessagesPreview(
      currentUser,
      dto,
    );
  }

  @Post('email-messages/import-selected')
  @Roles(...CRM_WRITE_ROLES)
  @RateLimit({
    name: 'externalSync.emailMessagesImportSelected',
    windowMs: 15 * 60 * 1000,
    max: 10,
    keyBy: 'userOrIp',
  })
  @UseGuards(RateLimitGuard)
  importSelectedGmailMessages(
    @CurrentUser() currentUser: CurrentUserType,
    @Body() dto: ImportSelectedEmailMessagesDto,
  ) {
    return this.externalSyncService.importSelectedGmailMessages(
      currentUser,
      dto,
    );
  }

  @Post('calendar-events/sync')
  @Roles(...CRM_WRITE_ROLES)
  @RateLimit({
    name: 'externalSync.calendarEventsSync',
    windowMs: 60 * 60 * 1000,
    max: 10,
    keyBy: 'userOrIp',
  })
  @UseGuards(RateLimitGuard)
  syncGoogleCalendarEvents(@CurrentUser() currentUser: CurrentUserType) {
    return this.externalSyncService.syncGoogleCalendarEvents(currentUser);
  }

  @Get('email-messages')
  findEmailMessages(
    @CurrentUser() currentUser: CurrentUserType,
    @Query() query: QueryExternalEmailMessagesDto,
  ) {
    return this.externalSyncService.findEmailMessages(currentUser, query);
  }

  @Patch('email-messages/:id/dismiss')
  @Roles(...CRM_WRITE_ROLES)
  @RateLimit({
    name: 'externalSync.emailMessageDismiss',
    windowMs: 15 * 60 * 1000,
    max: 60,
    keyBy: 'userOrIp',
  })
  @UseGuards(RateLimitGuard)
  dismissEmailMessage(
    @CurrentUser() currentUser: CurrentUserType,
    @Param('id') id: string,
    @Body() dto: DismissExternalEmailMessageDto,
  ) {
    return this.externalSyncService.dismissEmailMessage(currentUser, id, dto);
  }

  @Patch('email-messages/:id/restore')
  @Roles(...CRM_WRITE_ROLES)
  @RateLimit({
    name: 'externalSync.emailMessageRestore',
    windowMs: 15 * 60 * 1000,
    max: 60,
    keyBy: 'userOrIp',
  })
  @UseGuards(RateLimitGuard)
  restoreEmailMessage(
    @CurrentUser() currentUser: CurrentUserType,
    @Param('id') id: string,
  ) {
    return this.externalSyncService.restoreEmailMessage(currentUser, id);
  }

  @Get('calendar-events')
  findCalendarEvents(
    @CurrentUser() currentUser: CurrentUserType,
    @Query() query: QueryExternalCalendarEventsDto,
  ) {
    return this.externalSyncService.findCalendarEvents(currentUser, query);
  }
}
