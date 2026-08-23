import { Global, Module } from '@nestjs/common';
import { ActivityLogService } from './activity-log.service';

// Global so any feature module can inject ActivityLogService without importing this module explicitly.
@Global()
@Module({
  providers: [ActivityLogService],
  exports: [ActivityLogService],
})
export class ActivityLogModule {}
