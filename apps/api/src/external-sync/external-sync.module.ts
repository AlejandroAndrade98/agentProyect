import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ConnectedAccountsModule } from '../connected-accounts/connected-accounts.module';
import { DatabaseModule } from '../database/database.module';
import { ExternalSyncController } from './external-sync.controller';
import { ExternalSyncService } from './external-sync.service';

@Module({
  imports: [DatabaseModule, AuthModule, ConnectedAccountsModule],
  controllers: [ExternalSyncController],
  providers: [ExternalSyncService],
  exports: [ExternalSyncService],
})
export class ExternalSyncModule {}