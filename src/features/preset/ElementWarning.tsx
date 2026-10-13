import { WarningIcon } from 'phosphor-react-native/src/icons/Warning';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable } from 'react-native';

import type { ElementId } from '@/data/elements';
import { hasElementWarning } from '@/domain/registry/rules';
import { useSessionSelector } from '@/session';
import { useColorToken } from '@/ui/theme';

export default function ElementWarning({ elements }: { elements: readonly ElementId[] }) {
  const { t } = useTranslation();
  const color = useColorToken('amber');
  const warned = useSessionSelector((snapshot) =>
    elements.some((element) => hasElementWarning(snapshot.context.car?.modules ?? [], element)),
  );
  if (!warned) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('preset.outputWarning')}
      onPress={(event) => {
        event.stopPropagation();
        Alert.alert(t('preset.outputWarning'), t('preset.outputWarningDetail'));
      }}
      className="min-h-touch min-w-touch items-center justify-center"
    >
      <WarningIcon size={20} color={color} weight="fill" />
    </Pressable>
  );
}
