import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser as CurrentUserDecorator } from '../auth/decorators/current-user.decorator';
import { CurrentUser } from '../auth/interfaces/current-user.interface';
import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { QueryLeadsDto } from './dto/query-leads.dto';

import { LeadIncludeQueryDto } from './dto/lead-include-query.dto';

import {
  CRM_DELETE_ROLES,
  CRM_READ_ROLES,
  CRM_WRITE_ROLES,
} from '../auth/constants/role-groups';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';

@Controller('leads')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}
  
@Get()
@Roles(...CRM_READ_ROLES)
findAll(
  @CurrentUserDecorator() currentUser: CurrentUser,
  @Query() query: QueryLeadsDto,
) {
  return this.leadsService.findAll(currentUser, query);
}

@Get(':id')
@Roles(...CRM_READ_ROLES)
findOne(
  @Param('id') id: string,
  @CurrentUserDecorator() currentUser: CurrentUser,
  @Query() query: LeadIncludeQueryDto,
) {
  return this.leadsService.findOne(id, currentUser, query);
}

@Post()
@Roles(...CRM_WRITE_ROLES)
create(
  @Body() dto: CreateLeadDto,
  @CurrentUserDecorator() currentUser: CurrentUser,
) {
  return this.leadsService.create(dto, currentUser);
}

@Patch(':id')
@Roles(...CRM_WRITE_ROLES)
update(
  @Param('id') id: string,
  @Body() dto: UpdateLeadDto,
  @CurrentUserDecorator() currentUser: CurrentUser,
) {
  return this.leadsService.update(id, dto, currentUser);
}

@Delete(':id')
@Roles(...CRM_DELETE_ROLES)
remove(
  @Param('id') id: string,
  @CurrentUserDecorator() currentUser: CurrentUser,
) {
  return this.leadsService.remove(id, currentUser);
}
}