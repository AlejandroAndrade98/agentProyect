import {
  Body,
  Controller,
  Get,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';

import { CRM_READ_ROLES } from '../auth/constants/role-groups';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser as CurrentUserPayload } from '../auth/interfaces/current-user.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

import { QueryOrganizationUsersDto } from './dto/query-organization-users.dto';
import { UpdateCurrentOrganizationDto } from './dto/update-current-organization.dto';
import { OrganizationSettingsService } from './organization-settings.service';

@Controller('organization')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrganizationSettingsController {
  constructor(
    private readonly organizationSettingsService: OrganizationSettingsService,
  ) {}

  @Get('current')
  @Roles(...CRM_READ_ROLES)
  getCurrentOrganization(@CurrentUser() currentUser: CurrentUserPayload) {
    return this.organizationSettingsService.getCurrentOrganization(currentUser);
  }

  @Patch('current')
  @Roles(Role.SUPER_ADMIN, Role.OWNER, Role.ADMIN)
  updateCurrentOrganization(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Body() dto: UpdateCurrentOrganizationDto,
  ) {
    return this.organizationSettingsService.updateCurrentOrganization(
      currentUser,
      dto,
    );
  }

  @Get('users')
  @Roles(Role.SUPER_ADMIN, Role.OWNER, Role.ADMIN)
  findOrganizationUsers(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Query() query: QueryOrganizationUsersDto,
  ) {
    return this.organizationSettingsService.findOrganizationUsers(
      currentUser,
      query,
    );
  }
}