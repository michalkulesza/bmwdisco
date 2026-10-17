import { CaretDownIcon } from 'phosphor-react-native/src/icons/CaretDown';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { categoryOf } from '@/data/elements';
import { type PopoverTriggerProps } from '@/ui/Popover';
import Text from '@/ui/Text';
import { useColorToken } from '@/ui/theme';
import { translateKey } from '@/ui/tile/helpers';

import { categoryAppearance } from '../category-appearance';
import ElementWarning from '../ElementWarning';
import LightPicker from '../LightPicker';

import type { LightSelection } from '../light-selection';

interface LightFieldProps {
  selected: LightSelection | undefined;
  onSelect: (selection: LightSelection) => void;
}

const LightField = ({ selected, onSelect }: LightFieldProps) => {
  const { t } = useTranslation();
  const muted = useColorToken('text-muted');
  const selectedCategory = selected?.kind === 'legacy' ? categoryOf(selected.id) : 'other';
  const { icon: IconComponent, hue } = categoryAppearance(selectedCategory);
  const hueColor = useColorToken(hue);
  const triggerLabel =
    selected?.kind === 'action'
      ? translateKey(t, `actions.names.${selected.id}`)
      : selected?.kind === 'legacy'
        ? translateKey(t, `elements.${selected.id}`)
        : t('preset.step.chooseLight');

  const renderTrigger = useCallback(
    (triggerProps: PopoverTriggerProps, { open }: { open: boolean }) => (
      <Pressable
        {...triggerProps}
        accessibilityRole="button"
        accessibilityLabel={t('preset.light')}
        accessibilityState={{ expanded: open }}
        accessibilityValue={{ text: triggerLabel }}
        className="h-14 flex-row items-center gap-3 rounded-card border border-card-border bg-card px-3 active:opacity-60"
      >
        <IconComponent size={22} color={hueColor} />
        <View className="flex-1">
          <Text variant="bodyMedium" numberOfLines={1}>
            {triggerLabel}
          </Text>
          {selected?.kind === 'legacy' ? (
            <Text variant="small" tone="muted">
              {translateKey(t, `categories.${selectedCategory}`)}
            </Text>
          ) : null}
        </View>
        <ElementWarning elements={selected?.kind === 'legacy' ? [selected.id] : []} />
        <CaretDownIcon size={16} color={muted} />
      </Pressable>
    ),
    [IconComponent, hueColor, muted, selected, selectedCategory, t, triggerLabel],
  );

  return (
    <View className="gap-2">
      <Text variant="meta" tone="muted">
        {t('preset.light')}
      </Text>
      <LightPicker value={selected} onSelect={onSelect} trigger={renderTrigger} />
    </View>
  );
};

export default LightField;
