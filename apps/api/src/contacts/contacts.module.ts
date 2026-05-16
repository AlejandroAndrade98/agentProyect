import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';
import { ActivityEventsModule } from '../activity-events/activity-events.module';

@Module({
  imports: [AuthModule, DatabaseModule, ActivityEventsModule],
  controllers: [ContactsController],
  providers: [ContactsService],
  exports: [ContactsService],
})
export class ContactsModule {}