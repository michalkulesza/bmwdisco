import type { ElementId, LightingPreset } from '../presets';
import { equalBytes, fromHex } from './bytes';

export interface VehicleProfile {
  readonly id: 'f32' | 'f10';
  readonly chassis: string;
  readonly ecu: string;
  readonly address: number;
  readonly identity: string;
  readonly elements: Readonly<Partial<Record<ElementId, { on: Uint8Array; off: Uint8Array }>>>;
  readonly returnControl: readonly Uint8Array[];
}

export const IDENTIFY = fromHex('22 F1 50');
export const EXTENDED_SESSION = fromHex('10 03');
export const DEFAULT_SESSION = fromHex('10 01');

export const F32_PROFILE: VehicleProfile = Object.freeze({
  id: 'f32', chassis: 'BMW F32', ecu: 'FEM_20', address: 0x40, identity: '62 F1 50 0F 16 B0',
  elements: {
    frontLeftIndicator: { on: fromHex('2F 45 01 03 0D 01'), off: fromHex('2F 45 01 03 0D 00') },
    frontRightIndicator: { on: fromHex('2F 45 01 03 0E 01'), off: fromHex('2F 45 01 03 0E 00') },
    sideIndicatorLeft: { on: fromHex('2F 45 01 03 10 01'), off: fromHex('2F 45 01 03 10 00') },
    sideIndicatorRight: { on: fromHex('2F 45 01 03 11 01'), off: fromHex('2F 45 01 03 11 00') },
    indicatorLeftAll: { on: fromHex('2E D5 42 00 06 00 64'), off: fromHex('2E D5 42 00 06 00 00') },
    indicatorRightAll: { on: fromHex('2E D5 42 00 07 00 64'), off: fromHex('2E D5 42 00 07 00 00') },
    hazard: { on: fromHex('2E D5 42 00 12 00 64'), off: fromHex('2E D5 42 00 12 00 00') },
    lowBeamLeft: { on: fromHex('2F 45 01 03 01 01'), off: fromHex('2F 45 01 03 01 00') },
    lowBeamRight: { on: fromHex('2F 45 01 03 02 01'), off: fromHex('2F 45 01 03 02 00') },
    highBeamLeft: { on: fromHex('2F 45 01 03 07 01'), off: fromHex('2F 45 01 03 07 00') },
    highBeamRight: { on: fromHex('2F 45 01 03 08 01'), off: fromHex('2F 45 01 03 08 00') },
    daytimeLeft: { on: fromHex('2F 45 01 03 03 01'), off: fromHex('2F 45 01 03 03 00') },
    daytimeRight: { on: fromHex('2F 45 01 03 04 01'), off: fromHex('2F 45 01 03 04 00') },
    positionLeft: { on: fromHex('2F 45 01 03 09 01'), off: fromHex('2F 45 01 03 09 00') },
    positionRight: { on: fromHex('2F 45 01 03 0A 01'), off: fromHex('2F 45 01 03 0A 00') },
    sideMarkerFrontLeft: { on: fromHex('2F 45 01 03 05 01'), off: fromHex('2F 45 01 03 05 00') },
    sideMarkerFrontRight: { on: fromHex('2F 45 01 03 06 01'), off: fromHex('2F 45 01 03 06 00') },
    parkingLights: { on: fromHex('2E D5 42 00 01 00 64'), off: fromHex('2E D5 42 00 01 00 00') },
    parkLightLeft: { on: fromHex('2E D5 42 00 10 00 64'), off: fromHex('2E D5 42 00 10 00 00') },
    parkLightRight: { on: fromHex('2E D5 42 00 11 00 64'), off: fromHex('2E D5 42 00 11 00 00') },
    frontFogLeft: { on: fromHex('2F 45 01 03 0B 01'), off: fromHex('2F 45 01 03 0B 00') },
    frontFogRight: { on: fromHex('2F 45 01 03 0C 01'), off: fromHex('2F 45 01 03 0C 00') },
    rearFogBoth: { on: fromHex('2E D5 42 00 0E 00 64'), off: fromHex('2E D5 42 00 0E 00 00') },
    brakeAll: { on: fromHex('2E D5 42 00 0C 00 64'), off: fromHex('2E D5 42 00 0C 00 00') },
    brakeForceDisplay: { on: fromHex('2E D5 42 00 0D 00 64'), off: fromHex('2E D5 42 00 0D 00 00') },
    reverseBoth: { on: fromHex('2E D5 42 00 0F 00 64'), off: fromHex('2E D5 42 00 0F 00 00') },
    hazardLed: { on: fromHex('2F 45 01 03 26 01'), off: fromHex('2F 45 01 03 26 00') },
    interiorFront: { on: fromHex('2E D5 42 00 13 00 64'), off: fromHex('2E D5 42 00 13 00 00') },
    footwellFront: { on: fromHex('2F 45 01 03 2A 01'), off: fromHex('2F 45 01 03 2A 00') },
    footwellRear: { on: fromHex('2F 45 01 03 2B 01'), off: fromHex('2F 45 01 03 2B 00') },
    doorHandle: { on: fromHex('2F 45 01 03 2C 01'), off: fromHex('2F 45 01 03 2C 00') },
    ambient: { on: fromHex('2F 45 01 03 2D 01'), off: fromHex('2F 45 01 03 2D 00') },
  },
  returnControl: [fromHex('2F 45 01 00 FE')],
});

