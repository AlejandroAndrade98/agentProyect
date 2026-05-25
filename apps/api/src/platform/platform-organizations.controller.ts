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
import { Role } from '@prisma/client';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

import { QueryPlatformOrganizationsDto } from './dto/query-platform-organizations.dto';
import { UpdatePlatformOrganizationDto } from './dto/update-platform-organization.dto';
import { UpdatePlatformOrganizationStatusDto } from './dto/update-platform-organization-status.dto';
import { PlatformOrganizationsService } from './platform-organizations.service';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUser as CurrentUserContext } from '../auth/interfaces/current-user.interface';
import { OnboardPlatformOrganizationDto } from './dto/onboard-platform-organization.dto';

import { CreatePlatformOwnerInvitationDto } from './dto/create-platform-owner-invitation.dto';

@Controller('platform/organizations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class PlatformOrganizationsController {
  constructor(
    private readonly platformOrganizationsService: PlatformOrganizationsService,
  ) {}

  @Get()
  findAll(@Query() query: QueryPlatformOrganizationsDto) {
    return this.platformOrganizationsService.findAll(query);
  }

  @Post('onboard')
  onboardOrganization(
    @CurrentUser() currentUser: CurrentUserContext,
    @Body() dto: OnboardPlatformOrganizationDto,
  ) {
    return this.platformOrganizationsService.onboardOrganization(
      currentUser,
      dto,
      );
    }

    @Post(':id/owner-invitation')
    createOwnerInvitation(
      @CurrentUser() currentUser: CurrentUserContext,
      @Param('id') id: string,
      @Body() dto: CreatePlatformOwnerInvitationDto,
    ) {
      return this.platformOrganizationsService.createOwnerInvitation(
        currentUser,
        id,
        dto,
      );
    }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.platformOrganizationsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePlatformOrganizationDto,
  ) {
    return this.platformOrganizationsService.update(id, dto);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdatePlatformOrganizationStatusDto,
  ) {
    return this.platformOrganizationsService.updateStatus(id, dto);
  }
}