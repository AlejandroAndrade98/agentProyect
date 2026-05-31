import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { SecurityModule } from '../common/security/security.module';
import { ConnectedAccountsController } from './connected-accounts.controller';
import { ConnectedAccountsService } from './connected-accounts.service';
import { ConnectedAccountTokenEncryptionService } from './connected-account-token-encryption.service';
import { ConnectedAccountsOAuthPublicController } from './connected-accounts-oauth-public.controller';

@Module({
  imports: [DatabaseModule, AuthModule, SecurityModule],
  controllers: [
  ConnectedAccountsController,
  ConnectedAccountsOAuthPublicController,
  ],
  providers: [
    ConnectedAccountsService,
    ConnectedAccountTokenEncryptionService,
  ],
  exports: [ConnectedAccountTokenEncryptionService],
})
export class ConnectedAccountsModule {}
