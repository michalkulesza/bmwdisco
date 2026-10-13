import { Pressable } from 'react-native';

import Text from '@/ui/Text';
import { useColorToken } from '@/ui/theme';

import type { Icon } from 'phosphor-react-native';

interface MenuRowProps {
  icon: Icon;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}

const MenuRow = ({ icon: IconComponent, label, onPress, destructive = false }: MenuRowProps) => {
  const color = useColorToken(destructive ? 'destructive' : 'text');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="min-h-[52px] flex-row items-center gap-3.5 px-4 active:opacity-60"
    >
      <IconComponent size={20} color={color} />
      <Text variant="body" tone={destructive ? 'destructive' : 'default'}>
        {label}
      </Text>
    </Pressable>
  );
};

export default MenuRow;