export const F10_PROFILE: VehicleProfile = Object.freeze({
  id: 'f10', chassis: 'BMW F10/F11', ecu: 'FRM3', address: 0x72, identity: '62 F1 50 0F 10 D0',
  elements: {
    frontLeftIndicator: { on: fromHex('2F 01 1C 03 64'), off: fromHex('2F 01 1C 03 00') },
    frontRightIndicator: { on: fromHex('2F 01 1D 03 64'), off: fromHex('2F 01 1D 03 00') },
    rearLeftIndicator: { on: fromHex('2F 01 1A 03 64'), off: fromHex('2F 01 1A 03 00') },
    rearRightIndicator: { on: fromHex('2F 01 1B 03 64'), off: fromHex('2F 01 1B 03 00') },
    lowBeamLeft: { on: fromHex('2F 01 04 03 64'), off: fromHex('2F 01 04 03 00') },
    lowBeamRight: { on: fromHex('2F 01 05 03 64'), off: fromHex('2F 01 05 03 00') },
    highBeamLeft: { on: fromHex('2F 01 0B 03 64'), off: fromHex('2F 01 0B 03 00') },
    highBeamRight: { on: fromHex('2F 01 0C 03 64'), off: fromHex('2F 01 0C 03 00') },
    daytimeLeft: { on: fromHex('2F 01 13 03 64'), off: fromHex('2F 01 13 03 00') },
    daytimeRight: { on: fromHex('2F 01 14 03 64'), off: fromHex('2F 01 14 03 00') },
    positionLeft: { on: fromHex('2F 01 13 03 64'), off: fromHex('2F 01 13 03 00') },
    positionRight: { on: fromHex('2F 01 14 03 64'), off: fromHex('2F 01 14 03 00') },
    sideMarkerFrontLeft: { on: fromHex('2F 01 17 03 64'), off: fromHex('2F 01 17 03 00') },
    sideMarkerFrontRight: { on: fromHex('2F 01 18 03 64'), off: fromHex('2F 01 18 03 00') },
    frontFogLeft: { on: fromHex('2F 01 11 03 64'), off: fromHex('2F 01 11 03 00') },
    frontFogRight: { on: fromHex('2F 01 12 03 64'), off: fromHex('2F 01 12 03 00') },
    rearFogLeft: { on: fromHex('2F 01 0F 03 64'), off: fromHex('2F 01 0F 03 00') },
    rearFogRight: { on: fromHex('2F 01 10 03 64'), off: fromHex('2F 01 10 03 00') },
    tailLeft: { on: fromHex('2F 01 02 03 64'), off: fromHex('2F 01 02 03 00') },
    tailRight: { on: fromHex('2F 01 03 03 64'), off: fromHex('2F 01 03 03 00') },
    brakeLeft: { on: fromHex('2F 01 06 03 64'), off: fromHex('2F 01 06 03 00') },
    brakeCenter: { on: fromHex('2F 01 07 03 64'), off: fromHex('2F 01 07 03 00') },
    brakeRight: { on: fromHex('2F 01 08 03 64'), off: fromHex('2F 01 08 03 00') },
    reverseLeft: { on: fromHex('2F 01 15 03 64'), off: fromHex('2F 01 15 03 00') },
    reverseRight: { on: fromHex('2F 01 16 03 64'), off: fromHex('2F 01 16 03 00') },
    licensePlate: { on: fromHex('2F 01 0E 03 64'), off: fromHex('2F 01 0E 03 00') },
  },
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
