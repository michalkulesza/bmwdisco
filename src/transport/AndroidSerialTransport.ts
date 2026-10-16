import { Buffer } from 'buffer';

import { NativeModule, requireNativeModule } from 'expo';
import { PermissionsAndroid, Platform } from 'react-native';

import { Emitter } from './emitter';
import { TransportError } from './errors';

import type { Transport, Unsubscribe } from './types';

export type AndroidSerialKind = 'bluetooth' | 'usb';
export interface AndroidSerialDevice {
  id: string;
  name: string;
}
interface SerialEvent {
  id: string;
  base64: string;
}
interface ClosedEvent {
  id: string;
  message: string;
}
declare class SerialModule extends NativeModule<{
  onData: (event: SerialEvent) => void;
  onClosed: (event: ClosedEvent) => void;
}> {
  listBondedDevices(): Promise<AndroidSerialDevice[]>;
  listUsbDevices(): Promise<AndroidSerialDevice[]>;
  open(
    id: string,
    kind: AndroidSerialKind,
    deviceId: string,
    timeoutMs: number,
    baudRate: number,
    parity: number,
  ): Promise<void>;
  write(id: string, base64: string): Promise<void>;
  close(id: string): void;
}

const getModule = (): SerialModule => {
  if (Platform.OS !== 'android') throw new TransportError('profile-unsupported');
  return requireNativeModule<SerialModule>('BimmerDiscoAdapters');
};

const connectionError = (error: unknown, kind: AndroidSerialKind): TransportError => {
  if (error instanceof TransportError) return error;
  const message = error instanceof Error ? error.message : String(error);
  const code = /Bluetooth is turned off/i.test(message)
    ? 'bluetooth-off'
    : /Bluetooth is unavailable/i.test(message)
      ? 'bluetooth-unsupported'
      : kind === 'bluetooth' && /permission|BLUETOOTH_CONNECT|SecurityException/i.test(message)
        ? 'bluetooth-denied'
        : 'connect-failed';
  return new TransportError(code, message, { cause: error });
};

async function requestPermission(kind: AndroidSerialKind): Promise<void> {
  if (kind !== 'bluetooth' || Number(Platform.Version) < 31) return;
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
  if (result !== PermissionsAndroid.RESULTS.GRANTED) throw new TransportError('bluetooth-denied');
}

export async function listAndroidSerialDevices(
  kind: AndroidSerialKind,
): Promise<AndroidSerialDevice[]> {
  const native = getModule();
  await requestPermission(kind);
  try {
    return await (kind === 'bluetooth' ? native.listBondedDevices() : native.listUsbDevices());
  } catch (error) {
    throw connectionError(error, kind);
  }
}

export interface AndroidSerialTransportOptions {
  kind: AndroidSerialKind;
  deviceId: string;
  connectTimeoutMs?: number;
  baudRate?: number;
  parity?: number;
}

let nextId = 1;
export class AndroidSerialTransport implements Transport {
  private readonly id = `serial-${nextId++}`;
  private native?: SerialModule;
  private ended = false;
  private opened = false;
  private subscriptions: { remove(): void }[] = [];
  private cancelOpen?: () => void;
  private rejectOpen?: (error: TransportError) => void;
  private readonly data = new Emitter<[Uint8Array]>();
  private readonly closed = new Emitter<[TransportError | undefined]>();

  constructor(private readonly options: AndroidSerialTransportOptions) {}

  async open(signal?: AbortSignal): Promise<void> {
    if (signal?.aborted || this.ended) throw new TransportError('cancelled');
    const native = getModule();
    this.native = native;
    await requestPermission(this.options.kind);
    if (signal?.aborted || this.ended) throw new TransportError('cancelled');
    this.subscriptions = [
      native.addListener('onData', (event) => {
        if (event.id === this.id && !this.ended)
          this.data.emit(new Uint8Array(Buffer.from(event.base64, 'base64')));
      }),
      native.addListener('onClosed', (event) => {
        if (event.id !== this.id || this.ended) return;
        const error = new TransportError('closed', event.message);
        if (this.rejectOpen) {
          this.rejectOpen(error);
          return;
        }
        this.ended = true;
        this.cleanup();
        this.closed.emit(error);
      }),
    ];
    const timeout = this.options.connectTimeoutMs ?? 10000;
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = (error?: TransportError) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
        this.cancelOpen = undefined;
        this.rejectOpen = undefined;
        if (error) {
          this.ended = true;
          this.cleanup();
          reject(error);
        } else {
          this.opened = true;
          resolve();
        }
      };
      const abort = () => finish(new TransportError('cancelled'));
      this.cancelOpen = abort;
      this.rejectOpen = finish;
      const timer = setTimeout(() => finish(new TransportError('timeout')), timeout);
      signal?.addEventListener('abort', abort, { once: true });
      native
        .open(
          this.id,
          this.options.kind,
          this.options.deviceId,
          timeout,
          this.options.baudRate ?? (this.options.kind === 'usb' ? 115200 : 38400),
          this.options.parity ?? 0,
        )
        .then(
          () => finish(),
          (error: unknown) => finish(connectionError(error, this.options.kind)),
        );
    });
  }

  async write(data: Uint8Array): Promise<void> {
    if (!this.native || this.ended || !this.opened) throw new TransportError('closed');
    try {
      await this.native.write(this.id, Buffer.from(data).toString('base64'));
    } catch (error) {
      throw new TransportError('write-failed', 'Serial write failed', { cause: error });
    }
  }

  async close(): Promise<void> {
    this.cancelOpen?.();
    this.ended = true;
    this.cleanup();
    this.data.clear();
    this.closed.clear();
  }

  onData(listener: (data: Uint8Array) => void): Unsubscribe {
    return this.data.subscribe(listener);
  }
  onClose(listener: (error?: TransportError) => void): Unsubscribe {
    return this.closed.subscribe(listener);
  }

  private cleanup(): void {
    this.subscriptions.forEach((subscription) => subscription.remove());
    this.subscriptions = [];
    this.native?.close(this.id);
  }
}
