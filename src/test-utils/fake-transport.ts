import { Emitter } from '@/transport/emitter';
import type { TransportError } from '@/transport/errors';
import type { Transport, Unsubscribe } from '@/transport/types';

export class FakeTransport implements Transport {
  readonly written: Uint8Array[] = [];
  opened = false;
  closeCalls = 0;
  openError?: TransportError;
  writeError?: TransportError;
  onWrite?: (data: Uint8Array) => void;
  private readonly data = new Emitter<[Uint8Array]>();
  private readonly closed = new Emitter<[TransportError | undefined]>();

  async open(): Promise<void> {
    if (this.openError) throw this.openError;
    this.opened = true;
  }

  async close(): Promise<void> {
    this.closeCalls++;
    this.opened = false;
  }

  async write(data: Uint8Array): Promise<void> {
    if (this.writeError) throw this.writeError;

    const copy = data.slice();
    this.written.push(copy);
    this.onWrite?.(copy);
  }

  onData(listener: (data: Uint8Array) => void): Unsubscribe {
    return this.data.subscribe(listener);
  }

  onClose(listener: (error?: TransportError) => void): Unsubscribe {
    return this.closed.subscribe(listener);
  }

  push(data: Uint8Array): void {
    this.data.emit(data);
  }

  drop(error?: TransportError): void {
    this.closed.emit(error);
  }
}
