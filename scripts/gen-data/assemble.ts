import { hexToBytes, toBigEndian } from './bytes';

import type { MappingRow, UdsFile } from './schemas';

export type Assembly = { ok: true; bytes: number[] } | { ok: false; reason: string };

export interface ParamSet {
  param_aktion: string;
  param_zeit: string;
  param_steuern_routine: string;
}

export const ON_PARAMS: ParamSet = {
  param_aktion: '1',
  param_zeit: '100',
  param_steuern_routine: 'STR',
};

export const OFF_PARAMS: ParamSet = {
  param_aktion: '0',
  param_zeit: '0',
  param_steuern_routine: 'STPR',
};

const DIAG_SESSION: Record<string, number> = {
  DEFAULT: 0x01,
  ECUPM: 0x02,
  ECUEXTDIAG: 0x03,
  ECUSSDS: 0x04,
  ECUADS: 0x05,
  SUPPLIER: 0x60,
};

const ROUTINE_SUBFUNCTION: Record<string, number> = { STR: 0x01, STPR: 0x02, RRR: 0x03 };
const IO_CONTROL_PARAM: Record<string, number> = { RCTECU: 0, RTD: 1, FCS: 2, STA: 3 };

const DISPATCH_SERVICE: Record<string, number> = {
  STEUERN: 0x2e,
  STEUERN_IO: 0x2f,
  STEUERN_ROUTINE: 0x31,
};

const fail = (reason: string): Assembly => ({ ok: false, reason });
const succeed = (bytes: number[]): Assembly => ({ ok: true, bytes });

export const hasPlaceholder = (row: MappingRow) => row.args.some((arg) => arg.startsWith('{'));

const resolvePlaceholder = (arg: string, params: ParamSet): string | null => {
  const key = arg.slice(1, -1) as keyof ParamSet;
  return key in params ? params[key] : null;
};

const parseNumber = (text: string): number | null => {
  if (/^0x[0-9a-fA-F]+$/.test(text)) return parseInt(text, 16);
  if (/^\d+$/.test(text)) return parseInt(text, 10);
  return null;
};

const resolveValue = (
  arg: string,
  params: ParamSet,
  enumTable: Record<string, number> | undefined,
): number | null => {
  const text = arg.startsWith('{') ? resolvePlaceholder(arg, params) : arg;
  if (text === null) return null;

  return parseNumber(text) ?? enumTable?.[text] ?? null;
};

const assembleLight = (row: MappingRow, uds: UdsFile, params: ParamSet): Assembly => {
  const lights = uds.lights;
  if (!lights) return fail('no light map');

  const channelName = row.args[0] ?? '';
  const bits = lights.channels[channelName];
  if (!bits) return fail(`channel ${channelName} missing from light map`);
  if (bits.length === 0) return fail(`channel ${channelName} has an empty bit list`);

  const bytes = hexToBytes(lights.template);
  const apply = (list: readonly (readonly [number, string])[]) => {
    for (const [offset, mask] of list) bytes[offset] = (bytes[offset] ?? 0) | parseInt(mask, 16);
  };

  apply(bits);
  if (lights.state) apply(params.param_aktion === '1' ? lights.state.on : lights.state.off);

  return succeed(bytes);
};

const assembleFormB = (row: MappingRow, uds: UdsFile, params: ParamSet): Assembly => {
  const job = uds.jobs[row.function];
  if (!job) return fail(`no job ${row.function}`);

  const base = hexToBytes(job);
  const argBytes: number[] = [];
  for (const arg of row.args) {
    const value = resolveValue(arg, params, undefined);
    if (value === null) return fail(`unresolved argument ${arg}`);
    argBytes.push(value);
  }

  const head = base.slice(0, Math.max(0, base.length - argBytes.length));
  const stripped = base.slice(head.length);
  if (stripped.some((byte) => byte !== 0)) return fail('job template tail is not zero padding');

  return succeed([...head, ...argBytes]);
};

const assembleDispatch = (row: MappingRow, uds: UdsFile, params: ParamSet): Assembly => {
  const service = DISPATCH_SERVICE[row.function];
  const fn = uds.fns.find((candidate) => candidate.n === row.args[1] && candidate.s === service);
  if (service === undefined || !fn) return fail(`no function ${row.args[1]} for ${row.function}`);

  const id = hexToBytes(fn.id ?? '');
  const fields = fn.a ?? [];
  const sub = row.args[2] ?? '';

  const head = [service, ...id];
  let valueArgs: string[] = row.args.slice(2);

  if (service === 0x2f) {
    const ioParam = IO_CONTROL_PARAM[sub];
    if (ioParam === undefined) return fail(`unknown I/O control parameter ${sub}`);
    head.splice(1 + id.length, 0, ioParam);
    valueArgs = row.args.slice(3);
  }

  if (service === 0x31) {
    const routineSub =
      ROUTINE_SUBFUNCTION[sub === '{param_steuern_routine}' ? params.param_steuern_routine : sub];
    if (routineSub === undefined) return fail(`unknown routine sub-function ${sub}`);
    head.splice(1, 0, routineSub);
    valueArgs = row.args.slice(3);
    if (valueArgs.length === 0) return succeed(head);
  }

  if (valueArgs.length !== fields.length) {
    return fail(`${valueArgs.length} value(s) supplied for ${fields.length} field(s)`);
  }

  const payload: number[] = [];
  for (const [index, field] of fields.entries()) {
    const [, width, extra] = field;
    const table = typeof extra === 'string' ? uds.enums[extra] : undefined;
    const value = resolveValue(valueArgs[index] ?? '', params, table);
    if (value === null) return fail(`unresolved value ${valueArgs[index]} for field ${field[0]}`);
    payload.push(...toBigEndian(value, width));
  }

  return succeed([...head, ...payload]);
};

const assembleFixed = (row: MappingRow): Assembly => {
  if (row.function === 'DIAGNOSE_MODE') {
    const session = DIAG_SESSION[row.args[0] ?? ''];
    return session === undefined
      ? fail(`unknown session ${row.args[0]}`)
      : succeed([0x10, session]);
  }

  const rawBytes = row.args.flatMap((arg) => hexToBytes(arg));
  if (row.function === 'COMMUNICATION_CONTROL') return succeed([0x28, ...rawBytes]);
  if (row.function === 'IO_RETURN_CONTROL') return succeed([0x2f, ...rawBytes]);
  if (row.function === 'RAW_UDS') return succeed(rawBytes);

  return fail(`unsupported fixed function ${row.function}`);
};

const FIXED_FUNCTIONS = new Set([
  'DIAGNOSE_MODE',
  'COMMUNICATION_CONTROL',
  'IO_RETURN_CONTROL',
  'RAW_UDS',
]);

export const assembleRow = (row: MappingRow, uds: UdsFile, params: ParamSet): Assembly => {
  if (FIXED_FUNCTIONS.has(row.function)) return assembleFixed(row);
  if (uds.lights?.function === row.function) return assembleLight(row, uds, params);
  if (row.args[0] === 'ARG') return assembleDispatch(row, uds, params);
  if (row.function in uds.jobs) return assembleFormB(row, uds, params);

  return fail(`no assembly route for ${row.function}`);
};

export const responsePrefixOf = (bytes: readonly number[]): number[] | undefined => {
  const [service = 0] = bytes;
  if (service === 0x2e || service === 0x2f) return [service + 0x40, ...bytes.slice(1, 3)];
  if (service === 0x31) return [service + 0x40, ...bytes.slice(1, 4)];
  return undefined;
};
