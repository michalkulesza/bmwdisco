import { useCallback } from 'react';
import { Pressable, View } from 'react-native';

import { selectionHaptic } from './haptics';
import { tva } from './styles';
import Text from './Text';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
  className?: string;
}

const SEGMENT_HIT_SLOP = { top: 4, bottom: 4 };

const groupStyle = tva({
  base: 'flex-row gap-0.5 rounded-segmented border border-line bg-page p-[3px]',
});

const segmentStyle = tva({
  base: 'h-9 flex-1 items-center justify-center rounded-segmented-item',
  variants: { selected: { true: 'bg-line', false: 'bg-transparent' } },
});

interface SegmentProps<T extends string> {
  option: SegmentedOption<T>;
  selected: boolean;
  onSelect: (value: T) => void;
}

const Segment = <T extends string>({ option, selected, onSelect }: SegmentProps<T>) => {
  const handlePress = useCallback(() => {
    if (selected) return;
    selectionHaptic();
    onSelect(option.value);
  }, [onSelect, option.value, selected]);

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={option.label}
      accessibilityState={{ checked: selected }}
      hitSlop={SEGMENT_HIT_SLOP}
      onPress={handlePress}
      className={segmentStyle({ selected })}
    >
      <Text variant={selected ? 'labelStrong' : 'label'} tone={selected ? 'default' : 'muted'}>
        {option.label}
      </Text>
    </Pressable>
  );
};

const SegmentedControl = <T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  className,
}: SegmentedControlProps<T>) => (
  <View
    accessibilityRole="radiogroup"
    accessibilityLabel={accessibilityLabel}
    className={groupStyle({ class: className })}
  >
    {options.map((option) => (
      <Segment
        key={option.value}
        option={option}
        selected={option.value === value}
        onSelect={onChange}
      />
    ))}
  </View>
);

export default SegmentedControl;
