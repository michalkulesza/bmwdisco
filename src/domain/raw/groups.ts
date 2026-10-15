import { ECU } from './ecus';
import { GroupFailedError, type TestGroup } from './group-runner';
import { buildLhm2Write, LHM2_PWM_ON, lhm2DataOf, withChannelPwm, LHM2_CHANNELS } from './lhm2';

import type { TestUsage } from './test-session';

export const ON_HOLD_MS = 2500;
export const LHM2_HOLD_DEFAULT_MS = 1000;
export const LHM2_HOLD_MIN_MS = 300;
export const LHM2_HOLD_MAX_MS = 3000;

export const EXTENDED_SESSION = [0x10, 0x03];
export const DEFAULT_SESSION = [0x10, 0x01];
export const COMMUNICATION_OFF = [0x28, 0x02, 0x01];
export const COMMUNICATION_ON = [0x28, 0x00, 0x03];
export const RETURN_CONTROL = [0x2f, 0x45, 0x01, 0x00, 0xfe];
export const READ_IDENTITY = [0x22, 0xf1, 0x50];
export const READ_LIGHT_STATUS = [0x22, 0xd5, 0x42];
export const READ_LHM2 = [0x22, 0x60, 0x60];

export const FEM_INDICATOR_CHANNELS = [0x10, 0x11, 0x0d, 0x0e] as const;
export const REM_INDICATOR_CHANNELS = { left: 0x20, right: 0x21 } as const;
export const D542_INDICATOR_ELEMENTS = { left: 0x06, right: 0x07 } as const;

const IDENTITY_ECUS = [ECU.fem, ECU.lhm2Left, ECU.lhm2Right, ECU.kombi, ECU.rem];
const HAZARD_ELEMENT = 0x12;
const D542_ON_TIME = [0x00, 0x64];
const D542_OFF_TIME = [0x00, 0x00];

const d542Write = (element: number, time: readonly number[]): number[] => [
  0x2e,
  0xd5,
  0x42,
  0x00,
  element,
  ...time,
];

const femChannel = (channel: number, state: number): number[] => [
  0x2f,
  0x45,
  0x01,
  0x03,
  channel,
  state,
];

const remChannel = (channel: number, state: number): number[] => [0x2e, 0x45, 0x01, channel, state];

export const identityGroup: TestGroup = async (context) => {
  for (const ecu of IDENTITY_ECUS) await context.send(ecu, READ_IDENTITY, { tolerate: true });
  await context.send(ECU.fem, READ_LIGHT_STATUS, { tolerate: true });
};

export const hazardGroup: TestGroup = async (context) => {
  const off = d542Write(HAZARD_ELEMENT, D542_OFF_TIME);

  context.arm(ECU.fem, [off]);
  await context.send(ECU.fem, EXTENDED_SESSION);
  await context.send(ECU.fem, d542Write(HAZARD_ELEMENT, D542_ON_TIME));
  await context.wait(ON_HOLD_MS);
  await context.send(ECU.fem, off);
};

export type IndicatorSide = keyof typeof D542_INDICATOR_ELEMENTS;

export const d542IndicatorGroup =
  (side: IndicatorSide): TestGroup =>
  async (context) => {
    const element = D542_INDICATOR_ELEMENTS[side];
    const off = d542Write(element, D542_OFF_TIME);

    context.arm(ECU.fem, [off]);
    await context.send(ECU.fem, EXTENDED_SESSION);
    const request = await context.send(ECU.fem, d542Write(element, D542_ON_TIME), {
      tolerate: true,
    });
    if (request.outcome.kind === 'positive') await context.wait(ON_HOLD_MS);
    await context.send(ECU.fem, READ_LIGHT_STATUS, { tolerate: true });
    await context.send(ECU.fem, off, { tolerate: true });
  };

export const femIndicatorGroup =
  (channel: number): TestGroup =>
  async (context) => {
    const off = femChannel(channel, 0x00);

    context.arm(ECU.fem, [off, RETURN_CONTROL]);
    await context.send(ECU.fem, EXTENDED_SESSION);
    await context.send(ECU.fem, femChannel(channel, 0x01));
    await context.wait(ON_HOLD_MS);
    await context.send(ECU.fem, off);
    await context.send(ECU.fem, RETURN_CONTROL);
  };

export const remIndicatorGroup =
  (side: IndicatorSide): TestGroup =>
  async (context) => {
    const channel = REM_INDICATOR_CHANNELS[side];
    const off = remChannel(channel, 0x00);

    context.arm(ECU.rem, [off]);
    await context.send(ECU.rem, EXTENDED_SESSION);
    await context.send(ECU.rem, remChannel(channel, 0x01));
    await context.wait(ON_HOLD_MS);
    await context.send(ECU.rem, off);
  };

export const lhm2ReadGroup: TestGroup = async (context) => {
  await context.send(ECU.lhm2Left, READ_LHM2, { tolerate: true });
  await context.send(ECU.lhm2Right, READ_LHM2, { tolerate: true });
};

export interface Lhm2WriteParams {
  ecu: number;
  channel: number;
  holdMs: number;
}

export const clampLhm2Hold = (holdMs: number): number =>
  Math.min(LHM2_HOLD_MAX_MS, Math.max(LHM2_HOLD_MIN_MS, Math.round(holdMs)));

export const lhm2WriteGroup =
  ({ ecu, channel, holdMs }: Lhm2WriteParams): TestGroup =>
  async (context) => {
    if (!Number.isInteger(channel) || channel < 1 || channel > LHM2_CHANNELS) {
      throw new GroupFailedError('invalidChannel');
    }

    context.arm(ecu);
    await context.send(ecu, EXTENDED_SESSION);
    const read = await context.send(ecu, READ_LHM2);
    const baseline =
      read.outcome.kind === 'positive' ? lhm2DataOf(read.outcome.response) : undefined;
    if (!baseline) throw new GroupFailedError('invalidBaseline');

    const restoreFrame = buildLhm2Write(baseline);
    context.arm(ecu, [restoreFrame]);
    context.silence(ecu);
    await context.send(ecu, COMMUNICATION_OFF);
    await context.send(ecu, buildLhm2Write(withChannelPwm(baseline, channel, LHM2_PWM_ON)));
    await context.wait(clampLhm2Hold(holdMs));
    await context.send(ecu, restoreFrame);
  };

export const cleanupAllGroup =
  (usage: Pick<TestUsage, 'touched' | 'silenced'>): TestGroup =>
  async (context) => {
    const options = { tolerate: true, essential: true };

    await context.send(ECU.fem, RETURN_CONTROL, options);
    for (const ecu of usage.silenced) await context.send(ecu, COMMUNICATION_ON, options);
    for (const ecu of usage.touched) await context.send(ecu, DEFAULT_SESSION, options);
  };
