import { View } from 'react-native';

import Text from '@/ui/Text';
import { useColorToken } from '@/ui/theme';
import type { TileItem } from '@/ui/tile/types';

interface MenuHeaderProps {
  item: TileItem;
}

const MenuHeader = ({ item }: MenuHeaderProps) => {
  const hue = useColorToken(item.hue);
  const IconComponent = item.icon;

  return (
    <View className="flex-row items-center gap-3.5">
      <View
        className="size-14 items-center justify-center rounded-card border-[1.5px] bg-tile"
        style={{ borderColor: hue }}
      >
        <IconComponent size={28} color={hue} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text variant="heading" numberOfLines={2}>
          {item.name}
        </Text>
        <Text variant="small" style={{ color: hue }}>
          {item.tag}
        </Text>
      </View>
    </View>
  );
};

export default MenuHeader;
