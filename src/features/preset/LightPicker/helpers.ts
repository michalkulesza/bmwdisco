import { categoryOf, type ElementCategory, type ElementId } from '@/data/elements';

import { CATEGORY_ORDER } from '../category-appearance';

export const LIST_MAX_HEIGHT = 320;
const GROUP_HEIGHT = 36;
const OPTION_HEIGHT = 48;

export type ElementListRow =
  { type: 'group'; category: ElementCategory } | { type: 'item'; id: ElementId };

export const groupElements = (ids: readonly ElementId[]): ElementListRow[] =>
  CATEGORY_ORDER.flatMap((category) => {
    const items = ids.filter((id) => categoryOf(id) === category);

    return items.length === 0
      ? []
      : [
          { type: 'group' as const, category },
          ...items.map((id) => ({ type: 'item' as const, id })),
        ];
  });

export const selectedRowOffset = (
  rows: readonly ElementListRow[],
  selected: ElementId | undefined,
) => {
  const selectedIndex = rows.findIndex((row) => row.type === 'item' && row.id === selected);

  return rows
    .slice(0, Math.max(0, selectedIndex))
    .reduce((offset, row) => offset + (row.type === 'group' ? GROUP_HEIGHT : OPTION_HEIGHT), 0);
};
