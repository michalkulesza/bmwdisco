import { NativeModule, requireNativeModule } from 'expo';

export interface UdpMessageEvent {
  id: number;
  data: string;
  host: string;
}

type UdpModuleEvents = {
  onMessage: (event: UdpMessageEvent) => void;
};

declare class BimmerDiscoUdpModule extends NativeModule<UdpModuleEvents> {
  open(): Promise<number>;
  send(id: number, base64: string, host: string, port: number): Promise<void>;
  close(id: number): void;
  getBroadcastAddresses(): string[];
}

export default requireNativeModule<BimmerDiscoUdpModule>('BimmerDiscoUdp');
