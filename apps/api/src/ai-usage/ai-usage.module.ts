import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';

import { AiUsageService } from './ai-usage.service';

@Module({
  imports: [DatabaseModule],
  providers: [AiUsageService],
  exports: [AiUsageService],
})
export class AiUsageModule {}