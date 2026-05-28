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
import { CurrentUser as CurrentUserPayload } from '../auth/interfaces/current-user.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  CRM_READ_ROLES,
  CRM_WRITE_ROLES,
} from '../auth/constants/role-groups';

import { AiSuggestionsService } from './ai-suggestions.service';
import { QueryAiSuggestionsDto } from './dto/query-ai-suggestions.dto';

import { ReviewAiSuggestionDto } from './dto/review-ai-suggestion.dto';

import { ApplyLeadNextStepDto } from './dto/apply-lead-next-step.dto';
import { ApplySuggestedNoteDto } from './dto/apply-suggested-note.dto';
import { ApplySuggestedTaskDto } from './dto/apply-suggested-task.dto';

@Controller('ai-suggestions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AiSuggestionsController {
  constructor(private readonly aiSuggestionsService: AiSuggestionsService) {}

  @Get()
  @Roles(...CRM_READ_ROLES)
  findAll(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Query() query: QueryAiSuggestionsDto,
  ) {
    return this.aiSuggestionsService.findAll(currentUser, query);
  }

  @Get(':id')
  @Roles(...CRM_READ_ROLES)
  findOne(
    @Param('id') id: string,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.aiSuggestionsService.findOne(id, currentUser);
  }

  @Post('leads/:leadId/next-steps')
  @Roles(...CRM_WRITE_ROLES)
  generateLeadNextSteps(
    @Param('leadId') leadId: string,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.aiSuggestionsService.generateLeadNextSteps(
      leadId,
      currentUser,
    );
  }

  @Post('external-sync/email-messages/:emailMessageId/analyze')
  @Roles(...CRM_WRITE_ROLES)
  analyzeExternalEmailMessage(
    @Param('emailMessageId') emailMessageId: string,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.aiSuggestionsService.analyzeExternalEmailMessage(
      emailMessageId,
      currentUser,
    );
  }

  @Post('external-sync/calendar-events/:calendarEventId/analyze')
  @Roles(...CRM_WRITE_ROLES)
  analyzeExternalCalendarEvent(
    @Param('calendarEventId') calendarEventId: string,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.aiSuggestionsService.analyzeExternalCalendarEvent(
      calendarEventId,
      currentUser,
    );
  }

  @Patch(':id/accept')
  @Roles(...CRM_WRITE_ROLES)
  accept(
    @Param('id') id: string,
    @CurrentUser() currentUser: CurrentUserPayload,
    @Body() dto: ReviewAiSuggestionDto,
  ) {
    return this.aiSuggestionsService.accept(id, currentUser, dto);
  }

  @Patch(':id/reject')
  @Roles(...CRM_WRITE_ROLES)
  reject(
    @Param('id') id: string,
    @CurrentUser() currentUser: CurrentUserPayload,
    @Body() dto: ReviewAiSuggestionDto,
  ) {
    return this.aiSuggestionsService.reject(id, currentUser, dto);
  }

    @Patch(':id/apply/lead-next-step')
  @Roles(...CRM_WRITE_ROLES)
  applyLeadNextStep(
    @Param('id') id: string,
    @CurrentUser() currentUser: CurrentUserPayload,
    @Body() dto: ApplyLeadNextStepDto,
  ) {
    return this.aiSuggestionsService.applyLeadNextStep(id, currentUser, dto);
  }



  @Post(':id/apply/task')
  @Roles(...CRM_WRITE_ROLES)
  createTaskFromSuggestion(
    @Param('id') id: string,
    @CurrentUser() currentUser: CurrentUserPayload,
    @Body() dto: ApplySuggestedTaskDto,
  ) {
    return this.aiSuggestionsService.createTaskFromSuggestion(
      id,
      currentUser,
      dto,
    );
  }

  @Post(':id/apply/note')
  @Roles(...CRM_WRITE_ROLES)
  createNoteFromSuggestion(
    @Param('id') id: string,
    @CurrentUser() currentUser: CurrentUserPayload,
    @Body() dto: ApplySuggestedNoteDto,
  ) {
    return this.aiSuggestionsService.createNoteFromSuggestion(
      id,
      currentUser,
      dto,
    );
  }

  @Post(':id/apply/external-email-note')
  @Roles(...CRM_WRITE_ROLES)
  createNoteFromExternalEmailSuggestion(
    @Param('id') id: string,
    @CurrentUser() currentUser: CurrentUserPayload,
    @Body() dto: ApplySuggestedNoteDto,
  ) {
    return this.aiSuggestionsService.createNoteFromExternalEmailSuggestion(
      id,
      currentUser,
      dto,
    );
  }
}
