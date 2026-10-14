import { useRouter } from 'expo-router';
import { MagnifyingGlassIcon } from 'phosphor-react-native/src/icons/MagnifyingGlass';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SectionList, View, type SectionListData } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { loadEffects } from '@/data/generated';
import { useSessionSelector } from '@/session';
import EmptyState from '@/ui/EmptyState';
import { SCREEN_TOP_PADDING } from '@/ui/layout';
import Text from '@/ui/Text';
import type { TileItem } from '@/ui/tile/types';

import SearchField from '../SearchField';

import { buildLibrarySections, hasUnsupported, type LibrarySection } from './helpers';
import LibraryRow from './LibraryRow';

const getItemKey = (item: TileItem) => item.id;

const ItemSeparator = () => <View className="h-2" />;

const LibrarySectionHeader = ({
  section,
}: {
  section: SectionListData<TileItem, LibrarySection>;
}) => (
  <Text variant="section" accessibilityRole="header" className="pb-3 pt-6">
    {section.title}
  </Text>
);

const LibraryScreen = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const car = useSessionSelector((snapshot) => snapshot.context.car);
  const [query, setQuery] = useState('');

  const effects = useMemo(() => loadEffects(), []);
  const sections = useMemo(
    () => buildLibrarySections(effects, car, query, t),
    [effects, car, query, t],
  );
  const contentStyle = useMemo(
    () => ({
      paddingHorizontal: 16,
      paddingTop: SCREEN_TOP_PADDING,
      paddingBottom: insets.bottom + 24,
    }),
    [insets.bottom],
  );

  const handleMenuPress = useCallback(
    (item: TileItem) => router.push({ pathname: '/tile-menu', params: { id: item.id } }),
    [router],
  );

  const renderItem = useCallback(
    ({ item }: { item: TileItem }) => <LibraryRow item={item} onMenuPress={handleMenuPress} />,
    [handleMenuPress],
  );

  const searchField = (
    <SearchField value={query} onChangeText={setQuery} placeholder={t('library.search')} />
  );
  const footer =
    hasUnsupported(sections) && car ? (
      <Text variant="small" tone="muted" className="pt-4">
        {t('library.notOnCarNote')}
      </Text>
    ) : null;

  return (
    <SectionList<TileItem, LibrarySection>
      sections={sections}
      keyExtractor={getItemKey}
      renderItem={renderItem}
      renderSectionHeader={LibrarySectionHeader}
      ItemSeparatorComponent={ItemSeparator}
      ListHeaderComponent={searchField}
      ListFooterComponent={footer}
      ListEmptyComponent={<EmptyState icon={MagnifyingGlassIcon} title={t('library.empty')} />}
      stickySectionHeadersEnabled={false}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={contentStyle}
      className="flex-1 bg-page"
    />
  );
};

export default LibraryScreen;
