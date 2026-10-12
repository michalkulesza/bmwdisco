import { Buffer } from 'buffer';
import type { BleManager, Characteristic, Device, Subscription } from 'react-native-ble-plx';
import { Platform } from 'react-native';
import { ensureBlePermissions } from './ble-permissions';
import { BleTransport } from './elm-ble-link';
import { BLE_WRITE_CHUNK, BleSelection, BleServiceInfo, normalizeUuid } from './protocol/elm';

const CONNECT_TIMEOUT_MS = 8000;
const ATT_HEADER = 3;
const ANDROID_MTU = 185;
const POWER_ON_TIMEOUT_MS = 30000;
const STATE_ERRORS: Record<string, string> = {
  PoweredOff: 'Bluetooth is off. Turn it on in Control Center or Settings, then connect again.',
  Unauthorized: 'Bluetooth access is denied. Allow it for BimmerDisco in Settings, then connect again.',
  Unsupported: 'Bluetooth LE is not available on this device (the iOS Simulator has no Bluetooth).',
};

const ready = async (manager: BleManager) => {
  await ensureBlePermissions();
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    let subscription: Subscription | undefined;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true; clearTimeout(timer); subscription?.remove();
      if (error) reject(error); else resolve();
    };
    const timer = setTimeout(() => finish(new Error('Bluetooth did not become ready. Check that it is on, then connect again.')), POWER_ON_TIMEOUT_MS);
    subscription = manager.onStateChange(state => {
      if (state === 'PoweredOn') finish();
      else if (STATE_ERRORS[state]) finish(new Error(STATE_ERRORS[state]));
    }, true);
    // With emitCurrentState the callback may settle before `subscription` is assigned.
    if (settled) subscription.remove();
  });
};

class PlxTransport implements BleTransport {
  writeSize = BLE_WRITE_CHUNK;
  private manager?: BleManager;
  private writer?: Characteristic;
  private device?: Device;
  private mtu = 0;
  private characteristics = new Map<string, Characteristic>();
  private subscriptions: Subscription[] = [];
  private deviceId?: string;
  private closed = false;

  private getManager(): BleManager {
    if (!this.manager) {
      const { BleManager } = require('react-native-ble-plx') as typeof import('react-native-ble-plx');
      this.manager = new BleManager();
    }
    return this.manager;
  }

  scan(onDevice: Parameters<BleTransport['scan']>[0], onError: (error: Error) => void) {
    let stopped = false;
    const manager = this.getManager();
    ready(manager).then(() => manager.startDeviceScan(null, null, (error, device) => {
      if (stopped) return;
      if (error) onError(error);
      else if (device) onDevice({ id: device.id, name: device.name ?? device.localName, rssi: device.rssi, serviceUUIDs: device.serviceUUIDs });
    })).catch(onError);
    return () => { stopped = true; void manager.stopDeviceScan().catch(() => {}); };
  }

  async connect(id: string, onClosed: (error: Error) => void, timeoutMs = CONNECT_TIMEOUT_MS) {
    const manager = this.getManager();
    this.deviceId = id;
    try {
      await ready(manager);
      let connected = await manager.connectToDevice(id, { timeout: timeoutMs });
      this.subscriptions.push(connected.onDisconnected(error => { if (!this.closed) onClosed(error ?? new Error('Bluetooth connection closed')); }));
      if (Platform.OS === 'android') connected = await connected.requestMTU(ANDROID_MTU).catch(() => connected);
      const mtu = connected.mtu;
      this.device = await connected.discoverAllServicesAndCharacteristics();
      this.mtu = Math.max(mtu, this.device.mtu);

      const services: BleServiceInfo[] = [];
      for (const service of await this.device.services()) {
        const characteristics = await service.characteristics();
        for (const item of characteristics) this.characteristics.set(`${normalizeUuid(service.uuid)}/${normalizeUuid(item.uuid)}`, item);
        services.push({ uuid: normalizeUuid(service.uuid), characteristics: characteristics.map(item => ({
          uuid: item.uuid, writable: item.isWritableWithResponse || item.isWritableWithoutResponse, notifiable: item.isNotifiable })) });
      }
      return services;
    } catch (error) {
      for (const subscription of this.subscriptions) subscription.remove();
      this.subscriptions = [];
      await manager.cancelDeviceConnection(id).catch(() => {});
      throw error;
    }
  }

  async attach(selection: BleSelection, onData: (bytes: Uint8Array) => void) {
    const writer = this.characteristics.get(`${selection.serviceUuid}/${selection.writeUuid}`);
    const notifier = this.characteristics.get(`${selection.serviceUuid}/${selection.notifyUuid}`);
    if (!writer || !notifier || !this.device) throw new Error('Bluetooth serial characteristic not found');

    this.writer = writer;
    this.writeSize = Math.max(BLE_WRITE_CHUNK, this.mtu - ATT_HEADER);
    this.subscriptions.push(notifier.monitor((error, characteristic) => {
      if (this.closed || error || !characteristic?.value) return;
      onData(new Uint8Array(Buffer.from(characteristic.value, 'base64')));
    }));
  }

  async write(bytes: Uint8Array) {
    const writer = this.writer;
    if (!writer) throw new Error('Bluetooth is disconnected');
    const value = Buffer.from(bytes).toString('base64');
    if (writer.isWritableWithoutResponse) await writer.writeWithoutResponse(value);
    else await writer.writeWithResponse(value);
  }

  close() {
    this.closed = true;
    for (const subscription of this.subscriptions) subscription.remove();
    this.subscriptions = [];
    this.writer = undefined;
    const manager = this.manager;
    const deviceId = this.deviceId;
    this.manager = undefined;
    if (!manager) return;
    void (deviceId ? manager.cancelDeviceConnection(deviceId).catch(() => {}) : Promise.resolve())
      .finally(() => { void manager.destroy(); });
  }
}

export const createPlxTransport = (): BleTransport => new PlxTransport();
