import type { Effect } from '@/data/types';
import type { DetectedCar, Preset } from '@/domain';
import { effectItem, presetItem } from '@/ui/tile/items';
import type { TileItem } from '@/ui/tile/types';

import type { TFunction } from 'i18next';

interface CandidateSources {
  favouriteIds: readonly string[];
  presets: readonly Preset[];
  predefined: readonly Effect[];
  car: DetectedCar | undefined;
  t: TFunction;
}

export const buildCandidates = ({
  favouriteIds,
  presets,
  predefined,
  car,
  t,
}: CandidateSources): TileItem[] => {
  const taken = new Set(favouriteIds);
  const presetItems = presets
    .filter((preset) => !taken.has(preset.id))
    .map((preset) => presetItem(preset, t, car));
  const effectItems = predefined
    .filter((effect) => !taken.has(effect.id))
    .map((effect) => effectItem(effect, t, car));

  return [...presetItems, ...effectItems];
};
