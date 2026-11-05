import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  BrainMessage,
  BrainMessageList,
  BrainSimulationStatus,
  TokenPayload,
} from '@app-starter/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EmailVerifiedGuard } from '../auth/email-verified.guard';
import { MessagesService } from './messages.service';
import { SimulateService } from './simulate.service';
import { CreateBrainMessageDto } from './dto/create-brain-message.dto';

/**
 * Company Brain routes. The organization id is in the path, as in Projects,
 * so every request is visibly scoped to one tenant.
 */
@ApiTags('brain')
@Controller('organizations/:organizationId/brain')
@UseGuards(JwtAuthGuard, EmailVerifiedGuard)
export class BrainController {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly simulateService: SimulateService,
  ) {}

  @Post('messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Post a chat message to #it-help' })
  async createMessage(
    @Request() req: { user: TokenPayload },
    @Param('organizationId') organizationId: string,
    @Body() data: CreateBrainMessageDto,
  ): Promise<BrainMessage> {
    const message = await this.messagesService.create(req.user.sub, organizationId, data);
    // If the simulation is paused waiting for the presenter, this resumes it.
    this.simulateService.onLiveMessage(organizationId);
    return message;
  }

  @Get('messages')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List the #it-help channel, oldest first' })
  async listMessages(
    @Request() req: { user: TokenPayload },
    @Param('organizationId') organizationId: string,
  ): Promise<BrainMessageList> {
    return this.messagesService.list(req.user.sub, organizationId);
  }

  @Post('simulation')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Start streaming the scripted workday (OWNER or ADMIN)' })
  async startSimulation(
    @Request() req: { user: TokenPayload },
    @Param('organizationId') organizationId: string,
  ): Promise<BrainSimulationStatus> {
    return this.simulateService.start(req.user.sub, organizationId);
  }

  @Get('simulation')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Where the simulation is up to' })
  async simulationStatus(
    @Request() req: { user: TokenPayload },
    @Param('organizationId') organizationId: string,
  ): Promise<BrainSimulationStatus> {
    return this.simulateService.status(req.user.sub, organizationId);
  }

  @Post('reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Stop the simulation and clear messages, clusters and reports' })
  async reset(
    @Request() req: { user: TokenPayload },
    @Param('organizationId') organizationId: string,
  ): Promise<void> {
    // Check permission and clear the data first, so a member without access
    // can't stop someone else's simulation.
    await this.messagesService.reset(req.user.sub, organizationId);
    this.simulateService.stop(organizationId);
  }
}
