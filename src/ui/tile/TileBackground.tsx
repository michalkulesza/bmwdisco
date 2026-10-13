import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { useColorToken } from '@/ui/theme';

import { getFrameSize, TILE_RADIUS, withAlpha } from './helpers';

import type { TileSize, TileVisual } from './types';
import type { ReactNode } from 'react';

const BORDER_WIDTH = 1.5;
const GRADIENT_START = { x: 0, y: 0 } as const;
const GRADIENT_END = { x: 1, y: 1 } as const;
const GLOW_START = { x: 1, y: 1 } as const;
const GLOW_END = { x: 0.35, y: 0.35 } as const;

interface TileBackgroundProps {
  size: TileSize;
  side: number;
  visual: TileVisual;
  hue: string | undefined;
  children: ReactNode;
}

const getFrameStyle = (size: TileSize, side: number): ViewStyle => ({
  ...getFrameSize(size, side),
  borderRadius: TILE_RADIUS[size],
});

const TileBackground = ({ size, side, visual, hue, children }: TileBackgroundProps) => {
  const edge = useColorToken('border');
  const destructive = useColorToken('destructive');
  const frame = getFrameStyle(size, side);
  const innerRadius = TILE_RADIUS[size] - BORDER_WIDTH;

  if (visual === 'disabled') {
    return (
      <View
        className="overflow-hidden border border-dashed"
        style={[frame, styles.disabled, { borderColor: edge }]}
      >
        {children}
      </View>
    );
  }

  if (visual === 'running' || visual === 'on') {
    return <View style={[frame, styles.clip, { backgroundColor: hue }]}>{children}</View>;
  }

  const edgeColor = edge ?? 'transparent';
  const accent = visual === 'error' ? destructive : hue;
  const borderColors: [string, string, string] = [
    accent ?? 'transparent',
    withAlpha(accent, visual === 'error' ? 0.4 : 0.25),
    edgeColor,
  ];
  const glowColors: [string, string] = [
    withAlpha(hue, visual === 'justRan' ? 0.4 : 0.15),
    withAlpha(hue, 0),
  ];

  return (
    <LinearGradient
      colors={borderColors}
      start={GRADIENT_START}
      end={GRADIENT_END}
      locations={[0, 0.42, 1]}
      style={[frame, styles.border]}
    >
      <View className="flex-1 overflow-hidden bg-tile" style={{ borderRadius: innerRadius }}>
        <LinearGradient
          pointerEvents="none"
          colors={glowColors}
          start={GLOW_START}
          end={GLOW_END}
          style={StyleSheet.absoluteFill}
        />
        {children}
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  border: { padding: BORDER_WIDTH },
  clip: { overflow: 'hidden' },
  disabled: { opacity: 0.55 },
});

export default TileBackground;
