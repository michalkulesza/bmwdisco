import { asciiToBytes } from '@/protocol/bytes';

import type { FakeTransport } from './fake-transport';

export type ElmHandler = (command: string) => string | null | undefined;

export class FakeElm {
  readonly commands: string[] = [];
  private line = '';
  private held = false;

  constructor(
    private readonly transport: FakeTransport,
    private readonly handler: ElmHandler,
    private readonly chunkSize = Infinity,
  ) {
    transport.onWrite = (data) => this.receive(data);
  }

  hold(): void {
    this.held = true;
  }

  release(reply = ''): void {
    this.held = false;
    this.send(reply);
  }

  private receive(data: Uint8Array): void {
    for (const value of data) {
      if (value !== 0x0d) {
        this.line += String.fromCharCode(value);
        continue;
      }

      const command = this.line;
      this.line = '';
      this.commands.push(command);
      if (this.held) continue;

      const reply = this.handler(command);
      if (typeof reply === 'string') this.send(reply);
    }
  }

  private send(reply: string): void {
    const bytes = asciiToBytes(`${reply}\r\r>`);
    for (let offset = 0; offset < bytes.length; offset += this.chunkSize) {
      this.transport.push(bytes.subarray(offset, offset + this.chunkSize));
    }
  }
}

export const frameLine = (id: number, hex: string): string =>
  `${id.toString(16).toUpperCase()}${hex.replace(/\s/g, '')}`;
