import type { Effect } from '@/data/types';
import { effectToPreset, PRESET_LIMITS, type Preset } from '@/domain';
import { createPresetId } from '@/stores/presets';
import { effectAppearance } from '@/ui/tile/appearance';
import { translateKey } from '@/ui/tile/helpers';

import type { TFunction } from 'i18next';

export type MenuSubject = { kind: 'preset'; preset: Preset } | { kind: 'effect'; effect: Effect };

export const fitName = (name: string): string => name.slice(0, PRESET_LIMITS.maxNameLength);

export const findSubject = (
  id: string | undefined,
  presets: readonly Preset[],
  effects: readonly Effect[],
): MenuSubject | undefined => {
  const preset = presets.find((candidate) => candidate.id === id);
  if (preset) return { kind: 'preset', preset };

  const effect = effects.find((candidate) => candidate.id === id);

  return effect ? { kind: 'effect', effect } : undefined;
};

export const buildEffectPreset = (effect: Effect, t: TFunction): Preset => {
  const { iconName, hue } = effectAppearance(effect.id, effect.pack);

  return effectToPreset(effect, {
    id: createPresetId(),
    name: fitName(translateKey(t, effect.nameKey)),
    color: hue,
    icon: iconName,
  });
};
