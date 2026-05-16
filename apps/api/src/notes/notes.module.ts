import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { NotesController } from './notes.controller';
import { NotesService } from './notes.service';
import { ActivityEventsModule } from '../activity-events/activity-events.module';

@Module({
  imports: [AuthModule, DatabaseModule, ActivityEventsModule],
  controllers: [NotesController],
  providers: [NotesService],
  exports: [NotesService],
})
export class NotesModule {}