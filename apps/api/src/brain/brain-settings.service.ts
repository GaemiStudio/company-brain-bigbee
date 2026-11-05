import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * The tunable numbers for Company Brain, read from env vars so they can be
 * adjusted during rehearsal without changing code. Defaults match
 * COMPANY_BRAIN_SPEC.md.
 */
@Injectable()
export class BrainSettingsService {
  constructor(private readonly configService: ConfigService) {}

  /** How similar (0–1) a message must be to a cluster to join it. */
  get clusterSimilarity(): number {
    return this.readNumber('CLUSTER_SIMILARITY', 0.55);
  }

  /** How similar a problem and a solution cluster must be to be paired. */
  get matchSimilarity(): number {
    return this.readNumber('MATCH_SIMILARITY', 0.5);
  }

  /** A problem fires when MORE than this many different employees report it. */
  get problemThreshold(): number {
    return this.readNumber('PROBLEM_THRESHOLD', 5);
  }

  /** A solution fires when AT LEAST this many different employees report it. */
  get solutionThreshold(): number {
    return this.readNumber('SOLUTION_THRESHOLD', 3);
  }

  /** Pause between scripted messages when simulating a workday. */
  get simulateIntervalMs(): number {
    return this.readNumber('SIMULATE_INTERVAL_MS', 1500);
  }

  /** Triggerware server address, "host:port". */
  get triggerwareAddress(): string {
    return this.configService.get<string>('TRIGGERWARE_ADDRESS') || '127.0.0.1:5221';
  }

  /** How often Triggerware re-runs each trigger: 7-field cron, seconds first. */
  get triggerSchedule(): string {
    return this.configService.get<string>('TRIGGER_SCHEDULE') || '*/3 * * * * * *';
  }

  // Env vars are always strings, so convert, and fall back to the default if
  // the value is missing or isn't a number.
  private readNumber(key: string, fallback: number): number {
    const raw = this.configService.get<string>(key);
    if (!raw) return fallback;
    const value = Number(raw);
    return Number.isFinite(value) ? value : fallback;
  }
}
