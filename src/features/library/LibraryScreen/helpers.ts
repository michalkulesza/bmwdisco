import type { Effect } from '@/data/types';
import type { DetectedCar } from '@/domain';
import { packKey, translateKey } from '@/ui/tile/helpers';
import { effectItem } from '@/ui/tile/items';
import type { TileItem } from '@/ui/tile/types';

import type { TFunction } from 'i18next';

export interface LibrarySection {
  pack: string;
  title: string;
  data: TileItem[];
}

const PACK_ORDER: readonly string[] = [
  'flash',
  'headlight_flash',
  'headlight_show',
  'taillight_show',
  'one_side',
  'party_mode',
  'ghost',
  'toggle',
];

export const normalizeQuery = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

const packRank = (pack: string): number => {
  const index = PACK_ORDER.indexOf(pack);

  return index === -1 ? PACK_ORDER.length : index;
};

export const buildLibrarySections = (
  effects: readonly Effect[],
  car: DetectedCar | undefined,
  query: string,
  t: TFunction,
): LibrarySection[] => {
  const needle = normalizeQuery(query);
  const sections = new Map<string, TileItem[]>();

  effects.forEach((effect) => {
    const item = effectItem(effect, t, car);
    if (needle && !normalizeQuery(item.name).includes(needle)) return;

    const items = sections.get(effect.pack) ?? [];
    items.push(item);
    sections.set(effect.pack, items);
  });

  return [...sections.entries()]
    .sort(([a], [b]) => packRank(a) - packRank(b))
    .map(([pack, data]) => ({
      pack,
      title: translateKey(t, `packs.${packKey(pack)}`),
      data: [...data].sort(
        (a, b) =>
          Number(a.availability === 'unsupported') - Number(b.availability === 'unsupported'),
      ),
    }));
};

export const hasUnsupported = (sections: readonly LibrarySection[]): boolean =>
  sections.some((section) => section.data.some((item) => item.availability === 'unsupported'));
