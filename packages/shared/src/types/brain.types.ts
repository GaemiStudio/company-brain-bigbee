// Company Brain types shared by the API and the web app, so a renamed field
// is a compile error in both rather than a silent mismatch.

/** What a chat message is about, decided by keyword rules in the API. */
export const BRAIN_MESSAGE_KINDS = ['problem', 'success', 'neither'] as const;
export type BrainMessageKind = (typeof BRAIN_MESSAGE_KINDS)[number];

/** One #it-help chat message as the API returns it. */
export interface BrainMessage {
  id: string;
  authorName: string;
  channel: string;
  text: string;
  kind: BrainMessageKind;
  /** The group of same-meaning messages it joined; null for "neither". */
  clusterId: string | null;
  createdAt: string;
}

export interface BrainMessageList {
  items: BrainMessage[];
  total: number;
}

/** Where the Simulate button's scripted workday is up to. */
export interface BrainSimulationStatus {
  isRunning: boolean;
  /** True while the script waits for the presenter to type a live message. */
  isWaitingForLiveMessage: boolean;
  /** How many scripted messages have been posted so far. */
  position: number;
  total: number;
}
