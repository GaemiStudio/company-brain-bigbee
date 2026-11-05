import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { BrainController } from './brain.controller';
import { BrainAccessService } from './brain-access.service';
import { BrainSettingsService } from './brain-settings.service';
import { MessagesService } from './messages.service';
import { SimulateService } from './simulate.service';

/** Company Brain: chat refinement, simulation, Triggerware watching and reports. */
@Module({
  imports: [PrismaModule, OrganizationsModule],
  controllers: [BrainController],
  providers: [BrainAccessService, BrainSettingsService, MessagesService, SimulateService],
})
export class BrainModule {}
