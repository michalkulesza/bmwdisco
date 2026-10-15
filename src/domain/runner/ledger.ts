import type { ElementId, Module } from '@/data/types';
import { hex } from '@/protocol/bytes';

export interface LedgerEntry {
  module: Module;
  elements: Set<ElementId>;
  silenced: boolean;
}

export interface RawLedgerEntry {
  ecu: number;
  undo: Uint8Array[];
  silenced: boolean;
}

export class ControlLedger {
  private readonly entries = new Map<string, LedgerEntry>();
  private readonly rawEntries = new Map<number, RawLedgerEntry>();

  get hasPending(): boolean {
    return this.entries.size > 0 || this.rawEntries.size > 0;
  }

  get rawTouched(): readonly RawLedgerEntry[] {
    return [...this.rawEntries.values()];
  }

  hasRawSession(ecu: number): boolean {
    return this.rawEntries.has(ecu);
  }

  armRaw(ecu: number, undo: readonly Uint8Array[] = []): void {
    const entry = this.rawEntryFor(ecu);
    for (const payload of undo) {
      if (!entry.undo.some((existing) => hex(existing) === hex(payload))) {
        entry.undo.push(payload.slice());
      }
    }
  }

  silenceRaw(ecu: number): void {
    this.rawEntryFor(ecu).silenced = true;
  }

  get touched(): readonly LedgerEntry[] {
    return [...this.entries.values()];
  }

  hasSession(sgbd: string): boolean {
    return this.entries.has(sgbd);
  }

  openSession(module: Module): void {
    this.entryFor(module);
  }

  touch(module: Module, element: ElementId): void {
    this.entryFor(module).elements.add(element);
  }

  isTouched(module: Module, element: ElementId): boolean {
    return this.entries.get(module.sgbd)?.elements.has(element) ?? false;
  }

  untouch(module: Module, element: ElementId): void {
    this.entries.get(module.sgbd)?.elements.delete(element);
  }

  silence(module: Module): void {
    this.entryFor(module).silenced = true;
  }

  clear(): void {
    this.entries.clear();
    this.rawEntries.clear();
  }

  private rawEntryFor(ecu: number): RawLedgerEntry {
    const existing = this.rawEntries.get(ecu);
    if (existing) return existing;

    const created: RawLedgerEntry = { ecu, undo: [], silenced: false };
    this.rawEntries.set(ecu, created);

    return created;
  }

  private entryFor(module: Module): LedgerEntry {
    const existing = this.entries.get(module.sgbd);
    if (existing) return existing;

    const created: LedgerEntry = { module, elements: new Set(), silenced: false };
    this.entries.set(module.sgbd, created);

    return created;
  }
}
