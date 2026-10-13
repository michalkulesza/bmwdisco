import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { useColorToken, type HueToken } from '@/ui/theme';
import { translateKey, withAlpha } from '@/ui/tile/helpers';
import { ICON_REGISTRY, type IconName } from '@/ui/tile/icon-registry';

interface IconCellProps {
  name: IconName;
  selected: boolean;
  hue: HueToken;
  onSelect: (name: IconName) => void;
}

const IconCell = ({ name, selected, hue, onSelect }: IconCellProps) => {
  const { t } = useTranslation();
  const hueColor = useColorToken(hue);
  const text = useColorToken('text');
  const IconComponent = ICON_REGISTRY[name].icon;

  const handlePress = useCallback(() => onSelect(name), [name, onSelect]);

  return (
    <View className="w-1/5 p-1">
      <Pressable
        accessibilityRole="radio"
        accessibilityLabel={translateKey(t, `iconPicker.icons.${name}`)}
        accessibilityState={{ checked: selected }}
        onPress={handlePress}
        className="aspect-square items-center justify-center rounded-card border active:opacity-60"
        style={{
          borderColor: selected ? hueColor : 'transparent',
          backgroundColor: selected ? withAlpha(hueColor, 0.18) : undefined,
        }}
      >
        <IconComponent size={26} color={selected ? hueColor : text} />
      </Pressable>
    </View>
  );
};

export default memo(IconCell);
