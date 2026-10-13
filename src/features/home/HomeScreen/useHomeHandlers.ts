import { useRouter } from 'expo-router';
import { useMemo } from 'react';

import { usePresetTransfer } from '@/features/preset/usePresetTransfer';
import type { TileItem } from '@/ui/tile/types';

export interface HomeHandlers {
  onMenuPress: (item: TileItem) => void;
  onEditFavourites: () => void;
  onSeeAll: () => void;
  onNewPreset: () => void;
  onImport: () => void;
  onConnect: () => void;
}

export const useHomeHandlers = (): HomeHandlers => {
  const router = useRouter();
  const { importFromFile } = usePresetTransfer();

  return useMemo(
    () => ({
      onMenuPress: (item) => router.push({ pathname: '/tile-menu', params: { id: item.id } }),
      onEditFavourites: () => router.push('/favourites/edit'),
      onSeeAll: () => router.push('/library'),
      onNewPreset: () => router.push({ pathname: '/preset/[id]', params: { id: 'new' } }),
      onImport: () => void importFromFile(),
      onConnect: () => router.navigate('/'),
    }),
    [router, importFromFile],
  );
};
