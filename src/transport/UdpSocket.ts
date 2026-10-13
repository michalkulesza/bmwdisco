import { ENET_DISCOVERY_HOST, type UdpSocketLike } from '@/link/discovery';

import BimmerDiscoUdp from '../../modules/bimmerdisco-udp';

type MessageListener = (data: Uint8Array, fromHost: string) => void;

const toBase64 = (data: Uint8Array): string => btoa(String.fromCharCode(...data));

const fromBase64 = (text: string): Uint8Array =>
  Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

const resolveTargets = (host: string): string[] =>
  host === ENET_DISCOVERY_HOST
    ? [...new Set([host, ...BimmerDiscoUdp.getBroadcastAddresses()])]
    : [host];

export class UdpSocket implements UdpSocketLike {
  private readonly listeners = new Set<MessageListener>();
  private closed = false;
  private readonly subscription: { remove(): void };

  private constructor(private readonly id: number) {
    this.subscription = BimmerDiscoUdp.addListener('onMessage', (event) => {
      if (event.id !== this.id) return;
      const data = fromBase64(event.data);
      this.listeners.forEach((listener) => listener(data, event.host));
    });
  }

  static async open(): Promise<UdpSocket> {
    return new UdpSocket(await BimmerDiscoUdp.open());
  }

  async send(data: Uint8Array, host: string, port: number): Promise<void> {
    if (this.closed) throw new Error('UDP socket is closed');

    const payload = toBase64(data);
    const results = await Promise.allSettled(
      resolveTargets(host).map((target) => BimmerDiscoUdp.send(this.id, payload, target, port)),
    );
    const failures = results.filter((result) => result.status === 'rejected');
    if (failures.length === results.length) throw failures[0]!.reason;
  }

  onMessage(listener: MessageListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.subscription.remove();
    this.listeners.clear();
    BimmerDiscoUdp.close(this.id);
  }
}

export const createUdpSocket = (): Promise<UdpSocketLike> => UdpSocket.open();
