import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { EmailModule } from '../email/email.module';

import { OrganizationInvitationsPublicController } from './organization-invitations-public.controller';
import { OrganizationSettingsController } from './organization-settings.controller';
import { OrganizationSettingsService } from './organization-settings.service';

@Module({
  imports: [DatabaseModule, AuthModule, EmailModule],
  controllers: [
    OrganizationSettingsController,
    OrganizationInvitationsPublicController,
  ],
  providers: [OrganizationSettingsService],
})
export class OrganizationSettingsModule {}
