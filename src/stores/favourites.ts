import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { kvStorage } from './kv-storage';

export type FavouriteSize = 'small' | 'regular' | 'large';

export const FAVOURITE_SIZES: readonly FavouriteSize[] = ['small', 'regular', 'large'];

const DEFAULT_IDS = ['seed-double-flash', 'toggle.hazard', 'flash.highBeam'];

const isFavouriteSize = (value: unknown): value is FavouriteSize =>
  FAVOURITE_SIZES.includes(value as FavouriteSize);

interface FavouritesState {
  ids: string[];
  size: FavouriteSize;
  add: (id: string) => void;
  remove: (id: string) => void;
  setOrder: (ids: readonly string[]) => void;
  setSize: (size: FavouriteSize) => void;
}

export const useFavouritesStore = create<FavouritesState>()(
  persist(
    (set) => ({
      ids: DEFAULT_IDS,
      size: 'regular',

      add: (id) => set((state) => (state.ids.includes(id) ? state : { ids: [...state.ids, id] })),

      remove: (id) => set((state) => ({ ids: state.ids.filter((existing) => existing !== id) })),

      setOrder: (ids) => set({ ids: [...new Set(ids)] }),

      setSize: (size) => set({ size }),
    }),
    {
      name: 'favourites',
      version: 1,
      storage: kvStorage,
      partialize: ({ ids, size }) => ({ ids, size }),
      merge: (persisted, current) => {
        const stored = persisted as Partial<FavouritesState> | undefined;
        const ids = Array.isArray(stored?.ids)
          ? stored.ids.filter((id): id is string => typeof id === 'string')
          : current.ids;
        const size = isFavouriteSize(stored?.size) ? stored.size : current.size;

        return { ...current, ids, size };
      },
    },
  ),
);
