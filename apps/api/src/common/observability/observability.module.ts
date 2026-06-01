import { Global, Module } from '@nestjs/common';

import { SafeLoggerService } from './safe-logger.service';

@Global()
@Module({
  providers: [SafeLoggerService],
  exports: [SafeLoggerService],
})
export class ObservabilityModule {}
