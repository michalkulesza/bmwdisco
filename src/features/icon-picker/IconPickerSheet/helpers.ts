import { normalizeQuery } from '@/features/library/LibraryScreen/helpers';
import { translateKey } from '@/ui/tile/helpers';
import {
  ICON_NAMES,
  ICON_REGISTRY,
  type IconCategory,
  type IconName,
} from '@/ui/tile/icon-registry';

import type { TFunction } from 'i18next';

export type CategoryFilter = 'all' | IconCategory;

export const CATEGORY_FILTERS: readonly CategoryFilter[] = [
  'all',
  'lights',
  'signals',
  'vehicle',
  'fun',
];

export const filterIcons = (category: CategoryFilter, query: string, t: TFunction): IconName[] => {
  const needle = normalizeQuery(query);

  return ICON_NAMES.filter((name) => {
    if (category !== 'all' && ICON_REGISTRY[name].category !== category) return false;

    return !needle || normalizeQuery(translateKey(t, `iconPicker.icons.${name}`)).includes(needle);
  });
};
