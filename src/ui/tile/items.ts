import type { Effect } from '@/data/types';
import { totalDurationMs, type DetectedCar, type Preset } from '@/domain';

import { effectAppearance } from './appearance';
import { formatSeconds, hueOf, packKey, translateKey } from './helpers';
import { iconByName } from './icon-registry';

import type { TileAvailability, TileItem } from './types';
import type { TFunction } from 'i18next';

export const presetSummary = (preset: Preset, t: TFunction): string => {
  const steps = t('tile.steps', { count: preset.steps.length });
  const duration = t('tile.duration', { value: formatSeconds(totalDurationMs(preset.steps)) });

  return `${steps} · ${duration}`;
};

export const presetItem = (preset: Preset, t: TFunction, connected: boolean): TileItem => ({
  id: preset.id,
  kind: 'preset',
  name: preset.name,
  tag: presetSummary(preset, t),
  icon: iconByName(preset.icon),
  hue: hueOf(preset.color),
  toggle: false,
  run: preset,
  availability: connected ? 'available' : 'offline',
});

const effectAvailability = (effect: Effect, car: DetectedCar | undefined): TileAvailability => {
  if (!car) return 'offline';

  return car.effects.some((candidate) => candidate.id === effect.id) ? 'available' : 'unsupported';
};

export const effectTag = (effect: Effect, t: TFunction): string =>
  translateKey(t, effect.sectionKey ?? `packs.${packKey(effect.pack)}`);

export const effectItem = (
  effect: Effect,
  t: TFunction,
  car: DetectedCar | undefined,
): TileItem => {
  const { icon, hue } = effectAppearance(effect.id, effect.pack);

  return {
    id: effect.id,
    kind: 'effect',
    name: translateKey(t, effect.nameKey),
    tag: effectTag(effect, t),
    icon,
    hue,
    toggle: effect.kind === 'toggle',
    run: effect,
    availability: effectAvailability(effect, car),
  };
};
