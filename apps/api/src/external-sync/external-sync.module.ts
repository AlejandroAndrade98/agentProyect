import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { ExternalSyncController } from './external-sync.controller';
import { ExternalSyncService } from './external-sync.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [ExternalSyncController],
  providers: [ExternalSyncService],
  exports: [ExternalSyncService],
})
export class ExternalSyncModule {}