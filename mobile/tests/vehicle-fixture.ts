import { VehicleSession } from '../src/session';
import { DiagnosticLink, LinkFactory, hex } from '../src/link';
import { VehicleProfile } from '../src/protocol/profiles';

export const CAS_IDENTITY = [0x0f, 0x0b, 0x01];
export const FEM_IDENTITY = [0x0f, 0x16, 0xb0];
export const FRM_IDENTITY = [0x0f, 0x10, 0xd0];

interface Options { identities?: Record<number, number[]>; reject?: string; profiles?: readonly VehicleProfile[] }

export function fixture(options: Options = {}) {
  const identities = options.identities ?? { 0x40: FEM_IDENTITY };
  const sent: string[] = [];
  const addressed: string[] = [];
  let closed = false;
  const link: DiagnosticLink = {
    async open() { closed = false; }, close() { closed = true; },
    async request(payload, address) {
      if (closed) throw new Error('closed');
      const command = hex(payload); sent.push(command);
      addressed.push(`${address.toString(16)}:${command}`);
      if (command === options.reject) throw new Error('ECU rejected request');
      if (payload[0] === 0x22) {
        const identity = identities[address];
        if (!identity) throw new Error('ECU rejected service 0x22: NRC 0x31');
        return Uint8Array.from([0x62, 0xf1, 0x50, ...identity]);
      }
      return Uint8Array.from([payload[0] + 0x40, ...payload.slice(1)]);
    },
  };
  const factory: LinkFactory = () => link;
  return { session: new VehicleSession(() => {}, factory, options.profiles), sent, addressed, isClosed: () => closed };
}
