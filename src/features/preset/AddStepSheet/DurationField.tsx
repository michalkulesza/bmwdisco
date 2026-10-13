import { MinusIcon } from 'phosphor-react-native/src/icons/Minus';
import { PlusIcon } from 'phosphor-react-native/src/icons/Plus';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import Text from '@/ui/Text';
import { useColorToken } from '@/ui/theme';

import MsInput from '../MsInput';

import { DURATION_CHIPS, DURATION_STEP_MS, stepDuration } from './helpers';

interface DurationFieldProps {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}

interface ChipProps {
  ms: number;
  selected: boolean;
  onSelect: (ms: number) => void;
}

const Chip = ({ ms, selected, onSelect }: ChipProps) => {
  const handlePress = useCallback(() => onSelect(ms), [ms, onSelect]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${ms} ms`}
      accessibilityState={{ selected }}
      onPress={handlePress}
      hitSlop={4}
      className={`h-9 flex-1 items-center justify-center rounded-pill border ${selected ? 'border-line bg-raised' : 'border-card-border bg-card'}`}
    >
      <Text variant={selected ? 'labelStrong' : 'label'} tone={selected ? 'default' : 'muted'}>
        {ms}
      </Text>
    </Pressable>
  );
};

const DurationField = ({ value, onChange }: DurationFieldProps) => {
  const { t } = useTranslation();
  const icon = useColorToken('text');

  const handleDecrease = useCallback(
    () => onChange(stepDuration(value, -DURATION_STEP_MS)),
    [onChange, value],
  );
  const handleIncrease = useCallback(
    () => onChange(stepDuration(value, DURATION_STEP_MS)),
    [onChange, value],
  );

  return (
    <View className="gap-3">
      <Text variant="meta" tone="muted">
        {t('preset.duration')}
      </Text>
      <View className="flex-row items-center justify-between gap-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('preset.step.decrease')}
          onPress={handleDecrease}
          className="size-touch items-center justify-center rounded-card border border-card-border bg-card active:opacity-60"
        >
          <MinusIcon size={20} color={icon} />
        </Pressable>
        <View className="flex-row items-center gap-2">
          <MsInput
            value={value}
            onChange={onChange}
            accessibilityLabel={t('preset.durationLabel')}
          />
          <Text variant="meta" tone="muted">
            {t('preset.ms')}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('preset.step.increase')}
          onPress={handleIncrease}
          className="size-touch items-center justify-center rounded-card border border-card-border bg-card active:opacity-60"
        >
          <PlusIcon size={20} color={icon} />
        </Pressable>
      </View>
      <View className="flex-row gap-2">
        {DURATION_CHIPS.map((ms) => (
          <Chip key={ms} ms={ms} selected={value === ms} onSelect={onChange} />
        ))}
      </View>
    </View>
  );
};

export default DurationField;
