import type { TransportError } from './errors';

export type Unsubscribe = () => void;

export interface Transport {
  open(signal?: AbortSignal): Promise<void>;
  close(): Promise<void>;
  write(data: Uint8Array): Promise<void>;
  onData(listener: (data: Uint8Array) => void): Unsubscribe;
  onClose(listener: (error?: TransportError) => void): Unsubscribe;
}
