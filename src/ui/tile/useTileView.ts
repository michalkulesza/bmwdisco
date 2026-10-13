import { useCallback } from 'react';

import { useSessionActions, useSessionSelector } from '@/session';
import { selectionHaptic } from '@/ui/haptics';

import { deriveVisual } from './helpers';

import type { TileItem, TileVisual } from './types';

export const useTileView = (item: TileItem) => {
  const status = useSessionSelector((snapshot) => snapshot.context.tiles[item.id]);
  const toggledOn = useSessionSelector((snapshot) =>
    snapshot.context.activeToggles.includes(item.id),
  );
  const visual = deriveVisual(item.availability, status, toggledOn);

  return { status, toggledOn, visual };
};

export const useTilePress = (item: TileItem, visual: TileVisual, toggledOn: boolean) => {
  const { run, stop, toggle } = useSessionActions();

  return useCallback(() => {
    if (visual === 'disabled') return;
    selectionHaptic();

    if (visual === 'running') stop();
    else if (item.toggle) toggle(item.id, !toggledOn);
    else run(item.run);
  }, [item, run, stop, toggle, toggledOn, visual]);
};
