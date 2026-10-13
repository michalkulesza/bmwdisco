import { useTranslation } from 'react-i18next';
import { TextInput, View } from 'react-native';

import { PRESET_LIMITS } from '@/domain';
import Text from '@/ui/Text';
import { useColorToken } from '@/ui/theme';
import { hueOf } from '@/ui/tile/helpers';
import NamedIcon from '@/ui/tile/NamedIcon';

interface NameFieldProps {
  name: string;
  color: string;
  icon: string;
  errorText: string | undefined;
  onChangeName: (name: string) => void;
}

const NameField = ({ name, color, icon, errorText, onChangeName }: NameFieldProps) => {
  const { t } = useTranslation();
  const hue = useColorToken(hueOf(color));
  const text = useColorToken('text');
  const muted = useColorToken('text-muted');
  const destructive = useColorToken('destructive');

  return (
    <View className="gap-2">
      <Text variant="meta" tone="muted">
        {t('preset.name')}
      </Text>
      <View
        className="h-14 flex-row items-center gap-3 rounded-card border bg-card px-3"
        style={{ borderColor: errorText ? destructive : undefined }}
      >
        <NamedIcon name={icon} size={24} color={hue} />
        <TextInput
          value={name}
          onChangeText={onChangeName}
          placeholder={t('preset.namePlaceholder')}
          placeholderTextColor={muted}
          accessibilityLabel={t('preset.name')}
          maxLength={PRESET_LIMITS.maxNameLength}
          autoCapitalize="sentences"
          autoCorrect={false}
          returnKeyType="done"
          className="flex-1 font-geist-medium text-heading"
          style={{ color: text }}
        />
      </View>
      {errorText ? (
        <Text variant="small" tone="destructive">
          {errorText}
        </Text>
      ) : null}
    </View>
  );
};

export default NameField;
