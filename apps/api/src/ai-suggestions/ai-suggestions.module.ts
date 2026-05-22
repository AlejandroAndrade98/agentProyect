import { Module } from '@nestjs/common';

import { ActivityEventsModule } from '../activity-events/activity-events.module';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';

import { AiSuggestionProviderService } from './ai-suggestion-provider.service';
import { AiSuggestionsController } from './ai-suggestions.controller';
import { AiSuggestionsService } from './ai-suggestions.service';
import { LeadAiContextService } from './lead-ai-context.service';
import { AiUsageModule } from '../ai-usage/ai-usage.module';

@Module({
  imports: [DatabaseModule, AuthModule, ActivityEventsModule, AiUsageModule],
  controllers: [AiSuggestionsController],
  providers: [
    AiSuggestionsService,
    AiSuggestionProviderService,
    LeadAiContextService,
  ],
  exports: [AiSuggestionsService],
})
export class AiSuggestionsModule {}