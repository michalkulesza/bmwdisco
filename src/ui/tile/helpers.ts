import type { TileStatus } from '@/domain';
import type { HueToken } from '@/ui/theme';

import type { TileAvailability, TileItem, TileSize, TileVisual } from './types';
import type { TFunction } from 'i18next';

export const translateKey = (
  t: TFunction,
  key: string,
  options?: Record<string, unknown>,
): string => String(t(key as never, options as never));

export const HUE_TOKENS: readonly HueToken[] = [
  'blue',
  'amber',
  'teal',
  'lime',
  'rose',
  'violet',
  'lilac',
  'neutral',
];

export const hueOf = (color: string): HueToken =>
  HUE_TOKENS.find((hue) => hue === color) ?? 'neutral';

export const LARGE_TILE = { width: 268, height: 164 } as const;

export const TILE_RADIUS: Record<TileSize, number> = { large: 24, square: 22, small: 18 };

export const getFrameSize = (size: TileSize, side: number) =>
  size === 'large' ? LARGE_TILE : { width: side, height: side };

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export const withAlpha = (color: string | undefined, alpha: number): string => {
  if (!color || !HEX_COLOR.test(color)) return 'transparent';
  const channel = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0');

  return `${color}${channel}`;
};

export const deriveVisual = (
  availability: TileAvailability,
  status: TileStatus | undefined,
  toggledOn: boolean,
): TileVisual => {
  if (availability !== 'available') return 'disabled';
  if (status?.state === 'error') return 'error';
  if (status?.state === 'running') return 'running';
  if (status?.state === 'justRan') return 'justRan';

  return toggledOn ? 'on' : 'idle';
};

export const tileTag = (
  item: TileItem,
  visual: TileVisual,
  status: TileStatus | undefined,
  toggledOn: boolean,
  t: TFunction,
): string => {
  if (visual === 'running') return t('tile.running');
  if (visual === 'error') {
    const reason = status?.reason;
    return reason &&
      [
        'equipmentUnknown',
        'equipmentConflict',
        'confirmationRequired',
        'missingOutput',
        'missingModule',
        'noSemanticMapping',
        'commandRejected',
      ].includes(reason)
      ? translateKey(t, `actions.reasons.${reason}`)
      : translateKey(t, `tile.error.${reason ?? 'unknown'}`);
  }
  if (visual === 'disabled') {
    if (item.unavailableReason) return translateKey(t, `actions.reasons.${item.unavailableReason}`);
    return item.availability === 'unsupported' ? t('tile.notOnCar') : t('tile.notConnected');
  }
  if (visual === 'justRan') return t('tile.done');
  if (item.toggle) return toggledOn ? t('tile.on') : t('tile.off');

  return item.tag;
};

export const formatSeconds = (ms: number): string => {
  const seconds = Math.round(ms / 10) / 100;

  return String(seconds);
};

export const packKey = (pack: string): string =>
  pack.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
