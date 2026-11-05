import type { BrainMessage, BrainReport, BrainSimulationStatus, BrainState } from '@app-starter/shared';
import { apiClient } from './api-client';

// The response shapes come from @app-starter/shared, so if the API renames a
// field this file stops compiling instead of quietly showing blanks.

export interface PostBrainMessageRequest {
  /** Which employee to post as (the demo lets the presenter choose). */
  authorName: string;
  text: string;
}

/** Calls to the Company Brain API, all scoped to one organization. */
export class BrainApi {
  private base(organizationId: string): string {
    return `/api/organizations/${organizationId}/brain`;
  }

  /** Everything the Company Brain page shows. Polled every second. */
  async getState(organizationId: string): Promise<BrainState> {
    return apiClient.get<BrainState>(`${this.base(organizationId)}/state`);
  }

  async postMessage(organizationId: string, data: PostBrainMessageRequest): Promise<BrainMessage> {
    return apiClient.post<BrainMessage>(`${this.base(organizationId)}/messages`, data);
  }

  async startSimulation(organizationId: string): Promise<BrainSimulationStatus> {
    return apiClient.post<BrainSimulationStatus>(`${this.base(organizationId)}/simulation`, {});
  }

  /** Stop the simulation and clear messages, clusters and reports. */
  async reset(organizationId: string): Promise<void> {
    await apiClient.post<void>(`${this.base(organizationId)}/reset`, {});
  }

  async getReport(organizationId: string, reportId: string): Promise<BrainReport> {
    return apiClient.get<BrainReport>(`${this.base(organizationId)}/reports/${reportId}`);
  }
}

export const brainApi = new BrainApi();
