import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { ActivityEventsModule } from '../activity-events/activity-events.module';

@Module({
  imports: [AuthModule, DatabaseModule, ActivityEventsModule],
  controllers: [LeadsController],
  providers: [LeadsService],
  exports: [LeadsService],
})
export class LeadsModule {}