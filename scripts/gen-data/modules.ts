import {
  OFF_PARAMS,
  ON_PARAMS,
  assembleRow,
  hasPlaceholder,
  responsePrefixOf,
  type Assembly,
} from './assemble';
import { hexToBytes } from './bytes';
import { CHANNEL_OVERRIDES, ELEMENT_MAP, PAIR_ELEMENTS, SENTINEL_COMMANDS } from './element-map';

import type { EcuModuleRow, MappingRow, UdsFile } from './schemas';
import type { ElementCommands, ElementId, Module } from '../../src/data/types';

export interface ModuleReport {
  sgbd: string;
  elementCount: number;
  commandCount: number;
  unnamedRows: number;
  unassembled: { label: string; reason: string }[];
}

export interface BuiltModule {
  module: Module;
  report: ModuleReport;
}

const identityResponse = (sgbdHex: string) => [0x62, 0xf1, 0x50, ...hexToBytes(sgbdHex)];

const elementIdFor = (sgbd: string, row: MappingRow): ElementId | undefined => {
  if (row.command) return ELEMENT_MAP[row.command];
  return CHANNEL_OVERRIDES[`${sgbd}:${row.args[0]}`];
};

const firstFailure = (...results: Assembly[]) =>
  results.find((result): result is Extract<Assembly, { ok: false }> => !result.ok);

export const buildModule = (
  sgbd: string,
  rows: readonly MappingRow[],
  uds: UdsFile,
  ecuRows: readonly EcuModuleRow[],
): BuiltModule => {
  const elements: Partial<Record<ElementId, ElementCommands>> = {};
  const commands: Record<string, number[]> = {};
  const returnControl: number[][] = [];
  const report: ModuleReport = {
    sgbd,
    elementCount: 0,
    commandCount: 0,
    unnamedRows: 0,
    unassembled: [],
  };

  const addElement = (id: ElementId, on: number[], off: number[]) => {
    if (elements[id]) throw new Error(`${sgbd}: element ${id} defined twice`);
    const expectedResponsePrefix = responsePrefixOf(on);
    elements[id] = expectedResponsePrefix ? { on, off, expectedResponsePrefix } : { on, off };
  };

  for (const row of rows) {
    const command = row.command;
    const id = elementIdFor(sgbd, row);

    if (SENTINEL_COMMANDS.has(command)) continue;
    if (!command && !id) {
      report.unnamedRows += 1;
      continue;
    }

    const on = assembleRow(row, uds, ON_PARAMS);
    const off = hasPlaceholder(row) ? assembleRow(row, uds, OFF_PARAMS) : on;
    const failure = firstFailure(on, off);

    if (failure) {
      report.unassembled.push({
        label: command || (row.args[0] ?? row.description),
        reason: failure.reason,
      });
      continue;
    }
    if (!on.ok || !off.ok) continue;

    if (!hasPlaceholder(row)) {
      commands[command] = on.bytes;
      if (command === 'RETURN_CONTROL') returnControl.push(on.bytes);
    } else if (id) {
      addElement(id, on.bytes, off.bytes);
    } else {
      commands[`${command}_ON`] = on.bytes;
      commands[`${command}_OFF`] = off.bytes;
    }
  }

  for (const pair of PAIR_ELEMENTS) {
    const on = commands[pair.on];
    const off = commands[pair.off];
    if (on && off) addElement(pair.id, on, off);
  }

  const identity = ecuRows
    .filter((row) => row.SGBD === sgbd)
    .map((row) => ({
      sgbdHex: row.SGBD_HEX,
      response: identityResponse(row.SGBD_HEX),
      chassis: row.BAUREIHE,
    }));

  const keepaliveJob = uds.jobs.DIAGNOSE_AUFRECHT;
  if (!keepaliveJob) throw new Error(`${sgbd}: no keepalive job`);

  const module: Module = {
    sgbd,
    address: parseInt(uds.addr, 16),
    protocol: 'uds',
    identity,
    keepalive: hexToBytes(keepaliveJob),
    returnControl,
    elements,
    commands,
  };

  report.elementCount = Object.keys(elements).length;
  report.commandCount = Object.keys(commands).length;

  return { module, report };
};
