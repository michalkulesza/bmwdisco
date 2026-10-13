import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import Text from '@/ui/Text';
import { useColorToken } from '@/ui/theme';

import { withAlpha } from './helpers';

import type { TileItem, TileSize, TileVisual } from './types';

const SCRIM_START = { x: 0.5, y: 1 } as const;
const SCRIM_END = { x: 0.5, y: 0.38 } as const;

interface TileBodyProps {
  item: TileItem;
  size: TileSize;
  visual: TileVisual;
  tag: string;
}

const getGhostStyle = (size: TileSize) =>
  size === 'large' ? styles.ghostLarge : styles.ghostSquare;

const getIconSize = (size: TileSize) => (size === 'large' ? 30 : 28);

const TileBody = ({ item, size, visual, tag }: TileBodyProps) => {
  const hue = useColorToken(item.hue);
  const page = useColorToken('page');
  const destructive = useColorToken('destructive');
  const IconComponent = item.icon;
  const filled = visual === 'running' || visual === 'on';
  const accent = filled ? page : hue;
  const tagColor = visual === 'error' ? destructive : accent;
  const scrimColors: [string, string] = [withAlpha(page, 0.7), withAlpha(page, 0)];
  const isLarge = size === 'large';
  const padding = isLarge ? 18 : 16;

  return (
    <View className="flex-1 justify-between" style={{ padding }}>
      <View pointerEvents="none" style={getGhostStyle(size)}>
        <IconComponent size={isLarge ? 240 : 190} weight="thin" color={accent} />
      </View>
      {filled ? null : (
        <LinearGradient
          pointerEvents="none"
          colors={scrimColors}
          start={SCRIM_START}
          end={SCRIM_END}
          style={StyleSheet.absoluteFill}
        />
      )}
      <IconComponent size={getIconSize(size)} color={accent} />
      <View className="gap-1">
        <Text
          variant={isLarge ? 'section' : 'heading'}
          style={filled ? { color: page } : undefined}
          numberOfLines={2}
        >
          {item.name}
        </Text>
        <Text variant={isLarge ? 'small' : 'tag'} style={{ color: tagColor }} numberOfLines={2}>
          {tag}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  ghostLarge: {
    position: 'absolute',
    right: -70,
    top: -44,
    opacity: 0.16,
    transform: [{ rotate: '-14deg' }],
  },
  ghostSquare: {
    position: 'absolute',
    right: -62,
    bottom: -56,
    opacity: 0.16,
    transform: [{ rotate: '-14deg' }],
  },
});

export default TileBody;
