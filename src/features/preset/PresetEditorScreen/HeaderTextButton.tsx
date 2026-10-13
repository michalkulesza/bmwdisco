import { Pressable } from 'react-native';

import Text from '@/ui/Text';

interface HeaderTextButtonProps {
  label: string;
  onPress: () => void;
  strong?: boolean;
}

const HeaderTextButton = ({ label, onPress, strong = false }: HeaderTextButtonProps) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    onPress={onPress}
    className="min-h-touch justify-center px-2 active:opacity-60"
  >
    <Text variant={strong ? 'labelStrong' : 'label'}>{label}</Text>
  </Pressable>
);

export default HeaderTextButton;
