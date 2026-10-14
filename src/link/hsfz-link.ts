import { AdapterError } from '@/protocol/errors';
import {
  encodeAliveCheckResponse,
  encodeHsfzDiagnostic,
  HsfzParser,
  HsfzType,
  TESTER_ADDRESS,
} from '@/protocol/hsfz';
import type { Transport } from '@/transport/types';

import { FramedLink, type IncomingFrame } from './framed-link';

export const ENET_PORT = 6801;

const ERROR_TYPE_FIRST = 0x40;
const ERROR_TYPE_LAST = 0x45;
const ERROR_TYPE_GENERIC = 0xff;

const isErrorType = (type: number): boolean =>
  (type >= ERROR_TYPE_FIRST && type <= ERROR_TYPE_LAST) || type === ERROR_TYPE_GENERIC;

export class HsfzLink extends FramedLink {
  protected readonly testerAddress = TESTER_ADDRESS;
  private readonly parser = new HsfzParser();

  constructor(
    transport: Transport,
    readonly host?: string,
  ) {
    super(transport);
  }

  protected encodeRequest(ecu: number, payload: Uint8Array): Uint8Array {
    return encodeHsfzDiagnostic(payload, ecu, this.testerAddress);
  }

  protected decode(data: Uint8Array): IncomingFrame[] {
    const frames: IncomingFrame[] = [];

    for (const packet of this.parser.push(data)) {
      if (packet.type === HsfzType.AliveCheckRequest) {
        this.transport
          .write(encodeAliveCheckResponse())
          .catch((error: unknown) => this.fail(error));
      } else if (isErrorType(packet.type)) {
        throw new AdapterError('transport-error', `HSFZ error frame 0x${packet.type.toString(16)}`);
      } else if (packet.type === HsfzType.Diagnostic) {
        frames.push({
          source: packet.source!,
          destination: packet.destination!,
          payload: packet.payload,
        });
      }
    }

    return frames;
  }

  protected onTeardown(error: Error): void {
    this.parser.reset();
    super.onTeardown(error);
  }
}
