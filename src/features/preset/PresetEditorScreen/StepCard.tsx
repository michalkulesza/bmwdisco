import { DotsSixVerticalIcon } from 'phosphor-react-native/src/icons/DotsSixVertical';
import { TrashIcon } from 'phosphor-react-native/src/icons/Trash';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useReorderableDrag } from 'react-native-reorderable-list';

import Text from '@/ui/Text';
import { useColorToken } from '@/ui/theme';

import type { ReactNode } from 'react';

interface StepCardProps {
  number: number;
  header: ReactNode;
  children: ReactNode;
  errorText?: string;
  onRemove: () => void;
}

const StepCard = ({ number, header, children, errorText, onRemove }: StepCardProps) => {
  const { t } = useTranslation();
  const drag = useReorderableDrag();
  const grip = useColorToken('text-muted');
  const destructive = useColorToken('destructive');

  return (
    <View className="mb-2 rounded-card border border-card-border bg-card pb-3 pr-1">
      <View className="flex-row items-center">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('preset.dragStep', { n: number })}
          onPressIn={drag}
          className="size-touch items-center justify-center"
        >
          <DotsSixVerticalIcon size={22} color={grip} />
        </Pressable>
        <Text variant="labelStrong" tone="muted" className="w-6">
          {number}
        </Text>
        <View className="flex-1">{header}</View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('preset.deleteStep', { n: number })}
          onPress={onRemove}
          className="size-touch items-center justify-center active:opacity-60"
        >
          <TrashIcon size={18} color={destructive} />
        </Pressable>
      </View>
      <View className="flex-row items-center gap-3 pl-11 pr-2">{children}</View>
      {errorText ? (
        <Text variant="small" tone="destructive" className="pl-11 pt-2">
          {errorText}
        </Text>
      ) : null}
    </View>
  );
};

export default StepCard;
