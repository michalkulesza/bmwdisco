import { Nrc } from './nrc';

const NEGATIVE_RESPONSE_SID = 0x7f;
const POSITIVE_OFFSET = 0x40;
const SUPPRESS_POSITIVE_BIT = 0x80;

export const SID = {
  SessionControl: 0x10,
  ReadDataByIdentifier: 0x22,
  WriteDataByIdentifier: 0x2e,
  IoControl: 0x2f,
  RoutineControl: 0x31,
  TesterPresent: 0x3e,
} as const;

export type UdsMatch =
  | { kind: 'positive' }
  | { kind: 'pending' }
  | { kind: 'negative'; code: number }
  | { kind: 'unrelated' };

const UNRELATED: UdsMatch = { kind: 'unrelated' };
const POSITIVE: UdsMatch = { kind: 'positive' };

const sameBytes = (a: Uint8Array, b: Uint8Array, from: number, to: number): boolean => {
  for (let index = from; index < to; index++) {
    if (a[index] !== b[index]) return false;
  }

  return true;
};

const matchIoControl = (request: Uint8Array, response: Uint8Array): boolean => {
  if (request.length < 4 || response.length < 4) return false;
  if (!sameBytes(request, response, 1, 4)) return false;

  const echoesChannel = request.length >= 6 && response.length >= 5;

  return !echoesChannel || response[4] === request[4];
};

const matchSubFunction = (request: Uint8Array, response: Uint8Array): boolean =>
  request.length === 2 &&
  response.length >= 2 &&
  response[1] === (request[1]! & ~SUPPRESS_POSITIVE_BIT);

const matchPositive = (request: Uint8Array, response: Uint8Array): boolean => {
  switch (request[0]) {
    case SID.ReadDataByIdentifier:
      return request.length === 3 && response.length >= 4 && sameBytes(request, response, 1, 3);
    case SID.WriteDataByIdentifier:
      return request.length >= 3 && response.length === 3 && sameBytes(request, response, 1, 3);
    case SID.RoutineControl:
      return request.length >= 4 && response.length >= 4 && sameBytes(request, response, 1, 4);
    case SID.IoControl:
      return matchIoControl(request, response);
    case SID.SessionControl:
    case SID.TesterPresent:
      return matchSubFunction(request, response);
    default:
      return true;
  }
};

export const matchUdsResponse = (request: Uint8Array, response: Uint8Array): UdsMatch => {
  if (!request.length || !response.length) return UNRELATED;

  if (response[0] === NEGATIVE_RESPONSE_SID) {
    if (response.length !== 3 || response[1] !== request[0]) return UNRELATED;

    return response[2] === Nrc.ResponsePending
      ? { kind: 'pending' }
      : { kind: 'negative', code: response[2]! };
  }

  if (response[0] !== request[0]! + POSITIVE_OFFSET) return UNRELATED;

  return matchPositive(request, response) ? POSITIVE : UNRELATED;
};
