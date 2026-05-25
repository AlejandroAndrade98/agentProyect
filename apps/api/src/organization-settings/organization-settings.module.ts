import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';

import { OrganizationSettingsController } from './organization-settings.controller';
import { OrganizationSettingsService } from './organization-settings.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [OrganizationSettingsController],
  providers: [OrganizationSettingsService],
})
export class OrganizationSettingsModule {}