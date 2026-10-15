import type { ElementId } from '@/data/elements';
import type { DiagnosticLink } from '@/link/types';
import { toError, LinkClosedError, NegativeResponseError } from '@/protocol/errors';

import type { ControlLedger } from './ledger';
import type { CleanupFailure, CleanupReport, CleanupStep } from './types';

export const CLEANUP_TIMEOUT_MS = 2000;

const EXTENDED_SESSION = Uint8Array.of(0x10, 0x03);
const DEFAULT_SESSION = Uint8Array.of(0x10, 0x01);
const COMMUNICATION_ON = Uint8Array.of(0x28, 0x00, 0x03);

export interface CleanupObserver {
  request?: (ecu: number, payload: Uint8Array) => void;
  response?: (ecu: number, payload: Uint8Array) => void;
  failure?: (ecu: number, error: Error) => void;
}

export interface RestoreOptions {
  reenterSession?: boolean;
  observer?: CleanupObserver;
}

const rawName = (ecu: number): string => `0x${ecu.toString(16).toUpperCase().padStart(2, '0')}`;

export type CleanupSend = (ecu: number, payload: Uint8Array) => Promise<unknown>;

export const createCleanupSend =
  (
    link: DiagnosticLink,
    trace?: (ecu: number, payload: Uint8Array) => void,
    responseTrace?: (ecu: number, payload: Uint8Array) => void,
    failureTrace?: (ecu: number, error: Error) => void,
  ): CleanupSend =>
  async (ecu, payload) => {
    trace?.(ecu, payload);

    try {
      const response = await link.request(ecu, payload, {
        priority: 'high',
        timeoutMs: CLEANUP_TIMEOUT_MS,
        totalMs: CLEANUP_TIMEOUT_MS * 2,
      });
      responseTrace?.(ecu, response);
      return response;
    } catch (error) {
      failureTrace?.(ecu, toError(error));
      throw error;
    }
  };

export const restoreControl = async (
  link: DiagnosticLink,
  ledger: ControlLedger,
  send: CleanupSend,
  options: RestoreOptions = {},
): Promise<CleanupReport> => {
  if (!ledger.hasPending) return { restored: true, failures: [] };

  const entries = ledger.touched;
  const rawEntries = ledger.rawTouched;
  if (link.state !== 'open') {
    const error = new LinkClosedError();
    const names = [
      ...entries.map((entry) => entry.module.sgbd),
      ...rawEntries.map((entry) => rawName(entry.ecu)),
    ];

    return {
      restored: false,
      failures: names.map((sgbd) => ({ sgbd, step: 'link' as const, error })),
    };
  }

  const failures: CleanupFailure[] = [];
  const attempt = async (
    sgbd: string,
    step: CleanupStep,
    ecu: number,
    payload: Uint8Array,
    element?: ElementId,
    tolerateRefusal = false,
  ) => {
    try {
      await send(ecu, payload);
    } catch (error) {
      if (tolerateRefusal && error instanceof NegativeResponseError) return;

      failures.push({ sgbd, step, element, error: toError(error) });
    }
  };

  if (options.reenterSession) {
    for (const { module } of entries) {
      await attempt(module.sgbd, 'extendedSession', module.address, EXTENDED_SESSION);
    }
  }
  for (const { module, elements } of entries) {
    for (const element of elements) {
      const off = Uint8Array.from(module.elements[element]!.off);
      await attempt(module.sgbd, 'elementOff', module.address, off, element);
    }
  }
  for (const { module, elements } of entries) {
    for (const payload of module.returnControl) {
      const nothingForced = elements.size === 0;
      await attempt(
        module.sgbd,
        'returnControl',
        module.address,
        Uint8Array.from(payload),
        undefined,
        nothingForced,
      );
    }
  }
  for (const { module, silenced } of entries) {
    if (silenced) await attempt(module.sgbd, 'communication', module.address, COMMUNICATION_ON);
  }
  for (const { module } of entries) {
    await attempt(module.sgbd, 'defaultSession', module.address, DEFAULT_SESSION);
  }

  if (options.reenterSession) {
    for (const { ecu } of rawEntries) {
      await attempt(rawName(ecu), 'extendedSession', ecu, EXTENDED_SESSION);
    }
  }
  for (const { ecu, undo } of rawEntries) {
    for (const payload of undo) {
      await attempt(rawName(ecu), 'rawUndo', ecu, payload, undefined, true);
    }
  }
  for (const { ecu, silenced } of rawEntries) {
    if (silenced) await attempt(rawName(ecu), 'communication', ecu, COMMUNICATION_ON);
  }
  for (const { ecu } of rawEntries) {
    await attempt(rawName(ecu), 'defaultSession', ecu, DEFAULT_SESSION);
  }

  if (failures.length === 0) ledger.clear();

  return { restored: failures.length === 0, failures };
};
