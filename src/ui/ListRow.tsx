import { Check, CaretRight } from 'phosphor-react-native';
import { Pressable, View } from 'react-native';

import Text from './Text';
import { useColorToken } from './theme';

import type { ReactNode } from 'react';

interface ListRowProps {
  label: string;
  value?: string;
  left?: ReactNode;
  chevron?: boolean;
  checked?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}

const getAccessibilityRole = (checked: boolean | undefined, onPress: (() => void) | undefined) => {
  if (checked !== undefined) return 'radio';
  return onPress ? 'button' : undefined;
};

const ListRow = ({
  label,
  value,
  left,
  chevron = false,
  checked,
  onPress,
  accessibilityLabel,
}: ListRowProps) => {
  const chevronColor = useColorToken('chevron');
  const checkColor = useColorToken('text');

  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      accessibilityRole={getAccessibilityRole(checked, onPress)}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={checked === undefined ? undefined : { checked }}
      className="min-h-14 flex-row items-center gap-3 pl-4 pr-3 active:opacity-60"
    >
      {left}
      <View className="flex-1">
        <Text variant="bodyMedium">{label}</Text>
      </View>
      {value ? (
        <Text variant="label" tone="muted">
          {value}
        </Text>
      ) : null}
      {checked ? <Check size={20} weight="bold" color={checkColor} /> : null}
      {chevron ? <CaretRight size={18} color={chevronColor} /> : null}
    </Pressable>
  );
};

export default ListRow;
