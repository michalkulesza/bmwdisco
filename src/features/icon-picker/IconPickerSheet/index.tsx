import { useRouter } from 'expo-router';
import { MagnifyingGlassIcon } from 'phosphor-react-native/src/icons/MagnifyingGlass';
import { XIcon } from 'phosphor-react-native/src/icons/X';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, View, type ListRenderItemInfo } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import SearchField from '@/features/library/SearchField';
import { useDraftStore } from '@/features/preset/draft-store';
import Button from '@/ui/Button';
import EmptyState from '@/ui/EmptyState';
import Text from '@/ui/Text';
import { useColorToken } from '@/ui/theme';
import { hueOf } from '@/ui/tile/helpers';
import { type IconName } from '@/ui/tile/icon-registry';

import CategoryPills from './CategoryPills';
import { filterIcons, type CategoryFilter } from './helpers';
import IconCell from './IconCell';

const getIconKey = (name: IconName) => name;

const IconPickerSheet = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const close = useColorToken('text-muted');
  const icon = useDraftStore((state) => state.icon);
  const color = useDraftStore((state) => state.color);
  const setIcon = useDraftStore((state) => state.setIcon);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');

  const hue = hueOf(color);
  const icons = useMemo(() => filterIcons(category, query, t), [category, query, t]);

  const handleClosePress = useCallback(() => router.back(), [router]);

  const renderIcon = useCallback(
    ({ item }: ListRenderItemInfo<IconName>) => (
      <IconCell name={item} selected={item === icon} hue={hue} onSelect={setIcon} />
    ),
    [hue, icon, setIcon],
  );

  return (
    <View className="flex-1 gap-4 px-4 pt-6" style={{ paddingBottom: insets.bottom + 16 }}>
      <View className="flex-row items-center justify-between">
        <Text variant="section" accessibilityRole="header">
          {t('iconPicker.title')}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          onPress={handleClosePress}
          className="size-touch items-center justify-center active:opacity-60"
        >
          <XIcon size={20} color={close} />
        </Pressable>
      </View>
      <SearchField value={query} onChangeText={setQuery} placeholder={t('iconPicker.search')} />
      <CategoryPills value={category} onChange={setCategory} />
      <FlatList
        data={icons}
        keyExtractor={getIconKey}
        renderItem={renderIcon}
        numColumns={5}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<EmptyState icon={MagnifyingGlassIcon} title={t('iconPicker.empty')} />}
        className="flex-1"
      />
      <Button label={t('common.done')} onPress={handleClosePress} />
    </View>
  );
};

export default IconPickerSheet;
