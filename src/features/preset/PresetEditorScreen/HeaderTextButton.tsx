import { Pressable } from 'react-native';

import Text from '@/ui/Text';

interface HeaderTextButtonProps {
  label: string;
  onPress: () => void;
  strong?: boolean;
  disabled?: boolean;
}

const HeaderTextButton = ({
  label,
  onPress,
  strong = false,
  disabled = false,
}: HeaderTextButtonProps) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityState={{ disabled }}
    disabled={disabled}
    onPress={onPress}
    className="min-h-touch justify-center px-2 active:opacity-60 disabled:opacity-40"
  >
    <Text variant={strong ? 'labelStrong' : 'label'}>{label}</Text>
  </Pressable>
);

export default HeaderTextButton;
