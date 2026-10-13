export type RequestPriority = 'normal' | 'high';

export interface ModuleWireInfo {
  ecuAddress: number;
  keepalivePayload: Uint8Array;
}

export interface RequestOptions {
  priority?: RequestPriority;
  signal?: AbortSignal;
  timeoutMs?: number;
  totalMs?: number;
  expectResponse?: boolean;
}

export const DEFAULT_TIMEOUT_MS = 4000;
export const DEFAULT_TOTAL_MS = 12000;
