import { BleTransport } from '@/transport/BleTransport';
import { TcpTransport } from '@/transport/TcpTransport';

import type { LinkFactoryDeps } from './create-link';

export const nativeLinkDeps: LinkFactoryDeps = {
  createTcpTransport: (host, port) => new TcpTransport({ host, port }),
  createBleTransport: (deviceId) => new BleTransport({ deviceId }),
};
