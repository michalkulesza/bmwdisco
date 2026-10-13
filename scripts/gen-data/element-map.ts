import type { ElementId } from '../../src/data/elements';

const HEADLIGHT_LED_COUNT = 10;

const ledHeadlightEntries = (): Record<string, ElementId> => {
  const entries: Record<string, ElementId> = {
    ALL_LEFT: 'ledHeadlightLeftAll',
    ALL_RIGHT: 'ledHeadlightRightAll',
  };

  for (let index = 1; index <= HEADLIGHT_LED_COUNT; index += 1) {
    entries[`LED_${index}_LEFT`] = `ledHeadlightLeft${index}` as ElementId;
    entries[`LED_${index}_RIGHT`] = `ledHeadlightRight${index}` as ElementId;
  }

  return entries;
};

export const ELEMENT_MAP: Readonly<Record<string, ElementId>> = {
  LOW_BEAM_LEFT: 'lowBeamLeft',
  LOW_BEAM_RIGHT: 'lowBeamRight',
  LOW_BEAM: 'lowBeamAll',
  HIGH_BEAM_LEFT: 'highBeamLeft',
  HIGH_BEAM_RIGHT: 'highBeamRight',
  HIGH_BEAM: 'highBeamAll',
  DAYTIME_LEFT: 'daytimeLeft',
  DAYTIME_RIGHT: 'daytimeRight',
  DAYTIME: 'daytimeAll',
  POSITION_LEFT: 'positionLeft',
  POSITION_RIGHT: 'positionRight',
  POSITION_ES: 'positionEs',
  POSITION: 'parkingLights',
  PARK_LEFT: 'parkLightLeft',
  PARK_RIGHT: 'parkLightRight',
  SIDEMARKER_LEFT: 'sideMarkerFrontLeft',
  SIDEMARKER_RIGHT: 'sideMarkerFrontRight',
  CORNERING_LEFT: 'corneringLeft',
  CORNERING_RIGHT: 'corneringRight',

  FOG_FRONT_LEFT: 'frontFogLeft',
  FOG_FRONT_RIGHT: 'frontFogRight',
  FOG_FRONT: 'frontFogBoth',
  FOG_REAR_LEFT: 'rearFogLeft',
  FOG_REAR_RIGHT: 'rearFogRight',
  FOG_REAR: 'rearFogBoth',

  INDICATOR_FRONT_LEFT: 'frontLeftIndicator',
  INDICATOR_FRONT_RIGHT: 'frontRightIndicator',
  INDICATOR_FRONT_LEFT_2: 'frontLeftIndicator2',
  INDICATOR_FRONT_RIGHT_2: 'frontRightIndicator2',
  INDICATOR_SIDE_LEFT: 'sideIndicatorLeft',
  INDICATOR_SIDE_RIGHT: 'sideIndicatorRight',
  INDICATOR_REAR_LEFT: 'rearLeftIndicator',
  INDICATOR_REAR_RIGHT: 'rearRightIndicator',
  INDICATOR_LEFT: 'indicatorLeftAll',
  INDICATOR_RIGHT: 'indicatorRightAll',
  HAZARD: 'hazard',

  REAR_LEFT: 'tailLeft',
  REAR_RIGHT: 'tailRight',
  BOOTLID_LEFT: 'tailInnerLeft',
  BOOTLID_RIGHT: 'tailInnerRight',
  BRAKE_LEFT: 'brakeLeft',
  BRAKE_RIGHT: 'brakeRight',
  BRAKE_CENTER: 'brakeCenter',
  BRAKE: 'brakeAll',
  BRAKE_FORCE_DISPLAY: 'brakeForceDisplay',
  BRAKE_FORCE_DISPLAY_LEFT: 'brakeForceDisplayLeft',
  BRAKE_FORCE_DISPLAY_RIGHT: 'brakeForceDisplayRight',
  REVERSE_LEFT: 'reverseLeft',
  REVERSE_RIGHT: 'reverseRight',
  REVERSE: 'reverseBoth',
  LICENSE: 'licensePlate',

  LED_WARNLIGHT: 'hazardLed',
  INTERIOR: 'interiorFront',
  INTERIOR_2: 'interiorRear',
  FOOT_WELL_DOOR_FRONT: 'footwellFront',
  FOOT_WELL_DOOR_REAR: 'footwellRear',
  DOOR_HANDLE: 'doorHandle',
  AMBIENT: 'ambient',
  AMBIENT_1: 'ambient1',
  AMBIENT_2: 'ambient2',
  WELCOME_LIGHT: 'welcome',
  DIMMED_58G: 'terminal58g',
  TWL: 'doorWarning',

  ALL: 'allOutputs',
  ...ledHeadlightEntries(),
};

export const CHANNEL_OVERRIDES: Readonly<Record<string, ElementId>> = {
  'FEM_20:0x26': 'hazardLed',
  'BDC:0x26': 'hazardLed',
  'FRM3:RFL_L': 'reverseLeft',
  'FRM3:RFL_R': 'reverseRight',
  'FRM3:SML_V_L': 'sideMarkerFrontLeft',
  'FRM3:SML_V_R': 'sideMarkerFrontRight',
};

export const PAIR_ELEMENTS: readonly { id: ElementId; on: string; off: string }[] = [
  { id: 'clusterFeedback', on: 'KOMBI_ON', off: 'KOMBI_OFF' },
];

export const SENTINEL_COMMANDS: ReadonlySet<string> = new Set(['NONE', 'INVALID']);

export const SESSION_AND_CLEANUP_COMMANDS: ReadonlySet<string> = new Set([
  'DIAGNOSE_MODE_ON',
  'DIAGNOSE_MODE_OFF',
  'COMMUNICATION_ON',
  'COMMUNICATION_OFF',
  'KOMBI_ON',
  'KOMBI_OFF',
  'RETURN_CONTROL',
]);
