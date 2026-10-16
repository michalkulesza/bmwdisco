import { Buffer } from 'buffer';

import { Platform } from 'react-native';

import { ensureBluetoothReady, getBleManager } from './ble-manager';
import {
  MIN_WRITE_SIZE,
  normalizeUuid,
  selectProfile,
  writeChunked,
  writeSizeForMtu,
  type BleSelection,
  type BleServiceInfo,
} from './ble-profiles';
import { Emitter } from './emitter';
import { TransportError } from './errors';

import type { Transport, Unsubscribe } from './types';
import type { Characteristic, Device, Subscription } from 'react-native-ble-plx';

export interface BleTransportOptions {
  deviceId: string;
  connectTimeoutMs?: number;
}

const DEFAULT_CONNECT_TIMEOUT_MS = 8000;

const toBase64 = (data: Uint8Array): string => Buffer.from(data).toString('base64');

const fromBase64 = (value: string): Uint8Array => new Uint8Array(Buffer.from(value, 'base64'));

export class BleTransport implements Transport {
  private writer?: Characteristic;
  private writeSize = MIN_WRITE_SIZE;
  private subscriptions: Subscription[] = [];
  private ended = false;
  private readonly data = new Emitter<[Uint8Array]>();
  private readonly closed = new Emitter<[TransportError | undefined]>();

  constructor(private readonly options: BleTransportOptions) {}

  async open(signal?: AbortSignal): Promise<void> {
    const ble = getBleManager();
    await ensureBluetoothReady(ble);
    if (signal?.aborted) throw new TransportError('cancelled');

    const { deviceId, connectTimeoutMs = DEFAULT_CONNECT_TIMEOUT_MS } = this.options;
    const onAbort = () => void ble.cancelDeviceConnection(deviceId).catch(() => undefined);
    signal?.addEventListener('abort', onAbort, { once: true });

    try {
      const connected = await ble.connectToDevice(deviceId, { timeout: connectTimeoutMs });
      if (signal?.aborted || this.ended) throw new TransportError('cancelled');
      this.subscriptions.push(
        connected.onDisconnected((error) => {
          this.finish(
            error ? new TransportError('closed', error.message, { cause: error }) : undefined,
          );
        }),
      );

      await this.attach(await this.prepare(connected));
      if (signal?.aborted || this.ended) throw new TransportError('cancelled');
    } catch (error) {
      await this.close();
      throw signal?.aborted ? new TransportError('cancelled') : this.mapOpenError(error);
    } finally {
      signal?.removeEventListener('abort', onAbort);
    }
  }

  async write(data: Uint8Array): Promise<void> {
    const writer = this.writer;
    if (!writer || this.ended) throw new TransportError('closed');

    try {
      await writeChunked(data, this.writeSize, async (chunk) => {
        const withResponse =
          Platform.OS === 'android'
            ? writer.isWritableWithResponse
            : !writer.isWritableWithoutResponse;
        if (withResponse) await writer.writeWithResponse(toBase64(chunk));
        else await writer.writeWithoutResponse(toBase64(chunk));
      });
    } catch (error) {
      throw new TransportError('write-failed', 'Bluetooth write failed', { cause: error });
    }
  }

  async close(): Promise<void> {
    this.ended = true;
    this.writer = undefined;
    for (const subscription of this.subscriptions) subscription.remove();
    this.subscriptions = [];
    this.data.clear();
    this.closed.clear();

    await getBleManager()
      .cancelDeviceConnection(this.options.deviceId)
      .catch(() => undefined);
  }

  onData(listener: (data: Uint8Array) => void): Unsubscribe {
    return this.data.subscribe(listener);
  }

  onClose(listener: (error?: TransportError) => void): Unsubscribe {
    return this.closed.subscribe(listener);
  }

  private async prepare(connected: Device): Promise<Device> {
    const discovered = await connected.discoverAllServicesAndCharacteristics();
    this.writeSize =
      Platform.OS === 'android'
        ? MIN_WRITE_SIZE
        : writeSizeForMtu(Math.max(connected.mtu, discovered.mtu));

    return discovered;
  }

  private async attach(device: Device): Promise<void> {
    const services = await device.services();
    const catalog: BleServiceInfo[] = [];
    const characteristics = new Map<string, Characteristic>();

    for (const service of services) {
      const items = await service.characteristics();
      for (const item of items) {
        characteristics.set(`${normalizeUuid(service.uuid)}/${normalizeUuid(item.uuid)}`, item);
      }
      catalog.push({
        uuid: service.uuid,
        characteristics: items.map((item) => ({
          uuid: item.uuid,
          writable: item.isWritableWithResponse || item.isWritableWithoutResponse,
          notifiable: item.isNotifiable,
        })),
      });
    }

    const selection = selectProfile(catalog);
    if (!selection) {
      throw new TransportError('profile-unsupported', 'No known adapter serial characteristic');
    }

    this.bind(selection, characteristics);
  }

  private bind(selection: BleSelection, characteristics: Map<string, Characteristic>): void {
    const writer = characteristics.get(`${selection.serviceUuid}/${selection.writeUuid}`);
    const notifier = characteristics.get(`${selection.serviceUuid}/${selection.notifyUuid}`);
    if (!writer || !notifier) {
      throw new TransportError('profile-unsupported', 'Adapter characteristics not found');
    }

    this.writer = writer;
    this.subscriptions.push(
      notifier.monitor((error, characteristic) => {
        if (this.ended) return;
        if (error) {
          this.finish(new TransportError('closed', error.message, { cause: error }));

          return;
        }
        if (characteristic?.value) this.data.emit(fromBase64(characteristic.value));
      }),
    );
  }

  private mapOpenError(error: unknown): TransportError {
    if (error instanceof TransportError) return error;

    const message = error instanceof Error ? error.message : 'Bluetooth connection failed';

    return new TransportError('connect-failed', message, { cause: error });
  }

  private finish(error: TransportError | undefined): void {
    if (this.ended) return;

    this.ended = true;
    this.closed.emit(error);
    void this.close();
  }
}
