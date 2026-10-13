import type { RequestOptions } from '@/protocol/types';
import type { Unsubscribe } from '@/transport/types';

export type LinkState = 'idle' | 'opening' | 'open' | 'closed' | 'failed';

export type LinkStateListener = (state: LinkState, error?: Error) => void;

export interface DiagnosticLink {
  readonly state: LinkState;
  readonly busy: boolean;
  readonly measuredRttMs: number | null;
  open(signal?: AbortSignal): Promise<void>;
  request(ecu: number, payload: Uint8Array, options?: RequestOptions): Promise<Uint8Array>;
  close(): Promise<void>;
  onStateChange(listener: LinkStateListener): Unsubscribe;
}
