import { View } from 'react-native';

import { tva, type VariantProps } from './styles';
import { useColorToken, type HueToken } from './theme';

import type { Icon } from 'phosphor-react-native';

const ICON_SIZES = { sm: 18, md: 24, lg: 28 } as const;

const badgeStyle = tva({
  base: 'items-center justify-center border border-card-border bg-page',
  variants: {
    size: {
      sm: 'size-9 rounded-segmented',
      md: 'size-11 rounded-segmented',
      lg: 'size-14 rounded-card',
    },
  },
});

interface IconBadgeProps extends VariantProps<typeof badgeStyle> {
  icon: Icon;
  tone?: HueToken;
  accessibilityLabel?: string;
}

const IconBadge = ({
  icon: IconComponent,
  tone = 'neutral',
  size = 'md',
  accessibilityLabel,
}: IconBadgeProps) => {
  const color = useColorToken(tone);
  const iconSize = ICON_SIZES[size ?? 'md'];

  return (
    <View
      accessible={accessibilityLabel !== undefined}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
      importantForAccessibility={accessibilityLabel ? 'yes' : 'no-hide-descendants'}
      className={badgeStyle({ size })}
    >
      <IconComponent size={iconSize} color={color} />
    </View>
  );
};

export default IconBadge;
