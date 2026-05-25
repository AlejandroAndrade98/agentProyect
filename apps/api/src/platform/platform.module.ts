import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';

import { PlatformOrganizationsController } from './platform-organizations.controller';
import { PlatformOrganizationsService } from './platform-organizations.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [PlatformOrganizationsController],
  providers: [PlatformOrganizationsService],
})
export class PlatformModule {}