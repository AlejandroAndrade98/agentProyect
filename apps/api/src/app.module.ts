import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { CompaniesModule } from './companies/companies.module';
import { ContactsModule } from './contacts/contacts.module';
import { ProductsModule } from './products/products.module';
import { LeadsModule } from './leads/leads.module';
import { TasksModule } from './tasks/tasks.module';
import { NotesModule } from './notes/notes.module';
import { ActivityEventsModule } from './activity-events/activity-events.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AiSuggestionsModule } from './ai-suggestions/ai-suggestions.module';
import { AiUsageModule } from './ai-usage/ai-usage.module';
import { PlatformModule } from './platform/platform.module';
import { OrganizationSettingsModule } from './organization-settings/organization-settings.module';
import { ConnectedAccountsModule } from './connected-accounts/connected-accounts.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
      load: [configuration],
    }),
    DatabaseModule,
    HealthModule,
    AuthModule,
    UsersModule,
    OrganizationsModule,
    CompaniesModule,
    ContactsModule,
    ProductsModule,
    LeadsModule,
    TasksModule,
    NotesModule,
    ActivityEventsModule,
    DashboardModule,
    AiSuggestionsModule,
    AiUsageModule,
    PlatformModule,
    OrganizationSettingsModule,
    ConnectedAccountsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}