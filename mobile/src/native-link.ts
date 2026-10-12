import { NativeModules } from 'react-native';
import { Buffer } from 'buffer';
import { WireLink, SocketLike } from './wire-link';

export class NativeLink extends WireLink {
  constructor(mode: 'enet' | 'thor', host: string, port: number,
    log: (message: string) => void, lost: (error: Error) => void) {
    super(mode, host, port, log, lost, () => {
      if (!NativeModules.TcpSockets) throw new Error('Live TCP requires the custom iOS build. Use Demo in Expo Go.');
      // The package's CommonJS entry exports the API directly, without `.default`.
      const TcpSocket = require('react-native-tcp-socket') as typeof import('react-native-tcp-socket').default;
      const socket = new TcpSocket.Socket();
      return {
        on: (event, callback) => socket.on(event as any, callback),
        connect: (options, callback) => socket.connect(options, callback),
        write: bytes => socket.write(Buffer.from(bytes)),
        destroy: () => socket.destroy(),
      } satisfies SocketLike;
    });
  }
}
