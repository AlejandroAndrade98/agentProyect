import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { AcceptOrganizationInvitationDto } from './dto/accept-organization-invitation.dto';
import { OrganizationSettingsService } from './organization-settings.service';

@Controller('organization/invitations')
export class OrganizationInvitationsPublicController {
  constructor(
    private readonly organizationSettingsService: OrganizationSettingsService,
  ) {}

  @Get('accept/:token')
  getInvitationByToken(@Param('token') token: string) {
    return this.organizationSettingsService.getInvitationByToken(token);
  }

  @Post('accept')
  acceptInvitation(@Body() dto: AcceptOrganizationInvitationDto) {
    return this.organizationSettingsService.acceptInvitation(dto);
  }
}