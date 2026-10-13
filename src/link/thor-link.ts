import { encodeThorDiagnostic, THOR_TESTER_ADDRESS, ThorParser } from '@/protocol/thor';

import { FramedLink, type IncomingFrame } from './framed-link';

export const THOR_PORT = 23;

export class ThorLink extends FramedLink {
  protected readonly testerAddress = THOR_TESTER_ADDRESS;
  private readonly parser = new ThorParser();

  protected encodeRequest(ecu: number, payload: Uint8Array): Uint8Array {
    return encodeThorDiagnostic(payload, ecu, this.testerAddress);
  }

  protected decode(data: Uint8Array): IncomingFrame[] {
    return this.parser.push(data);
  }

  protected onTeardown(error: Error): void {
    this.parser.reset();
    super.onTeardown(error);
  }
}
