import type { ElementId } from '@/data/elements';
import type { DiagnosticLink } from '@/link/types';
import { toError, LinkClosedError } from '@/protocol/errors';

import type { ControlLedger } from './ledger';
import type { CleanupFailure, CleanupReport, CleanupStep } from './types';

export const CLEANUP_TIMEOUT_MS = 2000;

const EXTENDED_SESSION = Uint8Array.of(0x10, 0x03);
const DEFAULT_SESSION = Uint8Array.of(0x10, 0x01);
const COMMUNICATION_ON = Uint8Array.of(0x28, 0x00, 0x03);

export interface RestoreOptions {
  reenterSession?: boolean;
}

export type CleanupSend = (ecu: number, payload: Uint8Array) => Promise<unknown>;

export const createCleanupSend =
  (link: DiagnosticLink, trace?: (ecu: number, payload: Uint8Array) => void): CleanupSend =>
  (ecu, payload) => {
    trace?.(ecu, payload);

    return link.request(ecu, payload, {
      priority: 'high',
      timeoutMs: CLEANUP_TIMEOUT_MS,
      totalMs: CLEANUP_TIMEOUT_MS * 2,
    });
  };

export const restoreControl = async (
  link: DiagnosticLink,
  ledger: ControlLedger,
  send: CleanupSend,
  options: RestoreOptions = {},
): Promise<CleanupReport> => {
  if (!ledger.hasPending) return { restored: true, failures: [] };

  const entries = ledger.touched;
  if (link.state !== 'open') {
    const error = new LinkClosedError();

    return {
      restored: false,
      failures: entries.map((entry) => ({ sgbd: entry.module.sgbd, step: 'link', error })),
    };
  }

  const failures: CleanupFailure[] = [];
  const attempt = async (
    sgbd: string,
    step: CleanupStep,
    ecu: number,
    payload: Uint8Array,
    element?: ElementId,
  ) => {
    try {
      await send(ecu, payload);
    } catch (error) {
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
  for (const { module } of entries) {
    for (const payload of module.returnControl) {
      await attempt(module.sgbd, 'returnControl', module.address, Uint8Array.from(payload));
    }
  }
  for (const { module, silenced } of entries) {
    if (silenced) await attempt(module.sgbd, 'communication', module.address, COMMUNICATION_ON);
  }
  for (const { module } of entries) {
    await attempt(module.sgbd, 'defaultSession', module.address, DEFAULT_SESSION);
  }

  if (failures.length === 0) ledger.clear();

  return { restored: failures.length === 0, failures };
};
