import { StopIcon } from 'phosphor-react-native/src/icons/Stop';
import { View } from 'react-native';

import { useColorToken } from '@/ui/theme';

import type { TileItem, TileVisual } from './types';

interface SmallTileBodyProps {
  item: TileItem;
  visual: TileVisual;
}

const SmallTileBody = ({ item, visual }: SmallTileBodyProps) => {
  const hue = useColorToken(item.hue);
  const page = useColorToken('page');
  const IconComponent = item.icon;

  if (visual === 'running') {
    return (
      <View className="flex-1 items-center justify-center">
        <View className="size-touch items-center justify-center rounded-pill bg-page">
          <StopIcon size={16} weight="fill" color={hue} />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 items-center justify-center">
      <IconComponent size={30} color={visual === 'on' ? page : hue} />
    </View>
  );
};

export default SmallTileBody;
