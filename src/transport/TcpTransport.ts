import TcpSocket from 'react-native-tcp-socket';

import { Emitter } from './emitter';
import { TransportError } from './errors';
import { assertAllowedHost } from './host';

import type { Transport, Unsubscribe } from './types';

export interface TcpTransportOptions {
  host: string;
  port: number;
  connectTimeoutMs?: number;
}

const DEFAULT_CONNECT_TIMEOUT_MS = 8000;

type Socket = ReturnType<typeof TcpSocket.createConnection>;

const toBytes = (data: Uint8Array | string): Uint8Array =>
  typeof data === 'string'
    ? Uint8Array.from(data, (char) => char.charCodeAt(0))
    : new Uint8Array(data);

export class TcpTransport implements Transport {
  private socket?: Socket;
  private ended = false;
  private readonly data = new Emitter<[Uint8Array]>();
  private readonly closed = new Emitter<[TransportError | undefined]>();

  constructor(private readonly options: TcpTransportOptions) {}

  open(signal?: AbortSignal): Promise<void> {
    const { host, port, connectTimeoutMs = DEFAULT_CONNECT_TIMEOUT_MS } = this.options;
    assertAllowedHost(host);

    return new Promise<void>((resolve, reject) => {
      if (signal?.aborted) {
        reject(new TransportError('cancelled'));

        return;
      }

      let settled = false;
      const settle = (error?: TransportError) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        if (error) {
          this.destroy();
          reject(error);
        } else {
          resolve();
        }
      };

      const onAbort = () => settle(new TransportError('cancelled'));
      const timer = setTimeout(
        () => settle(new TransportError('timeout', 'TCP connection timed out')),
        connectTimeoutMs,
      );
      signal?.addEventListener('abort', onAbort, { once: true });

      const socket = TcpSocket.createConnection(
        { host, port, connectTimeout: connectTimeoutMs },
        () => settle(),
      );
      this.socket = socket;
      socket.setNoDelay(true);
      socket.on('data', (bytes) => this.data.emit(toBytes(bytes)));
      socket.on('error', (error) => {
        const failure = new TransportError('connect-failed', error.message, { cause: error });
        if (settled) this.finish(failure);
        else settle(failure);
      });
      socket.on('close', () => {
        if (settled) this.finish(undefined);
        else settle(new TransportError('closed', 'TCP connection closed'));
      });
    });
  }

  write(data: Uint8Array): Promise<void> {
    const socket = this.socket;
    if (!socket || this.ended) return Promise.reject(new TransportError('closed'));

    return new Promise<void>((resolve, reject) => {
      socket.write(data, undefined, (error) =>
        error
          ? reject(new TransportError('write-failed', error.message, { cause: error }))
          : resolve(),
      );
    });
  }

  async close(): Promise<void> {
    this.ended = true;
    this.destroy();
    this.data.clear();
    this.closed.clear();
  }

  onData(listener: (data: Uint8Array) => void): Unsubscribe {
    return this.data.subscribe(listener);
  }

  onClose(listener: (error?: TransportError) => void): Unsubscribe {
    return this.closed.subscribe(listener);
  }

  private finish(error: TransportError | undefined): void {
    if (this.ended) return;

    this.ended = true;
    this.destroy();
    this.closed.emit(error);
  }

  private destroy(): void {
    this.socket?.destroy();
    this.socket = undefined;
  }
}
