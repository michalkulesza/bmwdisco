import type { ElementId, Module } from '@/data/types';

export interface LedgerEntry {
  module: Module;
  elements: Set<ElementId>;
  silenced: boolean;
}

export class ControlLedger {
  private readonly entries = new Map<string, LedgerEntry>();

  get hasPending(): boolean {
    return this.entries.size > 0;
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

  silence(module: Module): void {
    this.entryFor(module).silenced = true;
  }

  clear(): void {
    this.entries.clear();
  }

  private entryFor(module: Module): LedgerEntry {
    const existing = this.entries.get(module.sgbd);
    if (existing) return existing;

    const created: LedgerEntry = { module, elements: new Set(), silenced: false };
    this.entries.set(module.sgbd, created);

    return created;
  }
}
