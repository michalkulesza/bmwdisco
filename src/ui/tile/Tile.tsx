import { DotsThreeVerticalIcon } from 'phosphor-react-native/src/icons/DotsThreeVertical';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { useColorToken } from '@/ui/theme';

import { getFrameSize, tileTag } from './helpers';
import SmallTileBody from './SmallTileBody';
import TileBackground from './TileBackground';
import TileBody from './TileBody';
import { useTilePress, useTileView } from './useTileView';

import type { TileItem, TileSize } from './types';

const DEFAULT_SIDE = 82;

interface TileProps {
  item: TileItem;
  size: TileSize;
  side?: number;
  onMenuPress: (item: TileItem) => void;
}

const getMenuPosition = (size: TileSize) => (size === 'small' ? styles.menuSmall : styles.menu);

const Tile = ({ item, size, side = DEFAULT_SIDE, onMenuPress }: TileProps) => {
  const { t } = useTranslation();
  const { status, toggledOn, visual } = useTileView(item);
  const hue = useColorToken(item.hue);
  const soft = useColorToken('text-soft');
  const handlePress = useTilePress(item, visual, toggledOn);

  const handleMenuPress = useCallback(() => onMenuPress(item), [item, onMenuPress]);

  const running = visual === 'running';
  const tag = tileTag(item, visual, status, toggledOn, t);
  const label = running ? t('tile.stopLabel', { name: item.name }) : `${item.name}, ${tag}`;
  const accessibilityState = {
    disabled: visual === 'disabled',
    checked: item.toggle ? toggledOn : undefined,
  };

  return (
    <View style={getFrameSize(size, side)}>
      <Pressable
        accessibilityRole={item.toggle ? 'switch' : 'button'}
        accessibilityLabel={label}
        accessibilityState={accessibilityState}
        onPress={handlePress}
        onLongPress={handleMenuPress}
        style={styles.fill}
      >
        <TileBackground size={size} side={side} visual={visual} hue={hue}>
          {size === 'small' ? (
            <SmallTileBody item={item} visual={visual} />
          ) : (
            <TileBody item={item} size={size} visual={visual} tag={tag} />
          )}
        </TileBackground>
      </Pressable>
      {running ? null : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('tile.menuLabel', { name: item.name })}
          onPress={handleMenuPress}
          className="size-touch items-center justify-center active:opacity-60"
          style={getMenuPosition(size)}
        >
          <DotsThreeVerticalIcon size={18} weight="bold" color={soft} />
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1 },
  menu: { position: 'absolute', top: 4, right: 4 },
  menuSmall: { position: 'absolute', top: -8, right: -10 },
});

export default memo(Tile);
