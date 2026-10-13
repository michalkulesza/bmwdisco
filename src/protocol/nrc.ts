export enum Nrc {
  GeneralReject = 0x10,
  ServiceNotSupported = 0x11,
  SubFunctionNotSupported = 0x12,
  IncorrectMessageLength = 0x13,
  BusyRepeatRequest = 0x21,
  ConditionsNotCorrect = 0x22,
  RequestSequenceError = 0x24,
  RequestOutOfRange = 0x31,
  SecurityAccessDenied = 0x33,
  ResponsePending = 0x78,
  SubFunctionNotSupportedInActiveSession = 0x7e,
  ServiceNotSupportedInActiveSession = 0x7f,
}

const NRC_LABELS: Record<number, string> = {
  [Nrc.GeneralReject]: 'general reject',
  [Nrc.ServiceNotSupported]: 'service not supported',
  [Nrc.SubFunctionNotSupported]: 'sub-function not supported',
  [Nrc.IncorrectMessageLength]: 'incorrect message length',
  [Nrc.BusyRepeatRequest]: 'busy, repeat request',
  [Nrc.ConditionsNotCorrect]: 'conditions not correct',
  [Nrc.RequestSequenceError]: 'request sequence error',
  [Nrc.RequestOutOfRange]: 'request out of range',
  [Nrc.SecurityAccessDenied]: 'security access denied',
  [Nrc.ResponsePending]: 'response pending',
  [Nrc.SubFunctionNotSupportedInActiveSession]: 'sub-function not supported in active session',
  [Nrc.ServiceNotSupportedInActiveSession]: 'service not supported in active session',
};

export const describeNrc = (code: number): string =>
  NRC_LABELS[code] ?? 'unknown negative response';

export const decodeNrc = (code: number): Nrc | undefined =>
  code in NRC_LABELS ? (code as Nrc) : undefined;
