import { Pressable } from 'react-native';

import Text from '@/ui/Text';
import { useColorToken } from '@/ui/theme';

import type { Icon } from 'phosphor-react-native';

interface PanelActionProps {
  label: string;
  icon: Icon;
  onPress: () => void;
  destructive?: boolean;
}

const HIT_SLOP = { top: 8, bottom: 8, left: 4, right: 4 };

const PanelAction = ({
  label,
  icon: IconComponent,
  onPress,
  destructive = false,
}: PanelActionProps) => {
  const iconColor = useColorToken(destructive ? 'destructive' : 'text');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={HIT_SLOP}
      onPress={onPress}
      className="min-h-9 flex-row items-center gap-1.5 rounded-pill border border-line bg-page px-3 active:opacity-70"
    >
      <IconComponent size={16} color={iconColor} />
      <Text variant="label" tone={destructive ? 'destructive' : 'default'}>
        {label}
      </Text>
    </Pressable>
  );
};

export default PanelAction;
