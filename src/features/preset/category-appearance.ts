import type { ElementCategory } from '@/data/elements';
import type { HueToken } from '@/ui/theme';
import { iconByName } from '@/ui/tile/icon-registry';

interface CategoryAppearance {
  icon: string;
  hue: HueToken;
}

const CATEGORY_APPEARANCE: Record<ElementCategory, CategoryAppearance> = {
  front: { icon: 'Headlights', hue: 'blue' },
  indicators: { icon: 'ArrowBendUpLeft', hue: 'amber' },
  fog: { icon: 'CloudFog', hue: 'teal' },
  rear: { icon: 'Siren', hue: 'rose' },
  interior: { icon: 'Lamp', hue: 'lilac' },
  headlightLeds: { icon: 'Sparkle', hue: 'violet' },
  cluster: { icon: 'Gauge', hue: 'neutral' },
  other: { icon: 'Power', hue: 'neutral' },
};

export const CATEGORY_ORDER: readonly ElementCategory[] = [
  'front',
  'indicators',
  'fog',
  'rear',
  'interior',
  'headlightLeds',
  'cluster',
  'other',
];

export const categoryAppearance = (category: ElementCategory) => {
  const { icon, hue } = CATEGORY_APPEARANCE[category];

  return { icon: iconByName(icon), hue };
};
