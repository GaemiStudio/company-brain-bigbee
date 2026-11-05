import { Injectable, Logger } from '@nestjs/common';
import { BrainSimulationStatus } from '@app-starter/shared';
import { BrainAccessService } from './brain-access.service';
import { BrainSettingsService } from './brain-settings.service';
import { MessagesService } from './messages.service';
import { SIMULATION_SCRIPT } from './simulation-script';

/** One organization's running simulation. */
interface SimulationRun {
  position: number;
  isWaitingForLiveMessage: boolean;
  isCancelled: boolean;
  /** Set during the pause; calling it lets the script carry on. */
  resume: (() => void) | null;
}

/**
 * Plays the scripted #it-help workday (simulation-script.ts) into the
 * channel, one message every SIMULATE_INTERVAL_MS.
 *
 * At the pause it waits until a person posts a live message (the presenter
 * typing as Jane), then continues. State is kept in memory: this is a
 * single-laptop demo, and a restart simply ends the simulation.
 */
@Injectable()
export class SimulateService {
  private readonly logger = new Logger(SimulateService.name);

  // Keyed by organization id, so each organization has its own run.
  private readonly runs = new Map<string, SimulationRun>();

  constructor(
    private readonly messages: MessagesService,
    private readonly access: BrainAccessService,
    private readonly settings: BrainSettingsService,
  ) {}

  /** Start the simulation. If it's already running, nothing changes. */
  async start(userId: string, organizationId: string): Promise<BrainSimulationStatus> {
    await this.access.requireManager(userId, organizationId, 'run the simulation');

    if (!this.runs.has(organizationId)) {
      const run: SimulationRun = {
        position: 0,
        isWaitingForLiveMessage: false,
        isCancelled: false,
        resume: null,
      };
      this.runs.set(organizationId, run);

      // Deliberately not awaited: the request returns straight away and the
      // messages keep arriving in the background.
      void this.play(organizationId, run).finally(() => {
        // Only remove our own run. A Reset plus a new Start may have replaced it.
        if (this.runs.get(organizationId) === run) this.runs.delete(organizationId);
      });
    }

    return this.toStatus(organizationId);
  }

  async status(userId: string, organizationId: string): Promise<BrainSimulationStatus> {
    await this.access.requireMember(userId, organizationId, 'view the simulation');
    return this.toStatus(organizationId);
  }

  /** Called whenever a person posts a message; ends the pause if there is one. */
  onLiveMessage(organizationId: string): void {
    const run = this.runs.get(organizationId);
    if (run?.isWaitingForLiveMessage) run.resume?.();
  }

  /** Stop the simulation (used by Reset). No role check: Reset checks it. */
  stop(organizationId: string): void {
    const run = this.runs.get(organizationId);
    if (!run) return;
    run.isCancelled = true;
    run.resume?.();
    this.runs.delete(organizationId);
  }

  private async play(organizationId: string, run: SimulationRun): Promise<void> {
    for (const step of SIMULATION_SCRIPT) {
      if (run.isCancelled) return;

      if ('pauseForLiveMessage' in step) {
        this.logger.log('Simulation paused: waiting for a live message');
        await this.waitForLiveMessage(run);
        continue;
      }

      try {
        await this.messages.record(organizationId, step.authorName, step.text);
      } catch (error) {
        // One bad message shouldn't end the demo; log it and move on.
        this.logger.error(`Simulated message failed: ${error}`);
      }
      run.position += 1;
      await sleep(this.settings.simulateIntervalMs);
    }
    this.logger.log('Simulation finished');
  }

  private waitForLiveMessage(run: SimulationRun): Promise<void> {
    run.isWaitingForLiveMessage = true;
    return new Promise((resolve) => {
      run.resume = () => {
        run.isWaitingForLiveMessage = false;
        run.resume = null;
        resolve();
      };
    });
  }

  private toStatus(organizationId: string): BrainSimulationStatus {
    const run = this.runs.get(organizationId);
    return {
      isRunning: run !== undefined,
      isWaitingForLiveMessage: run?.isWaitingForLiveMessage ?? false,
      position: run?.position ?? 0,
      total: SIMULATION_SCRIPT.filter((step) => !('pauseForLiveMessage' in step)).length,
    };
  }
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
