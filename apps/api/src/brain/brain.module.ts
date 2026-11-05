import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BrainController } from './brain.controller';
import { BrainAccessService } from './brain-access.service';
import { BrainSettingsService } from './brain-settings.service';
import { BrainStateService } from './brain-state.service';
import { BrainWatcherService } from './brain-watcher.service';
import { MessagesService } from './messages.service';
import { ReportService } from './report.service';
import { SimulateService } from './simulate.service';

/** Company Brain: chat refinement, simulation, Triggerware watching and reports. */
@Module({
  imports: [PrismaModule, OrganizationsModule, NotificationsModule],
  controllers: [BrainController],
  providers: [
    BrainAccessService,
    BrainSettingsService,
    BrainStateService,
    BrainWatcherService,
    MessagesService,
    ReportService,
    SimulateService,
  ],
})
export class BrainModule {}
