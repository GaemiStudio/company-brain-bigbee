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

/** Verified company data ("bedrock") shown beside the channel. */
export interface BrainFact {
  code: string;
  kind: 'policy' | 'data';
  title: string;
  body: string;
}

export interface BrainDevice {
  employeeName: string;
  laptop: string;
  os: string;
  browser: string;
}

/** One row of the report's evidence table: a laptop/browser combination. */
export interface BrainEvidenceRow {
  os: string;
  browser: string;
  stuck: number;
  succeeded: number;
}

/** A policy or fact the brain checked the solution against. */
export interface BrainPolicyCheck {
  code: string;
  /** "warning" = a risk or conflict; "ok" = it points to the recommended path. */
  verdict: 'warning' | 'ok';
  text: string;
  /** How close the fact's meaning was to the proposed solution (0–1). */
  similarity: number;
}

/** What the report says. Stored as JSON on the report row. */
export interface BrainReportContent {
  problem: {
    label: string;
    employeeCount: number;
    firstReportedAt: string;
  };
  evidence: BrainEvidenceRow[];
  solution: {
    label: string;
    employeeCount: number;
    statement: string;
    workaround: string;
  };
  /** Chat messages that hint at a risky do-it-yourself fix. */
  chatRisks: { authorName: string; text: string }[];
  policyChecks: BrainPolicyCheck[];
  recommendations: string[];
}

export interface BrainReport {
  id: string;
  similarity: number;
  content: BrainReportContent;
  createdAt: string;
}

export interface BrainReportSummary {
  id: string;
  title: string;
  similarity: number;
  createdAt: string;
}

/** Everything the Company Brain page shows, fetched in one poll. */
export interface BrainState {
  messages: BrainMessage[];
  /** Distinct employees in the biggest problem cluster. */
  problemCount: number;
  /** Distinct employees in the biggest success cluster. */
  solutionCount: number;
  problemThreshold: number;
  solutionThreshold: number;
  facts: BrainFact[];
  devices: BrainDevice[];
  reports: BrainReportSummary[];
  simulation: BrainSimulationStatus;
}
