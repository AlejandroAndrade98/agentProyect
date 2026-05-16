import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { ActivityEventsModule } from '../activity-events/activity-events.module';

@Module({
  imports: [AuthModule, DatabaseModule, ActivityEventsModule],
  controllers: [CompaniesController],
  providers: [CompaniesService],
  exports: [CompaniesService],
})
export class CompaniesModule {}