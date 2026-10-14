import type { Effect } from '@/data/types';
import type { DiagnosticLink } from '@/link/types';

import type { AdapterConfig, AdapterId } from '../adapter/create-link';
import type { Clock } from '../clock';
import type { Preset } from '../preset/types';
import type { DetectedCar } from '../registry/types';
import type { RunErrorReason, SessionErrorReason } from '../runner/classify';
import type { ControlLedger } from '../runner/ledger';
import type { PresetRunner } from '../runner/runner';
import type { RunnableItem, RunnerEvent } from '../runner/types';

export type AppStateStatus = 'active' | 'inactive' | 'background';

export interface AppStateSource {
  subscribe(listener: (status: AppStateStatus) => void): () => void;
}

export interface SessionDeps {
  createLink(config: AdapterConfig, signal?: AbortSignal): Promise<DiagnosticLink>;
  appState: AppStateSource;
  clock?: Clock;
  probeTimeoutMs?: number;
  keepaliveIntervalMs?: number;
  reconnectBaseDelayMs?: number;
  debug?: boolean;
}

export interface TileStatus {
  state: 'running' | 'justRan' | 'error';
  reason?: RunErrorReason;
}

export interface SessionError {
  reason: SessionErrorReason | RunErrorReason;
  message: string;
  itemId?: string;
  whileRunning?: boolean;
}

export type RunnerNotice =
  | { type: 'elementSkipped'; element: string }
  | { type: 'tooFast'; rttMs: number; requiredMs: number; availableMs: number }
  | { type: 'clusterFeedbackFailed'; message: string };

export interface LogEntry {
  at: number;
  message: string;
}

export interface SessionContext {
  deps: SessionDeps;
  ledger: ControlLedger;
  config?: AdapterConfig;
  adapter?: AdapterId;
  link?: DiagnosticLink;
  car?: DetectedCar;
  runner?: PresetRunner;
  currentItem?: RunnableItem;
  runningItemId?: string;
  abort?: AbortController;
  tiles: Record<string, TileStatus>;
  activeToggles: string[];
  lastError?: SessionError;
  measuredRttMs: number | null;
  lightsMayBeOn: boolean;
  freshLink: boolean;
  reconnectAttempt: number;
  restoreFailures: number;
  restoreRequested: boolean;
  disconnectRequested: boolean;
  notices: RunnerNotice[];
  log: LogEntry[];
  diagnosticsEnabled: boolean;
}

export type RunInput = Preset | Effect;

export type SessionEvent =
  | { type: 'SET_DIAGNOSTICS'; enabled: boolean }
  | { type: 'CLEAR_DIAGNOSTICS' }
  | { type: 'CONNECT'; config: AdapterConfig }
  | { type: 'CANCEL' }
  | { type: 'DISCONNECT' }
  | { type: 'RUN'; item: RunInput }
  | { type: 'STOP' }
  | { type: 'TOGGLE'; effectId: string; on: boolean }
  | { type: 'APP_BACKGROUND' }
  | { type: 'APP_FOREGROUND' }
  | { type: 'LINK_LOST' }
  | { type: 'RUNNER_EVENT'; event: RunnerEvent };
