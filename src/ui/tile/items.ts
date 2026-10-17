import type { Effect } from '@/data/types';
import { totalDurationMs, type DetectedCar, type Preset } from '@/domain';
import { assessRunnable, contextOf } from '@/domain/actions/availability';

import { effectAppearance } from './appearance';
import { formatSeconds, hueOf, packKey, translateKey } from './helpers';
import { iconByName } from './icon-registry';

import type { TileItem } from './types';
import type { TFunction } from 'i18next';

export const presetSummary = (preset: Preset, t: TFunction): string => {
  const steps = t('tile.steps', { count: preset.steps.length });
  const duration = t('tile.duration', { value: formatSeconds(totalDurationMs(preset.steps)) });

  const mode =
    preset.playback && preset.playback !== 'once'
      ? ` · ${t(`preset.playback.${preset.playback}`)}`
      : '';
  return `${steps} · ${duration}${mode}`;
};

const availabilityOf = (
  car: DetectedCar | undefined,
  item: Parameters<typeof assessRunnable>[1],
) => {
  if (!car) return { availability: 'offline' as const };
  const assessment = assessRunnable(contextOf(car), item);
  const available = assessment.status === 'runnable' || assessment.status === 'partial';
  const missing = assessment.missing[0];
  return {
    availability: available ? ('available' as const) : ('unsupported' as const),
    unavailableReason:
      !available && missing && missing.status !== 'supported' ? missing.reason : undefined,
  };
};

export const presetName = (preset: Preset, t: TFunction): string => {
  if (preset.id === 'seed-double-flash' && preset.name === 'Double flash')
    return t('actions.seeds.doubleFlash');
  if (preset.id === 'seed-fog-strobe' && preset.name === 'Fog strobe')
    return t('actions.seeds.fogStrobe');
  return preset.name;
};

export const presetItem = (
  preset: Preset,
  t: TFunction,
  car: DetectedCar | undefined,
): TileItem => ({
  id: preset.id,
  kind: 'preset',
  name: presetName(preset, t),
  tag: presetSummary(preset, t),
  icon: iconByName(preset.icon),
  hue: hueOf(preset.color),
  toggle: false,
  run: preset,
  ...availabilityOf(car, { kind: 'preset', preset }),
});

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
    ...availabilityOf(car, { kind: 'effect', effect }),
  };
};
