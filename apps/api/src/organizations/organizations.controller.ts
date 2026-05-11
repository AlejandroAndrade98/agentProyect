import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { CurrentUser as CurrentUserType } from '../auth/interfaces/current-user.interface';
import { OrganizationsService } from './organizations.service';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get('current')
  @UseGuards(JwtAuthGuard)
  async getCurrent(@CurrentUser() currentUser: CurrentUserType) {
    return this.organizationsService.getCurrent(currentUser);
  }
}