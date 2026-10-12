import { equalBytes, fromHex } from './bytes';

/** Recovered candidate profile. A model/year is insufficient to select an ECU. */
export const FEM_PROFILE = Object.freeze({
  name: 'FEM_20' as const, destination: 0x40,
  get identity(): Uint8Array { return fromHex('0F 16 B0'); },
});

export function femIdentify(): Uint8Array { return fromHex('22 F1 50'); }
export function femExtendedSession(): Uint8Array { return fromHex('10 03'); }
export function femDefaultSession(): Uint8Array { return fromHex('10 01'); }
export function femReturnControl(): Uint8Array { return fromHex('2F 45 01 00 FE'); }
export function femIndicator(side: 'left' | 'right', on: boolean): Uint8Array {
  if ((side !== 'left' && side !== 'right') || typeof on !== 'boolean') throw new Error('Unsupported indicator command');
  return Uint8Array.of(0x2f, 0x45, 0x01, 0x03, side === 'left' ? 0x0d : 0x0e, on ? 1 : 0);
}
/** Fail closed on additional/unrecognized identity bytes until their layout is verified. */
export function isFemIdentity(response: Uint8Array): boolean {
  return equalBytes(response, fromHex('62 F1 50 0F 16 B0'));
}
