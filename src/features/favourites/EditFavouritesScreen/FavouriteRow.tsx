import { DotsSixVerticalIcon } from 'phosphor-react-native/src/icons/DotsSixVertical';
import { MinusIcon } from 'phosphor-react-native/src/icons/Minus';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useReorderableDrag } from 'react-native-reorderable-list';

import Text from '@/ui/Text';
import { useColorToken } from '@/ui/theme';
import type { TileItem } from '@/ui/tile/types';

interface FavouriteRowProps {
  item: TileItem;
  onRemove: (id: string) => void;
}

const FavouriteRow = ({ item, onRemove }: FavouriteRowProps) => {
  const { t } = useTranslation();
  const drag = useReorderableDrag();
  const hue = useColorToken(item.hue);
  const text = useColorToken('text');
  const grip = useColorToken('text-muted');
  const IconComponent = item.icon;

  const handleRemovePress = useCallback(() => onRemove(item.id), [item.id, onRemove]);

  return (
    <View className="mb-2 min-h-16 flex-row items-center rounded-card border border-card-border bg-card pl-1 pr-2">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('favourites.removeLabel', { name: item.name })}
        onPress={handleRemovePress}
        className="size-touch items-center justify-center active:opacity-60"
      >
        <View className="size-6 items-center justify-center rounded-pill bg-raised">
          <MinusIcon size={12} weight="bold" color={text} />
        </View>
      </Pressable>
      <IconComponent size={24} color={hue} />
      <View className="ml-3 flex-1">
        <Text variant="bodyMedium" numberOfLines={1}>
          {item.name}
        </Text>
        <Text variant="small" tone="muted" numberOfLines={1}>
          {item.tag}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('favourites.dragLabel', { name: item.name })}
        onPressIn={drag}
        className="size-touch items-center justify-center"
      >
        <DotsSixVerticalIcon size={22} color={grip} />
      </Pressable>
    </View>
  );
};

export default memo(FavouriteRow);
