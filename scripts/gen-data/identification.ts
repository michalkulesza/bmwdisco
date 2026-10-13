import { chassisCodeOf } from './vehicles';

import type { EcuModuleRow } from './schemas';
import type { IdentificationEntry } from '../../src/data/types';

export interface Identification {
  entries: IdentificationEntry[];
  seriesHints: Record<string, string[]>;
}

export const buildIdentification = (
  ecuRows: readonly EcuModuleRow[],
  sgbds: readonly string[],
): Identification => {
  const ours = ecuRows.filter((row) => sgbds.includes(row.SGBD));

  const entries = ours
    .map((row) => ({
      adrIndex: parseInt(row.ADR_INDEX, 16),
      sgbdHex: row.SGBD_HEX,
      sgbd: row.SGBD,
      chassis: row.BAUREIHE,
    }))
    .sort((a, b) => a.adrIndex - b.adrIndex || a.sgbdHex.localeCompare(b.sgbdHex));

  const hints = new Map<string, Set<string>>();
  for (const row of ours) {
    if (chassisCodeOf(row.BAUREIHE) !== row.BAUREIHE) continue;
    const set = hints.get(row.BAUREIHE) ?? new Set<string>();
    set.add(row.SGBD);
    hints.set(row.BAUREIHE, set);
  }

  const seriesHints = Object.fromEntries(
    [...hints.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([chassis, set]) => [chassis, [...set].sort()]),
  );

  return { entries, seriesHints };
};
