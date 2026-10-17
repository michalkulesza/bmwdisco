import type { Effect } from '@/data/types';
import type { DetectedCar, Preset } from '@/domain';
import type { FavouriteSize } from '@/stores/favourites';
import { effectItem, presetItem } from '@/ui/tile/items';
import type { TileItem } from '@/ui/tile/types';

import type { TFunction } from 'i18next';

export const CURATED_EFFECT_IDS: readonly string[] = [
  'toggle.hazard',
  'ghost.fullOFF',
  'flash.highBeam',
  'flash.indicatorLeft',
  'flash.indicatorRight',
  'flash.fogFront',
  'toggle.welcomeLight',
  'headlight_show.knightRider',
  'party_mode.interiorStrobe',
];

export const NEW_PRESET_CELL = { id: 'new-preset' } as const;

export type GridCell = TileItem | typeof NEW_PRESET_CELL;

export type SectionKey = 'favourites' | 'predefined' | 'presets';

export type HomeRow =
  | { type: 'notice'; key: string }
  | { type: 'header'; key: string; section: SectionKey }
  | { type: 'empty'; key: string; section: 'favourites' | 'presets' }
  | { type: 'carousel'; key: string; items: TileItem[] }
  | { type: 'grid'; key: string; columns: number; cells: GridCell[] };

interface HomeSources {
  presets: readonly Preset[];
  favouriteIds: readonly string[];
  size: FavouriteSize;
  effects: readonly Effect[];
  car: DetectedCar | undefined;
  t: TFunction;
}

export const chunk = <T>(items: readonly T[], size: number): T[][] => {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size));
  }

  return rows;
};

export const columnsFor = (size: FavouriteSize): number => (size === 'small' ? 4 : 2);

export const tileSide = (screenWidth: number, columns: number, gap: number, padding: number) =>
  Math.floor((screenWidth - padding * 2 - gap * (columns - 1)) / columns);

export const resolveFavourites = ({
  presets,
  favouriteIds,
  effects,
  car,
  t,
}: Omit<HomeSources, 'size'>): TileItem[] => {
  const items: TileItem[] = [];

  favouriteIds.forEach((id) => {
    const preset = presets.find((candidate) => candidate.id === id);
    const effect = effects.find((candidate) => candidate.id === id);
    if (preset) items.push(presetItem(preset, t, car));
    else if (effect) items.push(effectItem(effect, t, car));
  });

  return items;
};

export const curatedEffects = (
  effects: readonly Effect[],
  car: DetectedCar | undefined,
): Effect[] => {
  const available = car ? new Set(car.effects.map((effect) => effect.id)) : undefined;

  return CURATED_EFFECT_IDS.flatMap((id) => {
    const effect = effects.find((candidate) => candidate.id === id);
    if (!effect || (available && !available.has(id))) return [];

    return [effect];
  });
};

export const resolvePredefined = ({
  effects,
  car,
  t,
}: Pick<HomeSources, 'effects' | 'car' | 't'>): TileItem[] =>
  curatedEffects(effects, car).map((effect) => effectItem(effect, t, car));

export const buildHomeRows = (sources: HomeSources): HomeRow[] => {
  const { presets, size, car, t } = sources;
  const rows: HomeRow[] = [];
  const favourites = resolveFavourites(sources);
  const predefined = resolvePredefined(sources);
  const presetItems = presets.map((preset) => presetItem(preset, t, car));

  if (!car) rows.push({ type: 'notice', key: 'notice' });

  rows.push({ type: 'header', key: 'header-favourites', section: 'favourites' });
  if (favourites.length === 0) {
    rows.push({ type: 'empty', key: 'empty-favourites', section: 'favourites' });
  } else if (size === 'large') {
    rows.push({ type: 'carousel', key: 'carousel', items: favourites });
  } else {
    const columns = columnsFor(size);
    chunk(favourites, columns).forEach((cells, index) => {
      rows.push({ type: 'grid', key: `favourites-${index}`, columns, cells });
    });
  }

  rows.push({ type: 'header', key: 'header-predefined', section: 'predefined' });
  chunk(predefined, 2).forEach((cells, index) => {
    rows.push({ type: 'grid', key: `predefined-${index}`, columns: 2, cells });
  });

  rows.push({ type: 'header', key: 'header-presets', section: 'presets' });
  if (presetItems.length === 0)
    rows.push({ type: 'empty', key: 'empty-presets', section: 'presets' });
  const presetCells: GridCell[] = presetItems.length === 0 ? [] : [...presetItems, NEW_PRESET_CELL];
  chunk(presetCells, 2).forEach((cells, index) => {
    rows.push({ type: 'grid', key: `presets-${index}`, columns: 2, cells });
  });

  return rows;
};
