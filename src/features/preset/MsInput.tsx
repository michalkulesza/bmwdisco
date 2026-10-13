import { TextInput } from 'react-native';

import { useColorToken } from '@/ui/theme';

import { parseMs } from './helpers';

interface MsInputProps {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  accessibilityLabel: string;
  invalid?: boolean;
}

const MsInput = ({ value, onChange, accessibilityLabel, invalid = false }: MsInputProps) => {
  const text = useColorToken('text');
  const destructive = useColorToken('destructive');
  const border = useColorToken('border');

  const handleChangeText = (next: string) => onChange(parseMs(next));

  return (
    <TextInput
      value={value === undefined ? '' : String(value)}
      onChangeText={handleChangeText}
      accessibilityLabel={accessibilityLabel}
      keyboardType="number-pad"
      returnKeyType="done"
      autoCorrect={false}
      selectTextOnFocus
      maxLength={5}
      className="h-9 w-20 rounded-segmented border bg-page px-3 text-right font-geist-medium text-label"
      style={{ color: text, borderColor: invalid ? destructive : border }}
    />
  );
};

export default MsInput;
