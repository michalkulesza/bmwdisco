import { Platform } from 'react-native';

import { AndroidSerialTransport } from '@/transport/AndroidSerialTransport';
import { BleTransport } from '@/transport/BleTransport';
import { TcpTransport } from '@/transport/TcpTransport';
import { createUdpSocket } from '@/transport/UdpSocket';

import type { LinkFactoryDeps } from './create-link';

export const nativeLinkDeps: LinkFactoryDeps = {
  createTcpTransport: (host, port) => new TcpTransport({ host, port }),
  createBleTransport: (deviceId) => new BleTransport({ deviceId }),
  createUdpSocket,
  elmProfile: Platform.OS === 'android' ? 'android-mode2' : 'legacy',
  ...(Platform.OS === 'android'
    ? {
        createSerialTransport: (kind: 'bluetooth' | 'usb', deviceId: string) =>
          new AndroidSerialTransport({ kind, deviceId }),
      }
    : {}),
};
