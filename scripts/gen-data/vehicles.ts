import type { ChassisRow } from './schemas';

export interface SeriesVehicles {
  series: string;
  code: string;
  models: { name: string; engine: string; body: string }[];
}

const F_CHASSIS_CODE = /(?<![A-Za-z0-9])(F(?:0[1-9]|[1-9]\d))(?![0-9])/;

export const chassisCodeOf = (label: string) => F_CHASSIS_CODE.exec(label)?.[1] ?? null;

export const isFSeriesLabel = (label: string) => chassisCodeOf(label) !== null;

export const buildVehicles = (rows: readonly ChassisRow[]): SeriesVehicles[] => {
  const bySeries = new Map<string, SeriesVehicles>();
  const seen = new Set<string>();

  for (const row of rows) {
    const code = chassisCodeOf(row.series);
    if (!code) continue;

    const entry = bySeries.get(row.series) ?? { series: row.series, code, models: [] };
    bySeries.set(row.series, entry);

    const modelKey = `${row.series}|${row.name}|${row.engine}|${row.body}`;
    if (seen.has(modelKey)) continue;
    seen.add(modelKey);
    entry.models.push({ name: row.name, engine: row.engine, body: row.body });
  }

  return [...bySeries.values()].sort((a, b) => a.series.localeCompare(b.series));
};
