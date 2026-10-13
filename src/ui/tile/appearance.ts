import type { HueToken } from '@/ui/theme';

import { ICON_REGISTRY, type IconName } from './icon-registry';

interface Appearance {
  icon: IconName;
  hue: HueToken;
}

const PACK_APPEARANCE: Record<string, Appearance> = {
  flash: { icon: 'Lightning', hue: 'blue' },
  headlight_flash: { icon: 'Headlights', hue: 'blue' },
  headlight_show: { icon: 'Sparkle', hue: 'violet' },
  one_side: { icon: 'ArrowBendUpLeft', hue: 'amber' },
  taillight_show: { icon: 'Siren', hue: 'rose' },
  party_mode: { icon: 'Confetti', hue: 'lilac' },
  ghost: { icon: 'Ghost', hue: 'neutral' },
  toggle: { icon: 'Power', hue: 'teal' },
};

const EFFECT_APPEARANCE: Record<string, Appearance> = {
  'toggle.hazard': { icon: 'Warning', hue: 'amber' },
  'toggle.welcomeLight': { icon: 'Sun', hue: 'lilac' },
  'toggle.brakeForce': { icon: 'Gauge', hue: 'rose' },
  'flash.highBeam': { icon: 'Headlights', hue: 'blue' },
  'flash.fogFront': { icon: 'CloudFog', hue: 'teal' },
  'flash.indicatorLeft': { icon: 'ArrowBendUpLeft', hue: 'amber' },
  'flash.indicatorRight': { icon: 'ArrowBendUpRight', hue: 'amber' },
};

const FALLBACK: Appearance = { icon: 'Lightning', hue: 'neutral' };

export const effectAppearance = (effectId: string, pack: string) => {
  const appearance = EFFECT_APPEARANCE[effectId] ?? PACK_APPEARANCE[pack] ?? FALLBACK;

  return {
    icon: ICON_REGISTRY[appearance.icon].icon,
    iconName: appearance.icon,
    hue: appearance.hue,
  };
};
