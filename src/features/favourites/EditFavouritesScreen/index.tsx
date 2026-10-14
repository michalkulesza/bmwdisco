import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import ReorderableList, { type ReorderableListReorderEvent } from 'react-native-reorderable-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { loadEffects } from '@/data/generated';
import { curatedEffects, resolveFavourites } from '@/features/home/HomeScreen/helpers';
import { moveItem } from '@/features/preset/helpers';
import { useSessionSelector } from '@/session';
import { FAVOURITE_SIZES, useFavouritesStore, type FavouriteSize } from '@/stores/favourites';
import { usePresetsStore } from '@/stores/presets';
import { SCREEN_TOP_PADDING } from '@/ui/layout';
import SectionHeader from '@/ui/SectionHeader';
import SegmentedControl, { type SegmentedOption } from '@/ui/SegmentedControl';
import Text from '@/ui/Text';
import type { TileItem } from '@/ui/tile/types';

import AddFavouriteSection from './AddFavouriteSection';
import FavouriteRow from './FavouriteRow';
import { buildCandidates } from './helpers';

const getItemKey = (item: TileItem) => item.id;

const EditFavouritesScreen = () => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const car = useSessionSelector((snapshot) => snapshot.context.car);
  const presets = usePresetsStore((state) => state.presets);
  const ids = useFavouritesStore((state) => state.ids);
  const size = useFavouritesStore((state) => state.size);
  const add = useFavouritesStore((state) => state.add);
  const remove = useFavouritesStore((state) => state.remove);
  const setOrder = useFavouritesStore((state) => state.setOrder);
  const setSize = useFavouritesStore((state) => state.setSize);

  const effects = useMemo(() => loadEffects(), []);
  const items = useMemo(
    () => resolveFavourites({ presets, favouriteIds: ids, effects, car, t }),
    [presets, ids, effects, car, t],
  );
  const candidates = useMemo(
    () =>
      buildCandidates({
        favouriteIds: ids,
        presets,
        predefined: curatedEffects(effects, car),
        car,
        t,
      }),
    [ids, presets, effects, car, t],
  );
  const sizeOptions: SegmentedOption<FavouriteSize>[] = FAVOURITE_SIZES.map((value) => ({
    value,
    label: t(`favourites.sizes.${value}`),
  }));
  const contentStyle = useMemo(
    () => ({
      paddingHorizontal: 16,
      paddingTop: SCREEN_TOP_PADDING,
      paddingBottom: insets.bottom + 24,
    }),
    [insets.bottom],
  );

  const handleReorder = useCallback(
    ({ from, to }: ReorderableListReorderEvent) => {
      setOrder(moveItem(items, from, to).map((item) => item.id));
    },
    [items, setOrder],
  );

  const renderItem = useCallback(
    ({ item }: { item: TileItem }) => <FavouriteRow item={item} onRemove={remove} />,
    [remove],
  );

  const header = (
    <View className="gap-3 pb-4">
      <View className="gap-2">
        <SectionHeader title={t('favourites.tileSize')} />
        <SegmentedControl
          options={sizeOptions}
          value={size}
          onChange={setSize}
          accessibilityLabel={t('favourites.tileSize')}
        />
      </View>
      <Text variant="small" tone="muted">
        {t('favourites.hint')}
      </Text>
    </View>
  );

  return (
    <ReorderableList
      data={items}
      keyExtractor={getItemKey}
      renderItem={renderItem}
      onReorder={handleReorder}
      ListHeaderComponent={header}
      ListFooterComponent={<AddFavouriteSection candidates={candidates} onAdd={add} />}
      contentContainerStyle={contentStyle}
      contentInsetAdjustmentBehavior="automatic"
      className="flex-1 bg-page"
    />
  );
};

export default EditFavouritesScreen;
