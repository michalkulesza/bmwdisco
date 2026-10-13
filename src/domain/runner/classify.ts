import {
  AdapterError,
  LinkClosedError,
  NegativeResponseError,
  TimeoutError,
} from '@/protocol/errors';
import { Nrc } from '@/protocol/nrc';

import {
  CarNotRespondingError,
  InvalidPresetError,
  NothingToRunError,
  RunLimitError,
  UnsupportedVehicleError,
} from '../errors';

export type RunErrorReason =
  | 'conditionsNotCorrect'
  | 'rejected'
  | 'timeout'
  | 'connectionLost'
  | 'limitExceeded'
  | 'nothingToRun'
  | 'invalidPreset'
  | 'unknown';

export type SessionErrorReason =
  | 'adapterUnreachable'
  | 'bluetoothOff'
  | 'bluetoothDenied'
  | 'carNotResponding'
  | 'unsupportedVehicle'
  | 'connectionLost';

export const classifyRunError = (error: unknown): RunErrorReason => {
  if (error instanceof NegativeResponseError) {
    return error.nrc === Nrc.ConditionsNotCorrect ? 'conditionsNotCorrect' : 'rejected';
  }
  if (error instanceof TimeoutError) return 'timeout';
  if (error instanceof LinkClosedError || error instanceof AdapterError) return 'connectionLost';
  if (error instanceof RunLimitError) return 'limitExceeded';
  if (error instanceof NothingToRunError) return 'nothingToRun';
  if (error instanceof InvalidPresetError) return 'invalidPreset';

  return 'unknown';
};

export const classifySessionError = (error: unknown): SessionErrorReason => {
  if (error instanceof UnsupportedVehicleError) return 'unsupportedVehicle';
  if (error instanceof CarNotRespondingError) return 'carNotResponding';
  if (error instanceof AdapterError) {
    if (error.code === 'bluetooth-off') return 'bluetoothOff';
    if (error.code === 'bluetooth-denied') return 'bluetoothDenied';
  }

  return 'adapterUnreachable';
};
