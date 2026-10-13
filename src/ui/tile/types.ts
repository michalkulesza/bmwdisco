import type { RunInput } from '@/domain';
import type { HueToken } from '@/ui/theme';

import type { Icon } from 'phosphor-react-native';

export type TileSize = 'small' | 'square' | 'large';

export type TileAvailability = 'available' | 'unsupported' | 'offline';

export type TileVisual = 'idle' | 'running' | 'justRan' | 'error' | 'on' | 'disabled';

export interface TileItem {
  id: string;
  kind: 'preset' | 'effect';
  name: string;
  tag: string;
  icon: Icon;
  hue: HueToken;
  toggle: boolean;
  run: RunInput;
  availability: TileAvailability;
}
