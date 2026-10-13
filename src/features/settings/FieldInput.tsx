import { TextInput, View, type TextInputProps } from 'react-native';

import Text from '@/ui/Text';
import { useColorToken } from '@/ui/theme';

interface FieldInputProps extends Pick<
  TextInputProps,
  'keyboardType' | 'returnKeyType' | 'placeholder'
> {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string;
}

const FieldInput = ({ label, value, onChangeText, error, ...inputProps }: FieldInputProps) => {
  const placeholderColor = useColorToken('text-muted');
  const borderClass = error ? 'border-destructive' : 'border-line';

  return (
    <View className="gap-1.5">
      <Text variant="small" tone="muted">
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={placeholderColor}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        textContentType="none"
        autoComplete="off"
        clearButtonMode="while-editing"
        className={`h-12 rounded-card border bg-page px-4 font-geist text-body text-ink ${borderClass}`}
        {...inputProps}
      />
      {error ? (
        <Text variant="small" tone="destructive" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
};

export default FieldInput;
