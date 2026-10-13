import { Stack } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, useWindowDimensions, type ListRenderItemInfo } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { loadEffects } from '@/data/generated';
import { useSessionSelector } from '@/session';
import { useFavouritesStore } from '@/stores/favourites';
import { usePresetsStore } from '@/stores/presets';

import { buildHomeRows, type HomeRow } from './helpers';
import HomeRowView, { SCREEN_PADDING } from './HomeRowView';
import SettingsButton from './SettingsButton';
import { useHomeHandlers } from './useHomeHandlers';

const renderSettingsButton = () => <SettingsButton />;

const getRowKey = (row: HomeRow) => row.key;

const HomeScreen = () => {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const handlers = useHomeHandlers();
  const car = useSessionSelector((snapshot) => snapshot.context.car);
  const presets = usePresetsStore((state) => state.presets);
  const favouriteIds = useFavouritesStore((state) => state.ids);
  const size = useFavouritesStore((state) => state.size);

  const effects = useMemo(() => loadEffects(), []);
  const rows = useMemo(
    () => buildHomeRows({ presets, favouriteIds, size, effects, car, t }),
    [presets, favouriteIds, size, effects, car, t],
  );
  const contentStyle = useMemo(
    () => ({ paddingHorizontal: SCREEN_PADDING, paddingBottom: insets.bottom + 24 }),
    [insets.bottom],
  );

  const renderRow = useCallback(
    ({ item }: ListRenderItemInfo<HomeRow>) => (
      <HomeRowView row={item} width={width} handlers={handlers} />
    ),
    [width, handlers],
  );

  return (
    <>
      <Stack.Screen options={{ headerRight: renderSettingsButton }} />
      <FlatList
        data={rows}
        keyExtractor={getRowKey}
        renderItem={renderRow}
        contentContainerStyle={contentStyle}
        contentInsetAdjustmentBehavior="automatic"
        className="flex-1 bg-page"
      />
    </>
  );
};

export default HomeScreen;
