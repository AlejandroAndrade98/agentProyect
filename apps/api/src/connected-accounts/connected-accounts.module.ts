import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { ConnectedAccountsController } from './connected-accounts.controller';
import { ConnectedAccountsService } from './connected-accounts.service';
import { ConnectedAccountTokenEncryptionService } from './connected-account-token-encryption.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [ConnectedAccountsController],
  providers: [
    ConnectedAccountsService,
    ConnectedAccountTokenEncryptionService,
  ],
  exports: [ConnectedAccountTokenEncryptionService],
})
export class ConnectedAccountsModule {}