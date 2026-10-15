import { concatBytes } from '@/protocol/bytes';

export const LHM2_CHANNELS = 7;
export const LHM2_RECORD_BYTES = LHM2_CHANNELS * 2;
export const LHM2_PWM_ON = 0xfa;

const READ_HEADER = [0x62, 0x60, 0x60];
const WRITE_HEADER = [0x2e, 0x60, 0x60];

export interface Lhm2Record {
  pwm: number[];
  current: number[];
}

export interface Lhm2Snapshot {
  id: number;
  label: string;
  ecu: number;
  data: Uint8Array;
}

export interface DiffRow {
  kind: 'pwm' | 'current';
  channel: number;
  values: number[];
  changed: boolean;
}

export const lhm2DataOf = (response: Uint8Array): Uint8Array | undefined => {
  const header = response.subarray(0, READ_HEADER.length);
  const matches = READ_HEADER.every((value, index) => header[index] === value);

  return matches && response.length === READ_HEADER.length + LHM2_RECORD_BYTES
    ? response.slice(READ_HEADER.length)
    : undefined;
};

export const splitLhm2Record = (data: Uint8Array): Lhm2Record => ({
  pwm: Array.from(data.subarray(0, LHM2_CHANNELS)),
  current: Array.from(data.subarray(LHM2_CHANNELS, LHM2_RECORD_BYTES)),
});

export const buildLhm2Write = (data: Uint8Array): Uint8Array =>
  concatBytes(Uint8Array.from(WRITE_HEADER), data);

export const withChannelPwm = (data: Uint8Array, channel: number, value: number): Uint8Array => {
  if (!Number.isInteger(channel) || channel < 1 || channel > LHM2_CHANNELS) {
    throw new RangeError('Invalid LHM2 channel');
  }
  const copy = data.slice();
  copy[channel - 1] = value;

  return copy;
};

export const diffSnapshots = (snapshots: readonly Lhm2Snapshot[]): DiffRow[] =>
  Array.from({ length: LHM2_RECORD_BYTES }, (_, index) => {
    const values = snapshots.map((snapshot) => snapshot.data[index] ?? 0);

    return {
      kind: index < LHM2_CHANNELS ? 'pwm' : 'current',
      channel: (index % LHM2_CHANNELS) + 1,
      values,
      changed: values.some((value) => value !== values[0]),
    };
  });
