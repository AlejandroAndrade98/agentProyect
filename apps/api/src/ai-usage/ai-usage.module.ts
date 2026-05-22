import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';

import { AiUsageController } from './ai-usage.controller';
import { AiUsageService } from './ai-usage.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [AiUsageController],
  providers: [AiUsageService],
  exports: [AiUsageService],
})
export class AiUsageModule {}