import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { ActivityEventsModule } from '../activity-events/activity-events.module';

@Module({
  imports: [AuthModule, DatabaseModule, ActivityEventsModule],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}