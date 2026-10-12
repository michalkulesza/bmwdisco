import type { ElementId, LightingPreset } from '../presets';
import { equalBytes, fromHex } from './bytes';

export interface VehicleProfile {
  readonly id: 'f32' | 'f10';
  readonly chassis: string;
  readonly ecu: string;
  readonly address: number;
  readonly identity: string;
  readonly elements: Readonly<Partial<Record<ElementId, (on: boolean) => Uint8Array>>>;
  readonly returnControl: readonly Uint8Array[];
}

export const IDENTIFY = fromHex('22 F1 50');
export const EXTENDED_SESSION = fromHex('10 03');
export const DEFAULT_SESSION = fromHex('10 01');

const femIndicator = (channel: number) => (on: boolean) => Uint8Array.of(0x2f, 0x45, 0x01, 0x03, channel, on ? 1 : 0);
const frmIndicator = (channel: number) => (on: boolean) => Uint8Array.of(0x2f, 0x01, channel, 0x03, on ? 0x64 : 0);

export const F32_PROFILE: VehicleProfile = Object.freeze({
  id: 'f32', chassis: 'BMW F32', ecu: 'FEM_20', address: 0x40, identity: '62 F1 50 0F 16 B0',
  elements: { frontLeftIndicator: femIndicator(0x0d), frontRightIndicator: femIndicator(0x0e) },
  returnControl: [fromHex('2F 45 01 00 FE')],
});

export const F10_PROFILE: VehicleProfile = Object.freeze({
  id: 'f10', chassis: 'BMW F10/F11', ecu: 'FRM3', address: 0x72, identity: '62 F1 50 0F 10 D0',
  elements: { frontLeftIndicator: frmIndicator(0x1c), frontRightIndicator: frmIndicator(0x1d) },
  returnControl: [],
});

export const PROFILES: readonly VehicleProfile[] = [F32_PROFILE, F10_PROFILE];

export const profileLabel = (profile: VehicleProfile | null) =>
  profile ? `${profile.chassis} · ${profile.ecu}` : 'BMW F32 / F10 / F11';

export const isProfileIdentity = (profile: VehicleProfile, response: Uint8Array) =>
  equalBytes(response, fromHex(profile.identity));

export const unsupportedElements = (profile: VehicleProfile, preset: LightingPreset): ElementId[] => {
  const used = new Set<ElementId>();
  for (const step of preset.steps) if (step.type === 'set') step.elements.forEach(id => used.add(id));
  return [...used].filter(id => !profile.elements[id]);
};
