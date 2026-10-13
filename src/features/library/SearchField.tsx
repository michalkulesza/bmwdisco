import { MagnifyingGlassIcon } from 'phosphor-react-native/src/icons/MagnifyingGlass';
import { TextInput, View } from 'react-native';

import { useColorToken } from '@/ui/theme';

interface SearchFieldProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
}

const SearchField = ({ value, onChangeText, placeholder }: SearchFieldProps) => {
  const muted = useColorToken('text-muted');
  const text = useColorToken('text');

  return (
    <View className="h-11 flex-row items-center gap-2 rounded-card border border-card-border bg-card px-3">
      <MagnifyingGlassIcon size={18} color={muted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={muted}
        accessibilityLabel={placeholder}
        keyboardType="default"
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        className="flex-1 font-geist text-body"
        style={{ color: text }}
      />
    </View>
  );
};

export default SearchField;
