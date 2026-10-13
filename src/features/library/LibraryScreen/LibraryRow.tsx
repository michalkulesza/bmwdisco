import { DotsThreeVerticalIcon } from 'phosphor-react-native/src/icons/DotsThreeVertical';
import { StopIcon } from 'phosphor-react-native/src/icons/Stop';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import Text from '@/ui/Text';
import { useColorToken } from '@/ui/theme';
import { tileTag } from '@/ui/tile/helpers';
import type { TileItem } from '@/ui/tile/types';
import { useTilePress, useTileView } from '@/ui/tile/useTileView';

interface LibraryRowProps {
  item: TileItem;
  onMenuPress: (item: TileItem) => void;
}

const LibraryRow = ({ item, onMenuPress }: LibraryRowProps) => {
  const { t } = useTranslation();
  const { status, toggledOn, visual } = useTileView(item);
  const hue = useColorToken(item.hue);
  const soft = useColorToken('text-soft');
  const handlePress = useTilePress(item, visual, toggledOn);
  const IconComponent = item.icon;

  const handleMenuPress = useCallback(() => onMenuPress(item), [item, onMenuPress]);

  const running = visual === 'running';
  const disabled = visual === 'disabled';
  const tag = tileTag(item, visual, status, toggledOn, t);
  const label = running ? t('tile.stopLabel', { name: item.name }) : `${item.name}, ${tag}`;

  return (
    <View
      className="min-h-14 flex-row items-center rounded-card border border-card-border bg-card pl-3"
      style={disabled ? { opacity: 0.5 } : undefined}
    >
      <Pressable
        accessibilityRole={item.toggle ? 'switch' : 'button'}
        accessibilityLabel={label}
        accessibilityState={{ disabled, checked: item.toggle ? toggledOn : undefined }}
        onPress={handlePress}
        onLongPress={handleMenuPress}
        className="min-h-14 flex-1 flex-row items-center gap-3 active:opacity-60"
      >
        <IconComponent size={24} color={hue} />
        <View className="flex-1">
          <Text variant="bodyMedium" numberOfLines={2}>
            {item.name}
          </Text>
          <Text variant="small" tone={visual === 'error' ? 'destructive' : 'muted'}>
            {tag}
          </Text>
        </View>
        {running ? <StopIcon size={18} weight="fill" color={hue} /> : null}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('tile.menuLabel', { name: item.name })}
        onPress={handleMenuPress}
        className="size-touch items-center justify-center active:opacity-60"
      >
        <DotsThreeVerticalIcon size={18} weight="bold" color={soft} />
      </Pressable>
    </View>
  );
};

export default memo(LibraryRow);
