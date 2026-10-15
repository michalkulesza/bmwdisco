import { useCallback } from 'react';
import { Pressable, View } from 'react-native';

import { selectionHaptic } from '@/ui/haptics';
import { tva } from '@/ui/styles';
import Text from '@/ui/Text';

interface ChipOption<T extends string> {
  value: T;
  label: string;
}

interface ChipGroupProps<T extends string> {
  options: readonly ChipOption<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
  accessibilityLabel: string;
}

const chipStyle = tva({
  base: 'min-h-11 justify-center rounded-pill border px-4 active:opacity-70',
  variants: {
    selected: { true: 'border-primary bg-primary', false: 'border-line bg-page' },
  },
});

interface ChipProps<T extends string> {
  option: ChipOption<T>;
  selected: boolean;
  onSelect: (value: T) => void;
}

const Chip = <T extends string>({ option, selected, onSelect }: ChipProps<T>) => {
  const handlePress = useCallback(() => {
    selectionHaptic();
    onSelect(option.value);
  }, [onSelect, option.value]);

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={option.label}
      accessibilityState={{ checked: selected }}
      onPress={handlePress}
      className={chipStyle({ selected })}
    >
      <Text variant="label" tone={selected ? 'onPrimary' : 'default'}>
        {option.label}
      </Text>
    </Pressable>
  );
};

const ChipGroup = <T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: ChipGroupProps<T>) => (
  <View
    accessibilityRole="radiogroup"
    accessibilityLabel={accessibilityLabel}
    className="flex-row flex-wrap gap-2"
  >
    {options.map((option) => (
      <Chip
        key={option.value}
        option={option}
        selected={option.value === value}
        onSelect={onChange}
      />
    ))}
  </View>
);

export default ChipGroup;
