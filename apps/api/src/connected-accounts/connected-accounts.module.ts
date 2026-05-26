import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { ConnectedAccountsController } from './connected-accounts.controller';
import { ConnectedAccountsService } from './connected-accounts.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [ConnectedAccountsController],
  providers: [ConnectedAccountsService],
})
export class ConnectedAccountsModule {}