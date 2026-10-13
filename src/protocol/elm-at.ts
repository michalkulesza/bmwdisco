import { assertByte } from './bytes';
import { AdapterError } from './errors';

export const ELM_INIT_COMMANDS: readonly string[] = [
  'ATZ',
  'ATE0',
  'ATS0',
  'ATL0',
  'ATH1',
  'ATAL',
  'ATCAF0',
  'ATPBE101',
  'ATSPB',
  'ATBI',
  'ATAT2',
  'ATFCSH6F1',
  'ATSH6F1',
];

export const ELM_MONITOR_COMMAND = 'ATMA';
export const ELM_PROMPT = '>';

export const ecuHex = (ecu: number): string =>
  assertByte(ecu).toString(16).toUpperCase().padStart(2, '0');

export const ecuAddressCommands = (ecu: number): string[] => {
  const id = ecuHex(ecu);

  return [`ATFCSD${id}30FF08`, 'ATFCSM1', `ATCRA6${id}`, `ATCEA${id}`];
};

export type ElmLine =
  | { kind: 'frame'; id: number; data: Uint8Array }
  | { kind: 'error'; error: AdapterError }
  | { kind: 'other' };

const ERROR_PATTERNS: readonly [RegExp, () => AdapterError][] = [
  [/^NO DATA$/, () => new AdapterError('no-data', 'ECU did not answer (NO DATA)')],
  [/CAN ERROR/, () => new AdapterError('can-error', 'CAN bus error')],
  [/BUFFER FULL/, () => new AdapterError('buffer-full', 'Adapter buffer full')],
  [
    /UNABLE TO CONNECT|BUS BUSY|BUS ERROR|FB ERROR|DATA ERROR/,
    () => new AdapterError('can-error', 'Adapter could not use the CAN bus'),
  ],
  [/\?/, () => new AdapterError('adapter-rejected', 'Adapter rejected the command')],
];

const FRAME_PATTERN = /^[0-9A-F]{3}(?:[0-9A-F]{2})+$/;

export const parseElmLine = (raw: string): ElmLine => {
  const text = raw.replace(/>/g, '').trim().toUpperCase();
  if (!text) return { kind: 'other' };

  const matched = ERROR_PATTERNS.find(([pattern]) => pattern.test(text));
  if (matched) return { kind: 'error', error: matched[1]() };

  const compact = text.replace(/\s/g, '');
  if (!FRAME_PATTERN.test(compact)) return { kind: 'other' };

  const data = Uint8Array.from(compact.slice(3).match(/../g) ?? [], (pair) => parseInt(pair, 16));

  return { kind: 'frame', id: parseInt(compact.slice(0, 3), 16), data };
};
