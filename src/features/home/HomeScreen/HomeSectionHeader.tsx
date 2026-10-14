import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import Text from '@/ui/Text';

import type { SectionKey } from './helpers';
import type { HomeHandlers } from './useHomeHandlers';

interface HomeSectionHeaderProps {
  section: SectionKey;
  handlers: HomeHandlers;
  isFirst: boolean;
}

interface HeaderAction {
  label: string;
  onPress: () => void;
}

const HomeSectionHeader = ({ section, handlers, isFirst }: HomeSectionHeaderProps) => {
  const { t } = useTranslation();

  const titles: Record<SectionKey, string> = {
    favourites: t('home.favourites'),
    predefined: t('home.predefined'),
    presets: t('home.myPresets'),
  };
  const actions: Record<SectionKey, HeaderAction[]> = {
    favourites: [{ label: t('common.edit'), onPress: handlers.onEditFavourites }],
    predefined: [{ label: t('common.seeAll'), onPress: handlers.onSeeAll }],
    presets: [
      { label: t('home.import'), onPress: handlers.onImport },
      { label: t('common.new'), onPress: handlers.onNewPreset },
    ],
  };

  const rowClassName = isFirst
    ? 'min-h-7 flex-row items-center justify-between'
    : 'mt-8 min-h-7 flex-row items-center justify-between';

  return (
    <View className={rowClassName}>
      <Text variant="section" accessibilityRole="header">
        {titles[section]}
      </Text>
      <View className="flex-row items-center gap-2">
        {actions[section].map((action) => (
          <Pressable
            key={action.label}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            onPress={action.onPress}
            className="-my-2 min-h-touch justify-center px-1 active:opacity-60"
          >
            <Text variant="label" tone="soft">
              {action.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
};

export default HomeSectionHeader;
